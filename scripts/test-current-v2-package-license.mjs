import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,renameSync,symlinkSync,cpSync,realpathSync,readdirSync,lstatSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validatePackageLicenseBindings,stageLicensedDelivery} from './current-v2-package-license.mjs';
const bindingPath='admission/current-v2-next/package-license-bindings.json';
const binding=JSON.parse(readFileSync(bindingPath));
const sdkRequested=process.argv.includes('--sdk');assert(process.argv.slice(2).every(x=>x==='--sdk'));
const temp=realpathSync(mkdtempSync(join(tmpdir(),'wasmc-licensed-delivery-')));
try{
const delivery=join(temp,'delivery');
const staged=stageLicensedDelivery(delivery);assert.equal(staged.packages,5);
assert.equal(staged.carried_files,79);assert.equal(staged.primary_notices,15);
assert.equal(staged.retained_build_evidence_carried,true);assert.equal(staged.retained_build_records,2);
assert.equal(staged.build_input_witness_files,38);assert.equal(staged.registry_source_witness_crates,189);assert.equal(staged.registry_source_witness_files,12335);
assert.equal(staged.registry_notice_review_carried,true);assert.equal(staged.registry_notice_expressions,17);
assert.equal(staged.dependency_materials_carried,true);assert.equal(staged.registry_crates,189);assert.equal(staged.lockfiles,6);assert.equal(staged.toolchain_documents,2);
let rejected=0;
for(const mutate of [
  x=>x.package_license_binding=false,x=>x.release_qualified=true,
  x=>x.full_transitive_license_audit=true,x=>x.immutable_prior_artifacts_relicensed=true,
  x=>x.selected_current_catalog=true,x=>x.packages.pop(),x=>x.packages.push(x.packages[0]),
  x=>x.packages[0].manifest_sha256='0'.repeat(64),x=>x.packages[0].artifact_sha256='0'.repeat(64),
  x=>x.packages[0].component_sha256='0'.repeat(64),x=>x.packages[0].version='9.9.9',
  x=>x.packages[0].license.path='../../LICENSE',x=>x.packages[0].license.sha256='0'.repeat(64),
  x=>x.packages[0].license.commercial_use=true,x=>x.packages[0].license.production_use=true,
  x=>x.packages[0].license.upstream_license_override=true,x=>x.packages[0].license.earlier_grants_revoked=true,
  x=>x.packages[0].transitive_dependencies_audited=true,
  x=>x.packages.find(y=>y.primary_upstream_notices.length).primary_upstream_notices=[],
  x=>x.policy.sha256='0'.repeat(64),x=>delete x.files.LICENSE,
  x=>delete x.files[Object.keys(x.files).find(y=>y.includes('/notices/'))],
  x=>x.files.LICENSE.sha256='0'.repeat(64),
  x=>x.dependency_materials.dependency_materials_carried=false,
  x=>x.dependency_materials.dependency_inventory.registry_crates=7,
  x=>x.dependency_materials.toolchain_notices.documents=0,
  x=>x.packages[0].dependency_materials_carried=false,
  x=>x.dependency_materials.registry_notice_review.review_receipt_carried=false,
  x=>x.dependency_materials.registry_notice_review.declared_expressions=1,
  x=>x.dependency_materials.registry_notice_review.full_transitive_license_audit=true,
  x=>x.dependency_materials.retained_build_evidence.records_carried=false,
  x=>x.dependency_materials.retained_build_evidence.private_builds_reexecuted=true,
  x=>x.dependency_materials.retained_build_evidence.temporary_adapter_contents_attested=true,
  x=>x.dependency_materials.retained_build_evidence.full_transitive_license_audit=true,
  x=>x.packages[0].retained_build_evidence_carried=false,
]){const altered=structuredClone(binding);mutate(altered);assert.throws(()=>validatePackageLicenseBindings(altered,delivery));rejected++;}
// Actual malformed recipient deliveries, not just edited JSON claims.
const fixture=name=>{const path=join(temp,name);cpSync(delivery,path,{recursive:true,errorOnExist:true,force:false});return path;};
const reject=base=>{assert.throws(()=>validatePackageLicenseBindings(binding,base,{isolated:true}));rejected++;};
const licenseLost=fixture('missing-license');renameSync(join(licenseLost,'LICENSE'),join(temp,'removed-LICENSE'));reject(licenseLost);
const noticePath=Object.keys(binding.files).find(x=>x.includes('/notices/'));
const noticeLost=fixture('missing-notice');renameSync(join(noticeLost,noticePath),join(temp,'removed-NOTICE'));reject(noticeLost);
const noticeChanged=fixture('changed-notice');writeFileSync(join(noticeChanged,noticePath),'edited');reject(noticeChanged);
for(const [index,path]of ['admission/current-v2-next/dependency-inventory.json',
  'admission/current-v2-next/dependency-inputs/host-clock.Cargo.lock',
  'admission/current-v2-next/toolchain-notices/receipt.json',
  'admission/current-v2-next/registry-notice-review.json',
  'admission/current-v2-next/cohort-build-input-witness.json',
  'admission/current-v2-next/cohort-registry-build-witness.json',
  'admission/current-v2-next/toolchain-notices/COPYRIGHT-library.html.gz'].entries()){
  const missing=fixture('missing-audit-'+index);renameSync(join(missing,path),join(temp,'removed-audit-'+index));reject(missing);
  const tampered=fixture('changed-audit-'+index);writeFileSync(join(tampered,path),'changed');reject(tampered);
}
const metadataRehashed=fixture('self-rehashed-dependencies'),metadataPath='admission/current-v2-next/dependency-inventory.json';
const alteredMetadata=JSON.parse(readFileSync(join(metadataRehashed,metadataPath)));
alteredMetadata.crates[0].notices=[];
const metadataBytes=Buffer.from(JSON.stringify(alteredMetadata));writeFileSync(join(metadataRehashed,metadataPath),metadataBytes);
const metadataBinding=structuredClone(binding),metadataDigest=createHash('sha256').update(metadataBytes).digest('hex');
metadataBinding.files[metadataPath]={bytes:metadataBytes.length,sha256:metadataDigest};
metadataBinding.dependency_materials.dependency_inventory.bytes=metadataBytes.length;metadataBinding.dependency_materials.dependency_inventory.sha256=metadataDigest;
writeFileSync(join(metadataRehashed,bindingPath),JSON.stringify(metadataBinding));
assert.throws(()=>validatePackageLicenseBindings(metadataBinding,metadataRehashed,{isolated:true}));rejected++;
// Rehashing both the review and recipient envelope must not authorize a
// dropped AND term. The trusted source/build identities remain independent.
const reviewPath='admission/current-v2-next/registry-notice-review.json';
const reviewRehashed=fixture('self-rehashed-review');
const changedReview=JSON.parse(readFileSync(join(reviewRehashed,reviewPath)));
changedReview.crates.find(x=>x.id.startsWith('arrow-array@')).selected_licenses=['MIT'];
const reviewBytes=Buffer.from(JSON.stringify(changedReview)),reviewDigest=createHash('sha256').update(reviewBytes).digest('hex');
writeFileSync(join(reviewRehashed,reviewPath),reviewBytes);
const reviewBinding=structuredClone(binding);reviewBinding.files[reviewPath]={bytes:reviewBytes.length,sha256:reviewDigest};
Object.assign(reviewBinding.dependency_materials.registry_notice_review,{bytes:reviewBytes.length,sha256:reviewDigest});
writeFileSync(join(reviewRehashed,bindingPath),JSON.stringify(reviewBinding));
assert.throws(()=>validatePackageLicenseBindings(reviewBinding,reviewRehashed,{isolated:true}));rejected++;
const linkedReview=fixture('linked-registry-review');
renameSync(join(linkedReview,reviewPath),join(temp,'link-target-review.json'));
symlinkSync(join(temp,'link-target-review.json'),join(linkedReview,reviewPath));reject(linkedReview);
for(const [kind,path]of [['workspace','admission/current-v2-next/cohort-build-input-witness.json'],
  ['registry','admission/current-v2-next/cohort-registry-build-witness.json']]){
  const linked=fixture('linked-build-'+kind),target=join(temp,'link-target-build-'+kind);
  renameSync(join(linked,path),target);symlinkSync(target,join(linked,path));reject(linked);
  const forgedDelivery=fixture('self-rehashed-build-'+kind),record=JSON.parse(readFileSync(join(forgedDelivery,path)));
  if(kind==='workspace'){
    for(const b of record.packages[0].builds){
      const witness=b.source_inputs;Object.values(witness.files)[0].sha256='0'.repeat(64);
      witness.sha256=createHash('sha256').update(JSON.stringify(witness.files)).digest('hex');
    }
  }else{
    const witness=record.registry_witness;witness.crates[0].source_tree_sha256='0'.repeat(64);
    witness.sha256=createHash('sha256').update(JSON.stringify(witness.crates)).digest('hex');
    for(const p of record.packages)for(const b of p.builds)b.registry_source_sha256=witness.sha256;
  }
  const bytes=Buffer.from(JSON.stringify(record)),identity={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  writeFileSync(join(forgedDelivery,path),bytes);const forgedBinding=structuredClone(binding);
  forgedBinding.files[path]=identity;Object.assign(forgedBinding.dependency_materials.retained_build_evidence[kind],identity);
  writeFileSync(join(forgedDelivery,bindingPath),JSON.stringify(forgedBinding));
  assert.throws(()=>validatePackageLicenseBindings(forgedBinding,forgedDelivery,{isolated:true}));rejected++;
}
const linkedToolchain=fixture('linked-toolchain-material'),toolchainMaterial='admission/current-v2-next/toolchain-notices/COPYRIGHT.html.gz';
renameSync(join(linkedToolchain,toolchainMaterial),join(temp,'link-target-toolchain.gz'));
symlinkSync(join(temp,'link-target-toolchain.gz'),join(linkedToolchain,toolchainMaterial));reject(linkedToolchain);
const linkedLicense=fixture('linked-license');renameSync(join(linkedLicense,'LICENSE'),join(temp,'link-target-LICENSE'));
symlinkSync(join(temp,'link-target-LICENSE'),join(linkedLicense,'LICENSE'));reject(linkedLicense);
const linkedDirectory=fixture('linked-notice-directory'),noticeDir=dirname(join(linkedDirectory,noticePath));
renameSync(noticeDir,join(temp,'link-target-notices'));symlinkSync(join(temp,'link-target-notices'),noticeDir);reject(linkedDirectory);
const missingBinding=fixture('missing-binding');renameSync(join(missingBinding,bindingPath),join(temp,'removed-binding.json'));reject(missingBinding);
const extra=fixture('extra-source');writeFileSync(join(extra,'unexpected-source.rs'),'not a reviewed delivery file');reject(extra);
const rehashed=fixture('self-rehashed'),artifact=binding.packages[0].root+'/artifact.wasm';
const changed=Buffer.concat([readFileSync(join(rehashed,artifact)),Buffer.from([0])]);writeFileSync(join(rehashed,artifact),changed);
const forged=structuredClone(binding),digest=createHash('sha256').update(changed).digest('hex');
forged.files[artifact]={bytes:changed.length,sha256:digest};forged.packages[0].artifact_sha256=digest;
writeFileSync(join(rehashed,bindingPath),JSON.stringify(forged));
assert.throws(()=>validatePackageLicenseBindings(forged,rehashed,{isolated:true}));rejected++;
const rootExtra=fixture('root-extra');writeFileSync(join(rootExtra,binding.packages[0].root,'LICENSE'),'extra inside strict generated root');reject(rootExtra);
const baseLink=join(temp,'linked-delivery');symlinkSync(delivery,baseLink);reject(baseLink);
assert.throws(()=>stageLicensedDelivery(delivery));rejected++;
const linkedParent=join(temp,'linked-parent');symlinkSync(delivery,linkedParent);assert.throws(()=>stageLicensedDelivery(join(linkedParent,'nested')));rejected++;
// Run a genuine delivered-artifact oracle from the new isolated licensed tree.
const http=binding.packages.find(x=>x.id==='wasmc-http1');
const behavior=JSON.parse(execFileSync(process.execPath,['scripts/test-http1-libsrc.mjs','--package',join(delivery,http.root)],
  {encoding:'utf8',timeout:120000,maxBuffer:8<<20}).trim().split('\n').at(-1));
assert.equal(behavior.accepted,true);assert.equal(behavior.cases,1422);assert.equal(behavior.candidate_sha256,http.artifact_sha256);
// Rejections and executable use must leave the valid delivery untouched.
validatePackageLicenseBindings(binding,delivery,{isolated:true});
let sdk;
if(sdkRequested){
  const sdkDelivery=fixture('sdk-delivery'),consumer='libsrc/qualification/current-v2-consumer';
  const names=['Cargo.toml','Cargo.lock','src/main.rs'];
  for(const name of names){const dest=join(sdkDelivery,consumer,name);mkdirSync(dirname(dest),{recursive:true});
    if(Object.hasOwn(binding.files,consumer+'/'+name))assert.deepEqual(readFileSync(dest),readFileSync(join(consumer,name)),'carried SDK lock differs');
    else cpSync(join(consumer,name),dest,{errorOnExist:true,force:false});}
  const inventory=(dir,prefix='')=>{
    const found={};for(const name of readdirSync(dir).sort()){
      const path=join(dir,name),stat=lstatSync(path);assert(!stat.isSymbolicLink());
      if(stat.isDirectory())Object.assign(found,inventory(path,prefix+name+'/'));
      else {assert(stat.isFile());found[prefix+name]=createHash('sha256').update(readFileSync(path)).digest('hex');}
    }return found;
  };
  const sdkFiles=staged.carried_files+names.filter(name=>!Object.hasOwn(binding.files,consumer+'/'+name)).length;
  const before=inventory(sdkDelivery);assert.equal(Object.keys(before).length,sdkFiles);
  assert.deepEqual(Object.keys(before).sort(),[...new Set([...Object.keys(binding.files),bindingPath,...names.map(x=>consumer+'/'+x)])].sort());
  const output=execFileSync('cargo',['+1.96.0','run','--locked','--offline','--quiet','--manifest-path',join(sdkDelivery,consumer,'Cargo.toml'),'--',
    join(sdkDelivery,'admission/current-v2-next/packages'),join(sdkDelivery,binding.packages.find(x=>x.id==='wasmc-data-core').root)],
    {encoding:'utf8',timeout:600000,maxBuffer:8<<20,env:{...process.env,CARGO_TARGET_DIR:join(process.cwd(),consumer,'target')}});
  sdk=JSON.parse(output.trim().split('\n').at(-1));assert.equal(sdk.accepted,true);assert.equal(sdk.packages,5);
  for(const name of names)assert.deepEqual(readFileSync(join(sdkDelivery,consumer,name)),readFileSync(join(consumer,name)));
  assert.deepEqual(inventory(sdkDelivery),before,'licensed SDK source inputs changed');
  validatePackageLicenseBindings(binding,sdkDelivery);
}
console.log(JSON.stringify({...staged,negative_controls:rejected,isolated_delivery:true,exact_http1_cases:behavior.cases,
  ...(sdk?{source_free_licensed_sdk_execution:true,isolated_sdk_files:staged.carried_files+2,sdk}:{})}));
}finally{rmSync(temp,{recursive:true});} // Only this invocation's exact owned fixture.
