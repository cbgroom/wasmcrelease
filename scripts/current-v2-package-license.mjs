#!/usr/bin/env node
// Outer distribution metadata binds exact strict package roots. No relabeling
// of historical artifacts, source disclosure, or upstream license override.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync,mkdirSync,writeFileSync,realpathSync,cpSync} from 'node:fs';
import {join,resolve,dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateInventory} from './current-v2-dependency-inventory.mjs';
import {validateToolchainNotices} from './current-v2-toolchain-notices.mjs';
import {validateRegistryNoticeReview} from './current-v2-registry-notice-review.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const path='admission/current-v2-next/package-license-bindings.json';
const buildPaths=['admission/current-v2-next/build-receipts.json','admission/current-v2-data-core/build-receipts.json'];
const reviewPath='admission/current-v2-next/upstream/review.json';
const dependencyPath='admission/current-v2-next/dependency-inventory.json';
const toolchainPath='admission/current-v2-next/toolchain-notices/receipt.json';
const registryReviewPath='admission/current-v2-next/registry-notice-review.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=(base,name)=>readFileSync(join(base,name));
const json=name=>JSON.parse(read(root,name));

function file(base,name){
  assert(typeof name==='string' && !name.includes('\\') && !isAbsolute(name));
  assert(name.split('/').every(x=>x && x!=='.' && x!=='..'),'unsafe distribution path');
  const absolute=join(base,name);
  for(let parent=absolute;parent!==resolve(base);parent=dirname(parent)){
    assert(!lstatSync(parent).isSymbolicLink(),'linked distribution entry');
    assert(parent.startsWith(resolve(base)+'/'),'escaping distribution path');
  }
  assert(lstatSync(absolute).isFile(),'missing distribution file');
  const bytes=read(base,name);return {bytes:bytes.length,sha256:sha(bytes)};
}
function tree(base,prefix=''){
  assert(lstatSync(base).isDirectory() && !lstatSync(base).isSymbolicLink(),'linked directory');
  const result={};
  for(const name of readdirSync(base).sort()){
    const child=join(base,name),stat=lstatSync(child);assert(!stat.isSymbolicLink(),'linked tree entry');
    if(stat.isDirectory())Object.assign(result,tree(child,prefix+name+'/'));
    else {assert(stat.isFile());const bytes=readFileSync(child);result[prefix+name]={bytes:bytes.length,sha256:sha(bytes)};}
  }
  return result;
}
function expected(){
  const policy=json('license-policy.json'),review=json(reviewPath);
  assert.equal(policy.license,'WAsmC Research-Only Non-Commercial License 1.0');
  assert.equal(policy.commercial_use,false);assert.equal(policy.production_use,false);
  assert.equal(review.full_transitive_license_audit,false);
  const rows=buildPaths.flatMap(name=>json(name).packages);
  assert.equal(rows.length,5);assert.equal(new Set(rows.map(x=>x.id)).size,5);
  const files={};
  const add=name=>{files[name]=file(root,name);};
  for(const name of ['LICENSE','license-policy.json',reviewPath,...buildPaths])add(name);
  const dependency=json(dependencyPath),toolchain=json(toolchainPath);
  const dependencyResult=validateInventory(dependency),toolchainResult=validateToolchainNotices(toolchain);
  assert.equal(dependencyResult.notice_blockers.length,0);
  assert.equal(dependency.archive_inventory_complete,true);assert.equal(dependency.notice_material_inventory_complete,true);
  const registryReview=json(registryReviewPath),registryResult=validateRegistryNoticeReview(registryReview);
  assert.equal(registryReview.dependency_inventory_sha256,file(root,dependencyPath).sha256);
  for(const name of [dependencyPath,toolchainPath,registryReviewPath,...dependency.inputs.map(x=>x.path),...toolchain.materials.map(x=>x.path)])add(name);
  const materialEvidence={dependency_inventory:{path:dependencyPath,...files[dependencyPath],lockfiles:dependencyResult.lockfiles,registry_crates:dependencyResult.crates},
    toolchain_notices:{path:toolchainPath,...files[toolchainPath],documents:toolchainResult.official_toolchain_notice_files},
    registry_notice_review:{path:registryReviewPath,...files[registryReviewPath],registry_crates:registryResult.registry_crates,
      declared_expressions:registryResult.declared_expressions,review_receipt_carried:true,full_transitive_license_audit:false},
    dependency_materials_carried:true,scope:'Conservative exact locked inputs and notice materials for these five roots and their generated-SDK consumer. Inventory/delivery evidence only; license-obligation and target review remain pending.'};
  const packages=rows.map(row=>{
    const inventory=row.builds[0].inventory;
    assert.deepEqual(inventory,row.builds[1].inventory);
    assert.equal(Object.keys(inventory).length,9);assert.deepEqual(tree(join(root,row.root)),inventory);
    for(const name of Object.keys(inventory))add(row.root+'/'+name);
    const group=review.groups.find(x=>x.id===row.id);
    const upstream=group?group.registry.map(crate=>({name:crate.name,version:crate.version,license:crate.license,
      archive_sha256:crate.archive_sha256,notices:crate.notices})):[];
    for(const crate of upstream)for(const notice of crate.notices){add(notice.path);assert.equal(files[notice.path].sha256,notice.sha256);}
    return {id:row.id,version:row.version,root:row.root,
      manifest_sha256:inventory['lib.json'].sha256,artifact_sha256:inventory['artifact.wasm'].sha256,
      component_sha256:inventory['component.wasm'].sha256,
      license:{name:policy.license,path:'LICENSE',sha256:files.LICENSE.sha256,
        scope:'New WAsmC-owned material in this exact staged root only; third-party and earlier grants are not restricted or replaced.',
        commercial_use:false,production_use:false,upstream_license_override:false,earlier_grants_revoked:false},
      primary_upstream_notices:upstream,
      dependency_materials_carried:true,
      transitive_dependencies_audited:false,
      pending:['license-obligation and target-applicability review']};
  });
  return {schema:'wasmc.current-v2-package-license-bindings/v1',package_license_binding:true,
    scope:'Outer distribution manifest; strict generated nine-file roots remain unchanged. A future candidate must carry this envelope or equivalent exact binding.',
    policy:{path:'license-policy.json',...files['license-policy.json']},packages,files,dependency_materials:materialEvidence,
    full_transitive_license_audit:false,immutable_prior_artifacts_relicensed:false,
    selected_current_catalog:false,ordinary_wasmc_app_qualified:false,release_qualified:false};
}
export function validatePackageLicenseBindings(value,base=root,{isolated=false}={}){
  // Expected identities come from the independent trusted producer receipts and
  // current license policy, never from a recipient's self-rehashed index.
  const trusted=expected();assert.deepEqual(value,trusted,'package license binding drift');
  assert(lstatSync(base).isDirectory() && !lstatSync(base).isSymbolicLink());
  for(const [name,identity] of Object.entries(trusted.files))assert.deepEqual(file(base,name),identity,name);
  for(const row of trusted.packages)assert.deepEqual(tree(join(base,row.root)),
    tree(join(root,row.root)),'strict root inventory changed');
  assert.deepEqual(file(base,path),file(root,path),'untrusted binding manifest');
  if(isolated){
    const inventory=tree(base),expectedInventory={...trusted.files,[path]:file(root,path)};
    assert.deepEqual(inventory,expectedInventory,'extra or missing isolated delivery files');
  }
  return {accepted:true,packages:trusted.packages.length,package_license_binding:true,
    carried_files:Object.keys(trusted.files).length+1,
    primary_notices:trusted.packages.reduce((n,x)=>n+x.primary_upstream_notices.reduce((m,y)=>m+y.notices.length,0),0),
    dependency_materials_carried:true,registry_crates:trusted.dependency_materials.dependency_inventory.registry_crates,
    lockfiles:trusted.dependency_materials.dependency_inventory.lockfiles,toolchain_documents:trusted.dependency_materials.toolchain_notices.documents,
    registry_notice_review_carried:true,registry_notice_expressions:trusted.dependency_materials.registry_notice_review.declared_expressions,
    full_transitive_license_audit:false,release_qualified:false};
}
export function stageLicensedDelivery(destination){
  const output=resolve(destination);assert(isAbsolute(destination),'output must be absolute');
  assert.equal(realpathSync(dirname(output)),dirname(output),'linked output parent rejected');
  const value=json(path);validatePackageLicenseBindings(value);
  mkdirSync(output); // New exact target only: no merge, clobber, delete or reuse.
  for(const name of [...Object.keys(value.files),path]){
    mkdirSync(dirname(join(output,name)),{recursive:true});cpSync(join(root,name),join(output,name),{errorOnExist:true,force:false});
  }
  return validatePackageLicenseBindings(JSON.parse(read(output,path)),output,{isolated:true});
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);assert(args.length===0 || (args.length===1 && args[0]==='--capture') || (args.length===2 && args[0]==='--stage'));
  if(args[0]==='--capture')writeFileSync(join(root,path),JSON.stringify(expected(),null,2)+'\n');
  console.log(JSON.stringify(args[0]==='--stage'?stageLicensedDelivery(args[1]):validatePackageLicenseBindings(json(path))));
}
