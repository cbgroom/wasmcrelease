import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir,mkdtemp,readFile,writeFile,cp,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assembleComposedCurrentProduct} from './current-lib-composition-release-v1.mjs';
import {currentProductReader,hash} from './current-lib-release-v3.mjs';
import {isExactDeclaredNotice} from './declared-thirdparty-notices.mjs';
import {collectCurrentDeclaredThirdPartyNotices} from './current-license-policy-v3.mjs';
const catalog=readFileSync('catalog/libs-current-v2.json');
const policy=JSON.parse(readFileSync('catalog/current-v3-license-policy.json'));
const read=async path=>readFileSync(path);
const notices=await collectCurrentDeclaredThirdPartyNotices(catalog,policy,read);
const originalCohort=JSON.parse(await read(JSON.parse(catalog).cohort.path));
if(originalCohort.schema==='wasmc.public-current-refresh-cohort/v1')assert.equal(notices.size,270);
else assert.ok(notices.size>270,'composed graph notice copies are explicitly bound');
const paths=[...notices.keys()];
let rejected=0;
for(const key of ['catalog_sha256','package_authority_commit','version']) {
  const changed={...policy,[key]:key==='version'?policy.version+'-mismatch':'0'.repeat(key==='catalog_sha256'?64:40)};
  assert.notEqual(changed[key],policy[key],'negative control must change the selected identity');
  await assert.rejects(()=>collectCurrentDeclaredThirdPartyNotices(catalog,changed,read));rejected++;
}
for(const target of ['licenses/DEPENDENCY-NOTICES-001.txt',paths.find(p=>p.startsWith('current-libs/')),paths.find(p=>p.startsWith('standard/'))]) {
  await assert.rejects(()=>collectCurrentDeclaredThirdPartyNotices(catalog,policy,async path=>{
    const b=await read(path);if(path!==target)return b;
    const changed=Buffer.from(b);changed[0]^=1;return changed;
  }));rejected++;
}
for(const target of ['LICENSE',JSON.parse(catalog).cohort.path]) {
  await assert.rejects(()=>collectCurrentDeclaredThirdPartyNotices(catalog,policy,async path=>{
    const b=await read(path);return path===target?Buffer.concat([b,Buffer.from('\nchanged')]):b;
  }));rejected++;
}
assert.equal(rejected,8);
const repo=fileURLToPath(new URL('../',import.meta.url)),parent=join(process.env.HOME,'.local/state/wasmcrelease');
await mkdir(parent,{recursive:true});const state=await realpath(await mkdtemp(join(parent,'composition-notices-')));
try{
  let product=repo;
  if(originalCohort.schema==='wasmc.public-current-refresh-cohort/v1'){
    const bytes=await readFile(join(repo,'admission/ordinary-canonical-host-v024/root-admission-next.json'));
    assert.equal(hash(bytes),'a38ca55e3029482811ae15ddd51409633c16db6e25d02f7436c6a1c8c8c212aa');
    product=join(state,'product');await assembleComposedCurrentProduct(repo,{compositionOptions:JSON.parse(bytes).composition_input,
      version:'0.0.24',artifactCommit:JSON.parse(catalog).package_authority_commit,out:product});
    for(const mirror of policy.standard_root_mirrors)await cp(join(repo,mirror.root),join(product,mirror.root),{recursive:true});
  }
  const get=currentProductReader(product),composedBytes=get('catalog/libs-current-v2.json'),current=JSON.parse(composedBytes);
  const selected={...policy,version:current.version,catalog_sha256:hash(composedBytes),package_authority_commit:current.package_authority_commit};
  const co=JSON.parse(get(current.cohort.path)),prefix=co.input_prefix;
  const composed=await collectCurrentDeclaredThirdPartyNotices(composedBytes,selected,async path=>get(path));
  for(const path of composed.keys())assert.equal(isExactDeclaredNotice(path,get(path),composed),true,'actual consumer notice classification '+path);
  const imported=co.source_lineage.admitted_original_sources[0].source,row=current.packages.find(p=>p.id===imported.id);
  const manifest=JSON.parse(get(row.root+'/lib.json')),producerSpec=JSON.parse(get(prefix+'/'+imported.source_spec.path));
  assert.equal(imported.producer.original_receipt_bytes_verified,false);assert.deepEqual(manifest.license,producerSpec.license);
  for(const pin of manifest.license.files.filter(pin=>pin.path!=='LICENSE'))for(const root of [row.root,prefix+'/'+imported.root.locator]){
    assert.deepEqual(composed.get(root+'/'+pin.path),{bytes:pin.bytes,sha256:pin.sha256,manifest_sha256:row.manifest_sha256,catalog_sha256:selected.catalog_sha256});
  }
  const base=JSON.parse(get(prefix+'/'+co.input_options.base.catalog_path));
  const old=base.packages.find(p=>p.id===row.id);
  assert.equal([...composed.keys()].some(path=>path.startsWith(old.root+'/')),false,'replaced old current Root is not declared as active');
  assert.ok([...composed.keys()].some(path=>path.startsWith(prefix+'/'+old.root+'/')),'sealed original base Root notices remain exact declared copies');
  let composedRejected=0;const outcomes=[];
  const reject=async(name,overrides)=>{
    await assert.rejects(()=>collectCurrentDeclaredThirdPartyNotices(composedBytes,selected,async path=>{
      if(overrides.has(path)){const value=overrides.get(path);assert.ok(value,'missing original notice input');return value;}return get(path);
    }));outcomes.push({name,rejected:true});composedRejected++;
  };
  const notice=manifest.license.files.find(pin=>pin.path!=='LICENSE').path;
  const targets=['licenses/DEPENDENCY-NOTICES-001.txt',prefix+'/licenses/DEPENDENCY-NOTICES-001.txt',
    row.root+'/'+notice,prefix+'/'+imported.root.locator+'/'+notice,prefix+'/'+old.root+'/'+notice,
    policy.standard_root_mirrors[0].root+'/licenses/DEPENDENCY-NOTICES-001.txt'];
  for(const path of targets){
    const changed=Buffer.from(get(path));changed[0]^=1;
    await reject('actual notice byte drift '+path,new Map([[path,changed]]));
    await reject('missing notice '+path,new Map([[path,null]]));
  }
  await reject('missing original producer spec',new Map([[prefix+'/'+imported.source_spec.path,null]]));
  const forged=structuredClone(co);forged.source_lineage.admitted_original_sources[0].source.producer.original_receipt_bytes_verified=true;
  await reject('cohort cannot claim original receipt bytes read',new Map([[current.cohort.path,Buffer.from(JSON.stringify(forged)+'\n')]]));
  const blank=structuredClone(co);blank.source_lineage.admitted_original_sources=[];
  await reject('cohort cannot omit imported Root notice obligation',new Map([[current.cohort.path,Buffer.from(JSON.stringify(blank)+'\n')]]));
  for(const [name,mutate]of [
    ['self-rehashed lineage cannot remove imported source notices',value=>{value.source_lineage.admitted_original_sources=[];}],
    ['self-rehashed cohort cannot impersonate original fullQ0',value=>{value.schema='wasmc.public-current-refresh-cohort/v1';}],
    ['self-rehashed cohort cannot invent unrelated notice grant',value=>{value.release_notices={manifest:{path:'licenses/not-original.json'},files:[]};}]
  ]){
    const changed=structuredClone(co);mutate(changed);changed.source_lineage_sha256=hash(JSON.stringify(changed.source_lineage));
    const cohortBytes=Buffer.from(JSON.stringify(changed)+'\n'),replacement=structuredClone(current);
    replacement.cohort={path:current.cohort.path,bytes:cohortBytes.length,sha256:hash(cohortBytes)};
    const bytes=Buffer.from(JSON.stringify(replacement)+'\n'),rebound={...selected,catalog_sha256:hash(bytes)};
    await assert.rejects(()=>collectCurrentDeclaredThirdPartyNotices(bytes,rebound,async path=>path===current.cohort.path?cohortBytes:get(path)));
    outcomes.push({name,rejected:true});composedRejected++;
  }
  const report={accepted:true,current_roots:42,declared_notice_files:notices.size,negative_controls:rejected,
    composed_notice_files:composed.size,composed_negative_controls:composedRejected,strict_original_base_and_current_graph:true,all_declared_rows_real_bytes_exact:true,
    original_receipt_bytes_verified:false,fresh_builds:0,product,imported_root:{id:row.id,version:row.version,notice_files:manifest.license.files.length-1},
    legal_compatibility:false,linked_dependency_completeness:false,formal_release:false,outcomes};
  await writeFile(join(state,'receipt.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,state_root:state}));
}catch(error){await writeFile(join(state,'failure.json'),JSON.stringify({message:error.message,stack:error.stack},null,2)+'\n');throw error;}
