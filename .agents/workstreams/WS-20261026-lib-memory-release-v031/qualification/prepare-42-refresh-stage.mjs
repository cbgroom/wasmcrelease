// Assemble an isolated 42-Lib normal-refresh source stage. Std resource source
// is deliberately excluded until its independent producer input is recovered.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentProductReader} from '../../../../scripts/current-lib-release-v3.mjs';
const [rootArg,assemblyPin,nativeReceipt,nativePin,textReceipt,textPin,compressionReceipt,compressionPin,out,metadataMode,featureMode]=process.argv.slice(2);
assert.ok(metadataMode===undefined||metadataMode==='qualified-json-metadata');
assert.ok(featureMode===undefined||featureMode==='enable-json-raw-value');
assert.ok([rootArg,nativeReceipt,textReceipt,compressionReceipt,out].every(p=>isAbsolute(p??'')));
assert.ok([assemblyPin,nativePin,textPin,compressionPin].every(p=>/^[a-f0-9]{64}$/.test(p??'')));
assert.ok(!existsSync(out));
const root=resolve(rootArg),read=currentProductReader(root),sha=b=>createHash('sha256').update(b).digest('hex');
const repo=resolve(import.meta.dirname,'../../../..'),qual=join(repo,'.agents/workstreams/WS-20261026-lib-memory-release-v031/qualification');
const assemblyBytes=read('admission/current-composition-assembly-v1.json');assert.equal(sha(assemblyBytes),assemblyPin);
const assembly=JSON.parse(assemblyBytes);assert.equal(assembly.accepted,true);assert.equal(assembly.formal_release,false);
const catalogBytes=read('catalog/libs-current-v2.json');assert.equal(sha(catalogBytes),assembly.catalog_sha256);
const catalog=JSON.parse(catalogBytes);assert.equal(catalog.packages.length,43);
const validation=spawnSync(process.execPath,[resolve(repo,'scripts/validate-lib-refresh-v2-source.mjs'),'--candidate-assembly-sha256',assemblyPin],{cwd:root,encoding:'utf8',timeout:120000});
assert.equal(validation.status,0,validation.stderr);assert.equal(JSON.parse(validation.stdout).accepted,true);
const pinnedJson=(path,pin)=>{const b=readFileSync(path);assert.equal(sha(b),pin,`receipt drift ${path}`);return JSON.parse(b);};
const native=pinnedJson(nativeReceipt,nativePin),text=pinnedJson(textReceipt,textPin),compression=pinnedJson(compressionReceipt,compressionPin);
assert.equal(native.schema,'wasmc.native-refresh-stage/v1');assert.equal(native.assembly_sha256,assemblyPin);assert.equal(native.entries.length,20);
assert.equal(text.schema,'wasmc.text-refresh-source/v1');assert.equal(text.assembly_sha256,assemblyPin);
assert.equal(compression.schema,'wasmc.verified-authoring-source/v1');assert.equal(compression.id,'wasmc-compression');assert.equal(compression.assembly_sha256,assemblyPin);
const built=pinnedJson(join(qual,'built-rust-authoring-cohort-20261028.json'),'0dcb94d746265e1d5402c8ab44824476bb7ee258f2c9c3ca53ca48028d795dfb');
const rebound=pinnedJson(join(qual,'rebound-authoring-json-differential-20261028.json'),'801dba69eaeea246ebf96caf27edc699794bebd49ccfaa1f0cb86285b089dfa1');
const reexport=pinnedJson(join(qual,'reexport-authoring-recovery-20261028.json'),'0ba2fb7c77bf13c41302b96b4a914f90852e23badf28cb7813091d7f19d73bd0');
for(const x of [built,rebound,reexport])assert.equal(x.assembly_sha256,assemblyPin);
const recovered=[...built.additional_packages,...rebound.rebound_sources,...reexport.sources,compression,{...text,id:'wasmc-text'}];
assert.equal(recovered.length,15);assert.equal(new Set(recovered.map(x=>x.id)).size,15);
const files=new Map(),entries=[],details=[];
const add=(id,items,origin)=>{assert.ok(!entries.some(x=>x.id===id));for(const [name,bytes] of Object.entries(items)){
  assert.ok(!name.startsWith('/')&&!name.split('/').some(x=>!x||x==='..'));files.set(`libspec/${id}/${name}`,bytes);}
  entries.push({id,source:`libspec/${id}`});details.push({id,origin,files:Object.fromEntries(Object.entries(items).map(([k,v])=>[k,sha(v)]))});};
for(const row of recovered){assert.ok(isAbsolute(row.output));const items={};for(const name of ['lib.json','lib.wit','adapter.rs','delta.rs']){
  const bytes=readFileSync(join(row.output,name));assert.equal(sha(bytes),row.files[name],`${row.id}:${name}`);items[name]=bytes;}
  const spec=JSON.parse(items['lib.json']);assert.equal(spec.id,row.id);assert.equal(spec.version,catalog.packages.find(x=>x.id===row.id).version);add(row.id,items,'verified recovered Rust source');}
for(const row of native.entries){const items={};for(const [name,pin] of Object.entries(row.files)){
  const bytes=readFileSync(join(native.output,'libspec',row.id,name));assert.equal(sha(bytes),pin,`${row.id}:${name}`);items[name]=bytes;}
  const spec=JSON.parse(items['lib.json']);assert.equal(spec.id,row.id);assert.equal(spec.profile,'native');add(row.id,items,'verified native source');}
for(const row of catalog.packages){const b=read(row.source.spec.path);assert.equal(sha(b),row.source.spec.sha256);const spec=JSON.parse(b);
  if(spec.schema!=='wasmc.lib-refresh-source/v2'||spec.profile==='native')continue;
  assert.equal(row.source.spec.path,`libspec/${row.id}/lib.json`);assert.equal(spec.id,row.id);assert.equal(spec.version,row.version);
  const items={'lib.json':b};for(const n of ['lib.wit','adapter.rs','delta.rs'])items[n]=read(`libspec/${row.id}/${n}`);
  assert.equal(sha(items['lib.wit']),row.source.wit.sha256);add(row.id,items,'verified direct authoring source');}
const expected=catalog.packages.map(x=>x.id).filter(x=>x!=='wasmc-std').sort();assert.equal(expected.length,42);
assert.deepEqual(entries.map(x=>x.id).sort(),expected);
if(metadataMode==='qualified-json-metadata') {
  // Reuse the exact prior qualified JSON build's shorter ecosystem label. This
  // changes no other API metadata or Rust code; it does not fix the producer's
  // separate metadata field limit, and the original failed run is retained.
  const referenceBytes=readFileSync(join(repo,'.agents/workstreams/WS-20261026-lib-memory-release-v031/candidate-sources/wasmc-json/0.2.1/lib.build.json'));
  assert.equal(sha(referenceBytes),'ce849aa35ba3b6bab610bc11759b96d8ef3922d48f99f9b9b52c67d945712005');
  const reference=JSON.parse(referenceBytes),path='libspec/wasmc-json/lib.json',original=JSON.parse(files.get(path));
  const byName=new Map(reference.apis.map(x=>[x.api,x]));assert.equal(byName.size,original.apis.length);
  original.apis=original.apis.map(api=>{const prior=byName.get(api.api);assert.ok(prior);
    assert.deepEqual({...api,ecosystem:prior.ecosystem},prior);return {...api,ecosystem:prior.ecosystem};});
  const bytes=Buffer.from(JSON.stringify(original,null,2)+'\n');files.set(path,bytes);
  const row=details.find(x=>x.id==='wasmc-json');row.files['lib.json']=sha(bytes);row.metadata='prior qualified JSON build ecosystem labels; other metadata and Rust unchanged';
}
const inputs=join(repo,'.agents/workstreams/WS-20261026-lib-memory-release-v031/producer/inputs');
const policyBytes=readFileSync(join(inputs,'cohort-rust-policy.json'));assert.equal(sha(policyBytes),'a4d6c4ab47e2926e9eea81de33901b8383f1216c5af3457b99df83bed3ef2616');
const policy=JSON.parse(policyBytes);policy.toolchain='stable';policy.edition='2024';policy.dependencies.memchr='{ version = "=2.8.0", default-features = false, features = ["std"] }';
if(featureMode==='enable-json-raw-value') {assert.equal(policy.dependencies.serde_json,'"=1.0.151"');policy.dependencies.serde_json='{ version = "=1.0.151", features = ["raw_value"] }';}
const shared=readFileSync(join(inputs,'shared/data-arrow.rs'));assert.equal(sha(shared),'856d077a9a727a8230b0d4475cd48cbbeee71d7eda53e8650dc4034afc3f1107');files.set('libspec/shared/data-arrow.rs',shared);
const lock=readFileSync(join(inputs,'eight.Cargo.lock'));assert.equal(sha(lock),'9da7bf5fb19e18d1c2df034270a18b8cb2a6450aaf2fb2692ce911db27a155e5');
files.set('libspec/rust-policy.json',Buffer.from(JSON.stringify(policy,null,2)+'\n'));files.set('libspec/Cargo.lock',lock);
files.set('libspec/registry.json',Buffer.from(JSON.stringify({schema:'wasmc.lib-refresh-registry/v2',authority:'libspec',libs:entries},null,2)+'\n'));
for(const n of ['lib-refresh-v2.mjs','lib-refresh-runner-v2.mjs','lib-refresh-cache-v2.mjs','lib-refresh-native-v2.mjs','lib-refresh-resource-core-v2.mjs','lib-refresh-upstream-source-v2.mjs'])files.set(`scripts/${n}`,readFileSync(join(repo,'scripts',n)));
assert.equal(sha(read('admission/current-composition-assembly-v1.json')),assemblyPin);assert.equal(sha(read('catalog/libs-current-v2.json')),assembly.catalog_sha256);
mkdirSync(out);for(const [name,bytes] of files){const path=join(out,name);mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,bytes,{flag:'wx'});}
console.log(JSON.stringify({schema:'wasmc.42-refresh-stage/v1',assembly_sha256:assemblyPin,catalog_sha256:assembly.catalog_sha256,entries:details,edition:'2024',metadata_mode:metadataMode??'original',feature_mode:featureMode??'original',excluded:['wasmc-std'],output:out,formal_release:false}));
