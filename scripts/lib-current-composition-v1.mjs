// Verify a complete cohort assembled from immutable, already produced Roots.
// This receipt is deliberately not a lib-refresh-receipt/v2 or a fresh Q0 run.
// Catalog authoring, public admission, installation and release remain separate.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedCurrentCatalog,verifyCurrentRelease,currentProductReader,currentProductPaths} from './current-lib-release-v3.mjs';
import {sha,digest,verifyRoot,inventory} from './lib-refresh-cache-v2.mjs';
import {witModel,selectedWitRoutes} from './current-wit-routes-v3.mjs';

const sorted=values=>[...values].sort();
const exact=(value,keys)=>assert.deepEqual(Object.keys(value).sort(),sorted(keys),'closed composition input schema');
const pin=value=>assert.match(value,/^[0-9a-f]{64}$/,'independent SHA256 required');
const commit=value=>assert.match(value,/^[0-9a-f]{40}$/,'full source identity required');
const safe=value=>{assert.equal(typeof value,'string');assert.ok(value&&!value.startsWith('/')&&!value.includes('\\')&&
  value.split('/').every(p=>p&&p!=='.'&&p!=='..'),'safe composition input path');return value;};
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const parse=bytes=>JSON.parse(decode(bytes));
const readBytes=(input,path)=>{safe(path);const bytes=input.read(path);assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length>0&&bytes.length<=16777216,'bounded composition input');return bytes;};
const descriptor=(input,path)=>{const bytes=readBytes(input,path);return {path,bytes:bytes.length,sha256:sha(bytes)};};
function rootInventory(input,root){
  safe(root);const paths=input.paths(root);assert.ok(Array.isArray(paths)&&paths.length>0&&paths.length<=256);
  assert.deepEqual(paths,sorted(new Set(paths)),'complete ordered unique Root inventory');const files={};
  for(const path of paths){safe(path);assert.ok(path.startsWith(root+'/'),'Root inventory escaped locator');
    const bytes=readBytes(input,path);files[path.slice(root.length+1)]={bytes:bytes.length,sha256:sha(bytes)};}
  return files;
}
function pinnedFile(input,root,files,path){
  safe(path);assert.ok(files[path],'source packet file missing: '+path);const bytes=readBytes(input,root+'/'+path);
  assert.deepEqual({bytes:bytes.length,sha256:sha(bytes)},files[path],'source/Root changed during composition');return bytes;
}
function verifyLocalDescriptors(manifest,files){
  const visit=value=>{if(!value||typeof value!=='object')return;
    if(typeof value.path==='string'&&typeof value.sha256==='string'){
      safe(value.path);assert.ok(files[value.path],'missing descriptor file: '+value.path);
      assert.equal(files[value.path].sha256,value.sha256,'Root descriptor digest');
      if(value.bytes!==undefined)assert.equal(files[value.path].bytes,value.bytes,'Root descriptor size');
    }
    for(const child of Object.values(value))visit(child);
  };
  for(const key of ['artifact','component','core_abi','wit','bindings','agent','license'])visit(manifest[key]);
}
function sourceCustody(input,replacement,files,manifest){
  const source=replacement.source;
  exact(source,['root','inventory_sha256','producer_custody','materialization_custody','source_spec','materialized_spec',
    'generated_source','logic','cargo_manifest','cargo_lock','wit','authority']);
  pin(source.inventory_sha256);const packet=rootInventory(input,source.root);
  assert.equal(digest(packet),source.inventory_sha256,'independent source packet inventory');
  const get=path=>pinnedFile(input,source.root,packet,path);
  const producer=parse(get(source.producer_custody)),materialization=parse(get(source.materialization_custody));
  const authority=source.authority;
  exact(authority,['original_receipt_sha256','driver_sha256','original_source','canonical_source_commit','canonical_source_blob']);
  pin(authority.original_receipt_sha256);pin(authority.driver_sha256);
  for(const key of ['original_source','canonical_source_commit','canonical_source_blob'])commit(authority[key]);
  assert.equal(producer.schema,'wasmc.imported-lib-producer-custody/v1');
  assert.equal(producer.original_private_receipt_sha256,authority.original_receipt_sha256,'original receipt authority');
  assert.equal(producer.driver_sha256,authority.driver_sha256,'original producer authority');
  assert.equal(producer.original_source,authority.original_source,'observed build Source authority');
  assert.equal(producer.exit,0);assert.equal(producer.new_builds,0,'import is not a new producer build');
  assert.ok(Number.isFinite(producer.seconds)&&producer.seconds>0);
  assert.ok(Array.isArray(producer.actual_command)&&producer.actual_command.length>0&&producer.actual_command.every(x=>typeof x==='string'&&x));
  const report=producer.original_producer_report;
  assert.equal(report.schema,'wasmc.lib-build-receipt/v0');assert.equal(report.accepted,true);
  assert.equal(report.package,replacement.id);assert.equal(report.version,replacement.version);
  assert.equal(report.manifest_sha256,replacement.manifest_sha256,'producer manifest identity');
  for(const field of ['artifact','component','core_abi']){
    assert.deepEqual(report[field],{bytes:files[manifest[field].path].bytes,sha256:files[manifest[field].path].sha256},'original produced '+field);
  }
  assert.deepEqual(report.toolchain,manifest.build.toolchain,'original producer toolchain');
  const raw=get(source.source_spec),spec=parse(raw),materialized=parse(get(source.materialized_spec));
  assert.equal(spec.schema,'wasmc.lib-build/v0');assert.equal(spec.skill.name,replacement.id);
  assert.equal(spec.skill.version,replacement.version);assert.equal(producer.source_spec_sha256,sha(raw),'original source spec');
  assert.equal(materialization.schema,'wasmc.lib-source-spec-materialization-custody/v1');
  assert.equal(materialization.new_builds,0);assert.equal(materialization.only_changed_json_field,'/rust/crate_dir');
  assert.equal(materialization.source_file,source.source_spec);assert.equal(materialization.materialized_file,source.materialized_spec);
  const canonical=materialization.canonical_source_spec;
  assert.equal(canonical.source_commit,authority.canonical_source_commit,'canonical source commit');
  assert.equal(canonical.git_blob,authority.canonical_source_blob,'canonical source blob');safe(canonical.path);
  assert.equal(canonical.sha256,sha(raw));assert.equal(canonical.bytes,raw.length);
  assert.equal(createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex'),canonical.git_blob,'actual Git source blob');
  assert.equal(materialization.materialized_sha256,sha(get(source.materialized_spec)));
  assert.equal(materialization.source_value,spec.rust.crate_dir);assert.equal(materialization.materialized_value,materialized.rust.crate_dir);
  const originalShape=structuredClone(spec),materializedShape=structuredClone(materialized);
  delete originalShape.rust.crate_dir;delete materializedShape.rust.crate_dir;
  assert.deepEqual(originalShape,materializedShape,'only producer crate locator may be materialized');
  assert.equal(materialization.all_other_JSON_fields_equal,true);
  assert.equal(report.generated_source_sha256,sha(get(source.generated_source)),'actual generated Rust source');
  assert.equal(producer.logic_sha256,sha(get(source.logic)),'actual Lib implementation source');
  const cargo=decode(get(source.cargo_manifest));
  assert.ok(cargo.includes('version = '+JSON.stringify(replacement.version)),'source Cargo version');
  assert.ok(cargo.includes('name = '+JSON.stringify(spec.rust.artifact_name.replaceAll('_','-'))),'source Cargo package');
  const cargoHash=sha(get(source.cargo_lock));
  assert.ok(manifest.build.inputs.some(row=>row.kind==='cargo-lock'&&row.path===materialized.rust.crate_dir+'/Cargo.lock'&&row.sha256===cargoHash),'original locked Cargo input');
  assert.equal(sha(get(source.wit)),files['lib.wit'].sha256,'source and produced WIT must match');
  assert.equal(spec.wit,source.wit,'explicit producer WIT locator');
  return {spec,report,proof:{kind:'imported-producer-root',original_receipt_sha256:authority.original_receipt_sha256,
    producer_sha256:authority.driver_sha256,observed_build_source:authority.original_source,
    canonical_source_commit:authority.canonical_source_commit,canonical_source_blob:authority.canonical_source_blob,
    source_spec_sha256:sha(raw),materialized_spec_sha256:sha(get(source.materialized_spec)),
    source_root:source.root,source_inventory_sha256:source.inventory_sha256,
    producer_custody:descriptor(input,source.root+'/'+source.producer_custody),
    materialization_custody:descriptor(input,source.root+'/'+source.materialization_custody),
    original_q0_producer_pass:true,original_receipt_bytes_verified:false,
    evidence_mode:'independently-pinned imported custody and original producer report',fresh_build_performed:false}};
}
function importedRoot(input,replacement,baseLicense){
  exact(replacement,['id','version','profile','root','manifest_sha256','root_inventory_sha256','source']);
  assert.match(replacement.id,/^[a-z][a-z0-9-]*$/);assert.match(replacement.version,/^\d+\.\d+\.\d+$/);
  assert.equal(replacement.profile,'value','v1 imports only complete canonical value Roots');
  pin(replacement.manifest_sha256);pin(replacement.root_inventory_sha256);
  const files=rootInventory(input,replacement.root);
  assert.equal(digest(files),replacement.root_inventory_sha256,'independent imported whole-Root inventory');
  const get=path=>pinnedFile(input,replacement.root,files,path),manifest=parse(get('lib.json'));
  assert.equal(sha(get('lib.json')),replacement.manifest_sha256,'independent imported manifest');
  assert.equal(manifest.schema,'wasmc.lib/v2');assert.equal(manifest.id,replacement.id);assert.equal(manifest.version,replacement.version);
  assert.deepEqual(sorted(Object.keys(manifest.bindings)),['rust_component','rust_core'],'complete imported SDK views');
  assert.equal(manifest.bindings.rust_core.schema,'wasmc.lib-rust-canonical-core-sdk/v1');
  assert.equal(manifest.bindings.rust_component.schema,'wasmc.lib-rust-component-sdk/v0');
  for(const name of ['artifact.wasm','component.wasm','core-abi.json','lib.wit','LICENSE'])assert.ok(files[name],'complete imported Root: '+name);
  for(const binding of Object.values(manifest.bindings)){
    assert.ok(binding.cargo_toml?.path&&binding.source?.path,'complete generated SDK descriptors');
    const cargo=decode(get(binding.cargo_toml.path));assert.equal(cargo.match(/^license-file\s*=/gm)?.length,1);
    assert.match(cargo,/^license-file\s*=\s*"\.\.\/\.\.\/LICENSE"\s*$/m);assert.ok(!/^license\s*=/m.test(cargo));
  }
  verifyLocalDescriptors(manifest,files);
  assert.deepEqual(manifest.license,baseLicense,'exact original common license and notice snapshots');
  const custody=sourceCustody(input,replacement,files,manifest),model=witModel(get('lib.wit'));
  assert.ok(model.identity.endsWith('@'+replacement.version));assert.equal(model.dependencies.size,0,'v1 imported WIT has no external dependency');
  assert.equal(manifest.wit.package,model.identity);const world=manifest.wit.world;
  const selected=selectedWitRoutes(model,world,new Map([[model.identity,model]]));
  const apis=[...selected.routes.keys()].sort();
  assert.equal(custody.report.function_count,apis.length,'producer function count versus actual selected WIT');
  assert.equal(new Set(custody.spec.apis.map(row=>row.api)).size,custody.spec.apis.length,'duplicate producer API');
  assert.deepEqual(sorted(custody.spec.apis.map(row=>row.api)),apis.map(route=>route.split('#')[1]).sort(),'original source API set versus selected WIT');
  const module=new WebAssembly.Module(get('artifact.wasm')),abi=parse(get('core-abi.json'));
  assert.equal(abi.schema,'wasmc.lib-core-abi/v0');assert.equal(abi.artifact_sha256,files['artifact.wasm'].sha256);
  assert.deepEqual(abi.wit,{package:model.identity,sha256:files['lib.wit'].sha256,world});
  assert.deepEqual(WebAssembly.Module.imports(module),[],'pure imported value Root');assert.deepEqual(abi.imports,[]);
  assert.deepEqual(WebAssembly.Module.exports(module).map(row=>({name:row.name,kind:row.kind})),
    abi.exports.map(row=>({name:row.name,kind:row.kind==='function'?'function':row.kind})),'actual Core ABI exports');
  const [namespace,version]=model.identity.split('@');
  const expectedExports=apis.map(route=>namespace+'/'+route.slice(model.identity.length+1).replace('#','@'+version+'#'));
  const actualExports=WebAssembly.Module.exports(module).filter(row=>row.kind==='function'&&row.name.startsWith(namespace+'/')).map(row=>row.name).sort();
  assert.deepEqual(actualExports,expectedExports.sort(),'actual exported public Core API set');
  return {id:replacement.id,version:replacement.version,profile:replacement.profile,
    root:replacement.root,manifest_sha256:replacement.manifest_sha256,root_inventory_sha256:replacement.root_inventory_sha256,
    files,origin:custody.proof,wit:{identity:model.identity,world,sha256:files['lib.wit'].sha256,
      api_routes:apis,api_signatures:Object.fromEntries([...selected.routes].sort(([a],[b])=>a<b?-1:a>b?1:0))},
    discovery_metadata:{kind:'original-producer-build-spec',spec:descriptor(input,replacement.source.root+'/'+replacement.source.source_spec),
      description:custody.spec.skill.description,apis:custody.spec.apis},
    required_current_authoring_admission:true};
}

// A read/paths provider has the same trust boundary as verifyCurrentRelease's
// read provider. Production callers should use composeCurrentLibs below; tests
// can exercise byte changes without changing the immutable filesystem inputs.
export function composeCurrentLibData(input,options){
  exact(options,['schema','base','reused_ids','replacements']);assert.equal(options.schema,'wasmc.current-lib-composition-input/v1');
  exact(options.base,['catalog_path','catalog_sha256']);pin(options.base.catalog_sha256);
  assert.ok(Array.isArray(options.reused_ids)&&Array.isArray(options.replacements)&&options.replacements.length>0&&options.replacements.length<=64);
  const bytes=readBytes(input,options.base.catalog_path),catalog=checkedCurrentCatalog(bytes,options.base.catalog_sha256);
  const basePaths=input.paths('current-libs');
  const baseClosure=verifyCurrentRelease(bytes,options.base.catalog_sha256,input.read,basePaths);
  const cohort=parse(readBytes(input,catalog.cohort.path)),index=parse(readBytes(input,catalog.index.path));
  const ids=catalog.packages.map(row=>row.id),replaced=options.replacements.map(row=>row.id);
  assert.deepEqual(options.reused_ids,sorted(new Set(options.reused_ids)),'ordered unique explicit reused identities');
  assert.equal(new Set(replaced).size,replaced.length,'duplicate replacement identity');
  assert.deepEqual(sorted([...options.reused_ids,...replaced]),ids,'exact whole current cohort; no missing, duplicate or added identity');
  const baseLicense={schema:'wasmc.lib-license/v1',identifier:'WAsmC Research-Only Non-Commercial License 1.0',
    files:[descriptor(input,'LICENSE'),...cohort.release_notices.files]};
  const rows=[];
  for(const id of options.reused_ids){
    const row=catalog.packages.find(row=>row.id===id),spec=parse(readBytes(input,row.source.spec.path));
    assert.ok(!(spec.wit_dependencies??[]).some(dep=>replaced.includes(dep)),'reused Root depends on replaced WIT; rebuild/admit its dependency closure');
    const files=rootInventory(input,row.root);assert.equal(digest(files),row.root_inventory_sha256,'unchanged reused whole Root');
    rows.push({id,version:row.version,profile:row.profile,root:row.root,manifest_sha256:row.manifest_sha256,
      root_inventory_sha256:row.root_inventory_sha256,files,catalog_row:structuredClone(row),
      origin:{kind:'reused-public-root',catalog_sha256:options.base.catalog_sha256,
        original_receipt_sha256:cohort.refresh_receipt_sha256,producer_sha256:cohort.producer_sha256,
        original_q0_producer_pass:true,fresh_build_performed:false},
      wit:{identity:index.packages.find(p=>p.package_id===id).wit_route,world:row.wit_world,
        sha256:row.wit_sha256,api_routes:index.packages.find(p=>p.package_id===id).apis.map(p=>index.packages.find(v=>v.package_id===id).wit_route+'/'+p.route).sort()},
      required_current_authoring_admission:false});
  }
  for(const replacement of options.replacements){
    const row=importedRoot(input,replacement,baseLicense),previous=catalog.packages.find(p=>p.id===replacement.id);
    assert.notEqual(row.version,previous.version,'replacement requires a distinct explicit version');rows.push(row);
  }
  rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);assert.deepEqual(rows.map(row=>row.id),ids);
  // End-of-read fences cover the source packet, the replacement Root and every
  // reused Root. No earlier successful read can authorize a later changed byte.
  assert.equal(sha(readBytes(input,options.base.catalog_path)),options.base.catalog_sha256);
  assert.deepEqual(input.paths('current-libs'),basePaths,'base Root inventory changed during composition');
  for(const expected of [catalog.registry,catalog.index,catalog.cohort,...baseLicense.files,
    ...catalog.packages.flatMap(row=>[...Object.values(row.source),...row.files])])
    assert.deepEqual(descriptor(input,expected.path),expected,'base product input changed during composition');
  for(const row of rows){assert.deepEqual(rootInventory(input,row.root),row.files,'Root changed during composition');
    if(row.origin.kind==='imported-producer-root')assert.equal(digest(rootInventory(input,row.origin.source_root)),row.origin.source_inventory_sha256,'producer packet changed during composition');}
  const apis=rows.reduce((n,row)=>n+row.wit.api_routes.length,0);
  return {schema:'wasmc.current-lib-composition/v1',accepted:true,composition_complete:true,
    fresh_full_q0:false,public_admission:false,released:false,installation:false,
    base:{catalog:descriptor(input,options.base.catalog_path),cohort:catalog.cohort,index:catalog.index,
      original_closure:baseClosure},input_sha256:digest(options),rows,
    summary:{packages:rows.length,reused_roots:options.reused_ids.length,imported_roots:replaced.length,
      apis,entries:rows.length+apis,fresh_builds:0},
    remaining_gates:['current authoring identity admission for imported Roots','complete current WIT/index/catalog assembly',
      'independent assembled-product verification and actual Core Search','current resolve/install and ordinary App/SDK qualification',
      'release acceptance and immutable formal publication']};
}

export async function composeCurrentLibs(repo,options){
  repo=resolve(repo);const input={read:currentProductReader(repo),paths:prefix=>currentProductPaths(repo,prefix)};
  const receipt=composeCurrentLibData(input,options);
  // Reuse the existing physical Root verifier in addition to composition's
  // original-producer and actual-Core checks. It writes no files.
  for(const replacement of options.replacements){
    const verified=await verifyRoot(join(repo,safe(replacement.root)),replacement.id,replacement.version,replacement.profile);
    assert.equal(verified.manifest_sha256,replacement.manifest_sha256);
    assert.equal(digest(verified.files),replacement.root_inventory_sha256);
  }
  for(const row of receipt.rows)assert.deepEqual(await inventory(join(repo,row.root)),row.files,'physical end-of-read Root fence');
  return receipt;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);assert.equal(args.length,4,'--input <pinned-input.json> --input-sha256 <sha256>');
  assert.equal(args[0],'--input');assert.equal(args[2],'--input-sha256');pin(args[3]);
  const bytes=await readFile(resolve(args[1]));assert.equal(sha(bytes),args[3],'independent composition input pin');
  console.log(JSON.stringify(await composeCurrentLibs(process.cwd(),parse(bytes))));
}
