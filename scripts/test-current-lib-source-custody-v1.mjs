// Source admission against original immutable producer bytes, with in-memory
// faults. The preceding candidate report is an independently pinned fixture,
// not a substitute for executing the validators below.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentProductReader,currentProductPaths,checkedCurrentCatalog,verifyCurrentRelease} from './current-lib-release-v3.mjs';
import {currentIndex} from './lib-current-index-v2.mjs';
import {generatedLib} from './generated-lib-v2.mjs';
import {sha,digest} from './lib-refresh-cache-v2.mjs';
import {admitOriginalProducerSourceData,verifyOriginalProducerSourceData,
  buildCurrentCompositionLineageData,verifyCurrentCompositionLineageData} from './current-lib-source-custody-v1.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url)),read=currentProductReader(repo);
const fixturePath='admission/ordinary-canonical-host-v024/root-admission-next.json',fixtureBytes=read(fixturePath);
assert.equal(sha(fixtureBytes),'a38ca55e3029482811ae15ddd51409633c16db6e25d02f7436c6a1c8c8c212aa');
const fixture=JSON.parse(fixtureBytes),options=fixture.composition_input,composition=fixture.composition;
const baseVerification={checkedCurrentCatalog,verifyCurrentRelease};
const compositionSha='525cc9eb24c1041650569de20e87bad3dd3828963da940c653ce19ca05badd61';
assert.equal(digest(composition),compositionSha);
const expected=options.replacements[0],catalog=JSON.parse(read(options.base.catalog_path)),data=new Map();
const paths=new Set([options.base.catalog_path,catalog.registry.path,catalog.index.path,catalog.cohort.path,'LICENSE',
  ...currentProductPaths(repo),...currentProductPaths(repo,'licenses'),
  ...currentProductPaths(repo,expected.root),...currentProductPaths(repo,expected.source.root)]);
for(const row of catalog.packages)for(const pin of Object.values(row.source))paths.add(pin.path);
for(const path of paths)data.set(path,read(path));
const input=map=>({read:path=>{assert.ok(map.has(path),'missing input '+path);return map.get(path);},
  paths:prefix=>[...map.keys()].filter(path=>path.startsWith(prefix+'/')).sort()});
const provider=input(data),admitted=admitOriginalProducerSourceData(provider,expected),results=[];
assert.equal(admitted.source.schema,'wasmc.current-original-producer-source/v1');
assert.equal(admitted.admission.source_custody_admitted_for_current_composition,true);
assert.equal(admitted.source.source_spec.sha256,'283ce7886cdca94d53b7a646b403471c0482be502be933e0a5a3e7e072ce9820');
assert.equal(admitted.source.producer.custody.path,expected.source.root+'/producer-custody.json');
assert.equal(admitted.source.producer.custody.sha256,'6ef9091ebd48682c2e34419e558da0fa7bbbd56c77a6141ba8dae32e520432d8');
assert.equal(admitted.source.producer.report.json_pointer,'/original_producer_report');
assert.equal(admitted.source.producer.report.canonical_json_sha256,'973f3f6cc4170c3c7fbd2172a711faee211d9a4ae02f118b68d974dd4b9f49e5');
assert.equal(admitted.source.producer.original_receipt_bytes_verified,false);
assert.equal(admitted.admission.public_admission,false);assert.equal(admitted.admission.current_directory_admitted,false);
assert.equal(admitted.source.root.manifest_sha256,'3bfaa6449d8800aaa98a7068ceccaae3527490f6cb7773b53b70195e9c7eaadc');
assert.equal(admitted.source.root.files.length,18);assert.equal(admitted.source.apis.length,13);
results.push({name:'actual closed source283/producer report/Root005 admission with18 exact files and13 APIs',pass:true});
const sourceReject=(name,mutate)=>{
  const source=structuredClone(admitted.source);mutate(source);
  assert.throws(()=>verifyOriginalProducerSourceData(provider,expected,source));results.push({name,pass:true,rejected:true});
};
sourceReject('closed source rejects unknown fields',s=>s.accepted=true);
sourceReject('original source cannot masquerade as oldv2',s=>s.schema='wasmc.lib-refresh-source/v2');
sourceReject('source cannot replace original spec283',s=>s.source_spec.sha256='0'.repeat(64));
sourceReject('source cannot replace original canonical blob',s=>s.canonical_source.git_blob='0'.repeat(40));
sourceReject('source cannot replace actual producer report container',s=>s.producer.report.container.path='made-up-report.json');
sourceReject('source cannot replace actual producer report value',s=>s.producer.report.canonical_json_sha256='0'.repeat(64));
sourceReject('source cannot claim raw original receipt bytes read',s=>s.producer.original_receipt_bytes_verified=true);
sourceReject('source cannot claim fresh full Q0',s=>s.fresh_full_q0=true);
sourceReject('source cannot rebind Root inventory',s=>s.root.inventory_sha256='0'.repeat(64));
sourceReject('source cannot omit original generated SDK file',s=>s.root.files.pop());
sourceReject('source cannot omit original exported API',s=>s.apis.pop());
const inputReject=(name,mutate)=>{
  const map=new Map(data),e=structuredClone(expected);mutate(map,e);
  assert.throws(()=>admitOriginalProducerSourceData(input(map),e));results.push({name,pass:true,rejected:true});
};
inputReject('actual original Rust implementation drift rejected',map=>{
  const path=expected.source.root+'/'+expected.source.logic;map.set(path,Buffer.concat([map.get(path),Buffer.from('\nchanged')]));
});
inputReject('actual original WIT drift rejected',map=>{
  const path=expected.source.root+'/'+expected.source.wit;map.set(path,Buffer.concat([map.get(path),Buffer.from('\nchanged')]));
});
inputReject('actual Root binary drift rejected',map=>{
  const path=expected.root+'/artifact.wasm',bytes=Buffer.from(map.get(path));bytes[bytes.length-1]^=1;map.set(path,bytes);
});
inputReject('wrong independent producer driver rejected',(map,e)=>e.source.authority.driver_sha256='0'.repeat(64));
inputReject('wrong independent original receipt pin rejected',(map,e)=>e.source.authority.original_receipt_sha256='0'.repeat(64));
const lineage=buildCurrentCompositionLineageData(provider,options,composition,compositionSha,baseVerification);
verifyCurrentCompositionLineageData(provider,options,composition,compositionSha,lineage,baseVerification);
assert.equal(lineage.rows.length,42);assert.equal(lineage.admitted_original_sources.length,1);
assert.equal(lineage.rows.filter(row=>row.source_schema==='wasmc.lib-refresh-source/v2').length,41);
assert.equal(lineage.rows.filter(row=>row.source_schema==='wasmc.current-original-producer-source/v1').length,1);
assert.equal(lineage.fresh_builds,0);assert.equal(lineage.fresh_full_q0,false);
results.push({name:'actual complete42-row lineage preserves41 oldv2 sources and admits exact original producer source',pass:true});
const lineageReject=(name,mutate)=>{
  const changed=structuredClone(lineage);mutate(changed);
  assert.throws(()=>verifyCurrentCompositionLineageData(provider,options,composition,compositionSha,changed,baseVerification));results.push({name,pass:true,rejected:true});
};
lineageReject('closed lineage rejects unknown fields',l=>l.q0_accepted=true);
lineageReject('lineage cannot masquerade as old full Q0',l=>l.schema='wasmc.lib-refresh-receipt/v2');
lineageReject('lineage cannot omit an unchanged Root',l=>l.rows.shift());
lineageReject('lineage cannot duplicate an unchanged Root',l=>l.rows.push(l.rows[0]));
lineageReject('lineage cannot relabel original producer as oldv2',l=>l.rows.find(row=>row.id==='wasmc-json').source_schema='wasmc.lib-refresh-source/v2');
lineageReject('lineage cannot replace original source admission',l=>l.admitted_original_sources[0].admission.source_sha256='0'.repeat(64));
lineageReject('lineage cannot claim physical current directory admission',l=>l.current_directory_admitted=true);
lineageReject('lineage cannot claim a new full producer run',l=>l.fresh_full_q0=true);
const compositionReject=(name,mutate)=>{
  const changed=structuredClone(composition);mutate(changed);
  assert.throws(()=>buildCurrentCompositionLineageData(provider,options,changed,digest(changed),baseVerification));
  results.push({name,pass:true,rejected:true});
};
compositionReject('self-rehashed composition cannot forge reused producer',c=>c.rows[0].origin.producer_sha256='0'.repeat(64));
compositionReject('self-rehashed composition cannot relabel reused version',c=>c.rows[0].version='99.0.0');
compositionReject('self-rehashed composition cannot rebind original source',c=>c.rows.find(row=>row.id==='wasmc-json').origin.source_spec_sha256='0'.repeat(64));
compositionReject('self-rehashed composition cannot rebind imported Root',c=>c.rows.find(row=>row.id==='wasmc-json').root_inventory_sha256='0'.repeat(64));
assert.throws(()=>buildCurrentCompositionLineageData(provider,options,composition,'0'.repeat(64),baseVerification));
results.push({name:'independent composition receipt pin remains mandatory',pass:true,rejected:true});

// Exercise the unchanged legacy entrypoints rather than asserting their source
// text. Fixtures are isolated temporary directories, never the real libspec.
const oldIndex=await currentIndex(repo);assert.equal(oldIndex.summary.packages,42);assert.equal(oldIndex.summary.apis,236);
assert.equal(oldIndex.index.packages.find(row=>row.package_id==='wasmc-json').version,'0.0.1');
results.push({name:'actual existing v2 current authoring still selects original42/236 includingJSON001',pass:true});
const temp=await mkdtemp(join(tmpdir(),'wasmc-source-custody-controls-'));
try{
  await mkdir(join(temp,'libspec/wasmc-json'),{recursive:true});
  await writeFile(join(temp,'libspec/registry.json'),JSON.stringify({schema:'wasmc.lib-refresh-registry/v2',libs:[{id:'wasmc-json',source:'libspec/wasmc-json'}]}));
  await writeFile(join(temp,'libspec/rust-policy.json'),JSON.stringify({schema:'wasmc.lib-refresh-rust-policy/v2',target:'wasm32-unknown-unknown'}));
  await writeFile(join(temp,'libspec/Cargo.lock'),'isolated schema fixture');
  await writeFile(join(temp,'libspec/wasmc-json/lib.json'),JSON.stringify(admitted.source));
  await writeFile(join(temp,'libspec/wasmc-json/lib.wit'),read(expected.source.root+'/'+expected.source.wit));
  await assert.rejects(()=>currentIndex(temp),/wasmc.lib-refresh-source\/v2/);
  results.push({name:'unchanged oldv2 index rejects new source schema without explicit adapter',pass:true,rejected:true});
  for(const receipt of [admitted.source,lineage]){
    await writeFile(join(temp,'refresh-receipt.json'),JSON.stringify(receipt));
    await assert.rejects(()=>generatedLib('wasmc-json',temp),/wasmc.lib-refresh-receipt\/v2/);
    results.push({name:'unchanged old full-Q0 loader rejects '+receipt.schema,pass:true,rejected:true});
  }
}finally{await rm(temp,{recursive:true,force:true});}
for(const file of admitted.source.root.files)assert.equal(sha(read(file.path)),file.sha256,'original Root unchanged');
assert.equal(sha(read(fixturePath)),sha(fixtureBytes),'previous candidate report unchanged');
console.log(JSON.stringify({schema:'wasmc.current-source-custody-controls/v1',accepted:true,tests:results.length,
  source_schema:admitted.source.schema,source_sha256:admitted.admission.source_sha256,lineage_sha256:digest(lineage),
  producer_report:admitted.source.producer.report,original_receipt_bytes_verified:false,
  source_custody_admitted_for_current_composition:true,current_directory_admitted:false,public_admission:false,fresh_full_q0:false,
  selected:lineage.rows.length,oldv2_sources:41,original_producer_sources:1,results}));
