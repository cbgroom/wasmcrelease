// Independent actual-validator regression; fixtures are not real Lib admission.
import assert from 'node:assert/strict';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {instantiateLibSearch} from '../examples/lib-search/client.mjs';
import {makeRouteFixture,makeFixtureIndex,makeFixtureSearchCore,routeTargets,routeSha} from './test-future-current-route-fixture.mjs';

const args=process.argv.slice(2);
assert(args.length===0||args.length===2&&args[0]==='--candidate-module'&&isAbsolute(args[1]),'usage: test-future-current-route.mjs [--candidate-module ABS_PATH]');
const candidateModule=args.length?pathToFileURL(args[1]):new URL('./release-candidate.mjs',import.meta.url);
const validator=await import(candidateModule.href);
assert.equal(typeof validator.validateCandidate,'function','an actual public candidate validator is required');
const fields=entry=>Object.fromEntries(['identity','signature','skill_path','wit_path','artifact_path'].map(key=>[key,entry[key]]));
let observableCalls=0,positives=0,negatives=0;
function independentlyExecute(f){
  const core=f.read(f.search.root+'/artifact.wasm');
  assert.equal(WebAssembly.Module.imports(new WebAssembly.Module(core)).length,0);
  const api=instantiateLibSearch(core,{artifact_sha256:routeSha(core),index_sha256:routeSha(f.read(f.indexPath)),wit_package:f.search.wit_package});
  assert.deepEqual(api.snapshot(),{format_version:1,entry_count:f.expectedEntries.length,index_sha256:routeSha(f.read(f.indexPath))});observableCalls++;
  for(const entry of f.expectedEntries){assert.deepEqual(api.lookup(entry.identity),fields(entry));observableCalls++;}
  assert.equal(api.lookup('wasmc:unknown@99.99.99/not-here#missing'),null);observableCalls++;
  for(const include_historical of [false,true])for(const limit of [1,17,64]){
    const hits=[];
    for(let offset=0;offset<f.expectedEntries.length+limit;offset+=limit){const page=api.search({text:'',include_historical},offset,limit);assert(page.ok);assert(page.ok.length<=limit);hits.push(...page.ok);observableCalls++;}
    assert.deepEqual(hits,f.expectedEntries.map(fields),'real empty-query pagination must preserve every full hit field');
  }
  assert.deepEqual(api.search({text:'unsupported-nonempty-query',include_historical:false},0,64),{error:'invalid-query'});observableCalls++;
  for(const limit of [0,65,0xffffffff]){assert.deepEqual(api.search({text:'',include_historical:false},0,limit),{error:'invalid-limit'});observableCalls++;}
  assert.deepEqual(api.search({text:'',include_historical:false},0xffffffff,64),{ok:[]});observableCalls++;
  console.log(JSON.stringify({fixture_executed:f.variant,entries:f.expectedEntries.length,core_bytes:core.length,core_sha256:routeSha(core),index_sha256:routeSha(f.read(f.indexPath)),imports:0,scope:'actual synthetic Core/public consumer observable fixture only'}));
}
// Runtime fixture validation precedes the baseline negative. A missing export,
// fake runtime hook or broken Wasm therefore cannot impersonate the old bug.
for(const variant of ['a','b'])independentlyExecute(makeRouteFixture({variant}));
function rejected(label,mutate){
  const f=makeRouteFixture();const options=mutate(f)??{};
  assert.throws(()=>validator.validateCandidate(f.candidate,options.read??f.read),options.pattern,`actual candidate validator accepted ${label}`);
  if(options.assertAfter)options.assertAfter();negatives++;
  console.log(JSON.stringify({rejected:label}));
}
// FIRST candidate assertion: unchanged checker actually fails on START/main137
// accepting the genuine old22/140 closure with selected current18 identities.
rejected('legacy22/140 closure instead of selected18',f=>{f.candidate.lib_route_closure=structuredClone(f.legacyClosure);f.refresh();});

function accepted(label,f){
  assert.equal(validator.validateCandidate(f.candidate,f.read),true,label);
  if(typeof validator.buildFutureCurrentClosure==='function')assert.deepEqual(validator.buildFutureCurrentClosure(f.candidate,f.read),f.candidate.lib_route_closure,'independent hand-derived expected closure');
  positives++;console.log(JSON.stringify({accepted_fixture:label,selected_packages:18,api_routes:95}));
}
for(const variant of ['a','b'])accepted('renamed-'+variant,makeRouteFixture({variant}));

// No new function: the existing hand-authored result<T> API also has an
// independently specified bare-result spelling/dual-slot canonical positive.
{
  const f=makeRouteFixture(),row=f.packages[0];
  f.put(row.root+'/lib.wit',f.read(row.root+'/lib.wit').toString().replace('-> result<u32>;','-> result;'));
  const entry=f.expectedEntries.find(e=>e.identity.endsWith('#outcome'));entry.signature='outcome:func()->result<_,_>';entry.search_text=entry.identity+' '+entry.signature;
  f.setIndex(f.expectedEntries);f.rebuildSearch();f.rebind();independentlyExecute(f);accepted('bare-result-dual-slot',f);
}
// Optional Component identity is exercised, not Component runtime or SDK.
{
  const f=makeRouteFixture(),m=f.json(f.search.root+'/lib.json'),component=Buffer.from([0,97,115,109,13,0,1,0]);
  f.put(f.search.root+'/component.wasm',component);m.component={path:'component.wasm',format:'component-wasm',bytes:component.length,sha256:routeSha(component)};
  m.bindings.rust_component={cargo_toml:structuredClone(m.bindings.rust_core.cargo_toml)};f.write(f.search.root+'/lib.json',m);f.rebind();accepted('declared-component-identity',f);
}

// Reseal independently authored authority data to isolate semantic cases. A
// separate self-rehash test below deliberately leaves the reviewed policy pin.
function sealAuthorityOnly(f,{pin=true}={}){
  const receipt=f.json(f.receiptPath);receipt.catalog.sha256=routeSha(f.read(f.catalogPath));receipt.index.bytes=f.read(f.indexPath).length;receipt.index.sha256=routeSha(f.read(f.indexPath));
  f.write(f.receiptPath,receipt);if(pin){const p=f.json(f.policyPath);p.future_route_authority.sha256=routeSha(f.read(f.receiptPath));f.write(f.policyPath,p);}
  f.candidate.lib_route_closure.authority_receipt.sha256=routeSha(f.read(f.receiptPath));f.candidate.lib_route_closure.catalog.sha256=receipt.catalog.sha256;f.candidate.lib_route_closure.search_index.sha256=receipt.index.sha256;f.refresh();
}
function inventoryOnly(f,path){
  f.refresh();f.candidate.product_files=f.candidate.product_files.filter(x=>x.path!==path);f.candidate.product_set_sha256=routeSha(JSON.stringify(f.candidate.product_files));
  let outside=0;return {read:p=>{if(p===path)outside++;return f.read(p);},assertAfter:()=>assert.equal(outside,0,'an omitted obligation must not read checkout fallback bytes')};
}
for(const id of routeTargets){
  rejected(id+': omitted inventoried WIT with checkout bytes retained',f=>inventoryOnly(f,f.packages.find(p=>p.id===id).root+'/lib.wit'));
  rejected(id+': WIT package/version differs from selected metadata',f=>{const row=f.packages.find(p=>p.id===id);f.put(row.root+'/lib.wit',f.read(row.root+'/lib.wit').toString().replace('package '+row.wit_package+';','package '+row.wit_package.replace('@9.1.0','@9.1.1')+';'));f.rebind();});
  rejected(id+': selected-world export omitted',f=>{const row=f.packages.find(p=>p.id===id);f.put(row.root+'/lib.wit',f.read(row.root+'/lib.wit').toString().replace('export aux;',''));f.rebind();});
  rejected(id+': selected ordinary signature changed',f=>{const row=f.packages.find(p=>p.id===id);f.put(row.root+'/lib.wit',f.read(row.root+'/lib.wit').toString().replace('run: func(n: u32) -> u32;','run: func(n: u32) -> u64;'));f.rebind();});
  rejected(id+': selected API omitted from new licensed index',f=>{const row=f.packages.find(p=>p.id===id),victim=f.expectedEntries.find(e=>e.signature&&e.package_identity===row.wit_package),entries=f.expectedEntries.filter(e=>e.identity!==victim.identity);f.setIndex(entries);f.rebuildSearch({entries});f.rebind();});
  rejected(id+': API signature drift with matching identity',f=>{const row=f.packages.find(p=>p.id===id),entries=structuredClone(f.expectedEntries),victim=entries.find(e=>e.signature&&e.package_identity===row.wit_package);victim.signature='substitution:func()->u64';victim.search_text=victim.identity+' '+victim.signature;f.setIndex(entries);f.rebuildSearch({entries});f.rebind();});
  rejected(id+': wrong hit path despite rehashed catalog/index',f=>{const row=f.packages.find(p=>p.id===id),entries=structuredClone(f.expectedEntries),victim=entries.find(e=>e.package_identity===row.wit_package);victim.skill_path=row.root+'/lib.wit';f.setIndex(entries);f.rebuildSearch({entries});f.rebind();});
}
for(const pathName of ['receiptPath','indexPath'])rejected('missing inventory '+pathName+' retains reader bytes',f=>inventoryOnly(f,f[pathName]));
rejected('Std companion outside product inventory',f=>inventoryOnly(f,f.packages.find(p=>p.id==='wasmc-std').companion.path));
rejected('Std companion current bytes drift',f=>{const p=f.packages.find(p=>p.id==='wasmc-std').companion.path;f.put(p,Buffer.from('changed companion'));f.refresh();});
rejected('legacy catalog/index receipt under current policy',f=>{const r=f.json(f.receiptPath);r.catalog=f.legacyClosure.catalog;r.index={...f.legacyClosure.search_index,bytes:f.read(f.legacyClosure.search_index.path).length};f.write(f.receiptPath,r);const p=f.json(f.policyPath);p.future_route_authority.sha256=routeSha(f.read(f.receiptPath));f.write(f.policyPath,p);f.refresh();});
rejected('extra package route',f=>{const e={...f.expectedEntries[0],identity:'wasmc:unknown@9.1.0',package_identity:'wasmc:unknown@9.1.0',signature:'',search_text:'wasmc:unknown@9.1.0 unknown fixture'};const entries=[...f.expectedEntries,e].sort((a,b)=>Buffer.compare(Buffer.from(a.identity),Buffer.from(b.identity)));f.setIndex(entries);f.rebuildSearch({entries});f.rebind();});
rejected('duplicate API identity',f=>{f.setIndex([...f.expectedEntries,f.expectedEntries.find(e=>e.signature)]);f.rebind();});
rejected('API parent points to itself',f=>{const b=Buffer.from(f.read(f.indexPath)),strings=b.readUInt16LE(4),rows=8+(strings+1)*4,i=f.expectedEntries.findIndex(e=>e.signature);b.writeUInt16LE(i,rows+i*15+1);f.put(f.indexPath,b);f.rebuildSearch();f.rebind();});
rejected('historical flag silently hides selected current API',f=>{const b=Buffer.from(f.read(f.indexPath)),strings=b.readUInt16LE(4),rows=8+(strings+1)*4,i=f.expectedEntries.findIndex(e=>e.signature);b[rows+i*15]|=2;f.put(f.indexPath,b);f.rebuildSearch();f.rebind();});
rejected('unknown LSI flags',f=>{const b=Buffer.from(f.read(f.indexPath)),rows=8+(b.readUInt16LE(4)+1)*4;b[rows]|=128;f.put(f.indexPath,b);f.rebuildSearch();f.rebind();});
rejected('package/API class conflicts with signature',f=>{const b=Buffer.from(f.read(f.indexPath)),rows=8+(b.readUInt16LE(4)+1)*4;b[rows]^=1;f.put(f.indexPath,b);f.rebuildSearch();f.rebind();});
rejected('non-increasing duplicate string offsets',f=>{const b=Buffer.from(f.read(f.indexPath));b.writeUInt32LE(b.readUInt32LE(12),16);f.put(f.indexPath,b);f.rebuildSearch();f.rebind();});
// Leave the independently authored search text unchanged. A decoder silently
// consuming a field-leading BOM must not erase this signature byte mutation.
rejected('literal field-leading BOM is not swallowed as UTF-8 transport markup',f=>{const entries=structuredClone(f.expectedEntries),victim=entries.find(e=>e.signature);victim.signature='\uFEFF'+victim.signature;f.setIndex(entries);f.rebuildSearch({entries});f.rebind();});
rejected('unsafe manifest Skill path',f=>{const p=f.packages[0].root+'/lib.json',m=f.json(p);m.agent.skill.path='../LICENSE';f.write(p,m);f.rebind();});
rejected('manifest Skill digest mismatch',f=>{const p=f.packages[0].root+'/lib.json',m=f.json(p);m.agent.skill.sha256='0'.repeat(64);f.write(p,m);f.rebind();});
rejected('manifest chooses nonexistent WIT world',f=>{const p=f.packages[0].root+'/lib.json',m=f.json(p);m.wit.world='not-a-world';f.write(p,m);f.rebind();});
rejected('activeSearch outside selected18 root',f=>{const r=f.json(f.receiptPath);r.search.root='standard/wasmc-lib-search/0.4.0';f.write(f.receiptPath,r);const p=f.json(f.policyPath);p.future_route_authority.sha256=routeSha(f.read(f.receiptPath));f.write(f.policyPath,p);f.refresh();});
for(const key of ['id','version'])rejected('activeSearch wrong '+key,f=>{const r=f.json(f.receiptPath);r.search[key]=key==='id'?'wasmc-json':'99.99.99';f.write(f.receiptPath,r);const p=f.json(f.policyPath);p.future_route_authority.sha256=routeSha(f.read(f.receiptPath));f.write(f.policyPath,p);f.refresh();});
rejected('receipt manifest pin drift',f=>{const r=f.json(f.receiptPath);r.search.manifest.sha256='0'.repeat(64);f.write(f.receiptPath,r);const p=f.json(f.policyPath);p.future_route_authority.sha256=routeSha(f.read(f.receiptPath));f.write(f.policyPath,p);f.refresh();});
rejected('receipt artifact pin drift',f=>{const r=f.json(f.receiptPath);r.search.artifact.sha256='0'.repeat(64);f.write(f.receiptPath,r);const p=f.json(f.policyPath);p.future_route_authority.sha256=routeSha(f.read(f.receiptPath));f.write(f.policyPath,p);f.refresh();});
rejected('receipt erased carried Component obligation',f=>{f.put(f.search.root+'/component.wasm',Buffer.from([0,97,115,109,13,0,1,0]));f.rebind();});
rejected('receipt erased declared Component SDK obligation',f=>{const p=f.search.root+'/lib.json',m=f.json(p);m.bindings.rust_component={cargo_toml:structuredClone(m.bindings.rust_core.cargo_toml)};f.write(p,m);f.rebind();});
rejected('policy receipt pin missing',f=>{const p=f.json(f.policyPath);delete p.future_route_authority;f.write(f.policyPath,p);f.refresh();});
rejected('policy receipt path noncanonical',f=>{const p=f.json(f.policyPath);p.future_route_authority.path='catalog/other.json';f.write(f.policyPath,p);f.refresh();});
rejected('policy authority commit differs',f=>{const p=f.json(f.policyPath);p.package_authority_commit='f'.repeat(40);f.write(f.policyPath,p);f.refresh();});
rejected('self-rehashed catalog/receipt cannot rewrite reviewed policy pin',f=>{const p=f.json(f.catalogPath);p.packages[0].keywords.push('new-suspect-keyword');f.write(f.catalogPath,p);sealAuthorityOnly(f,{pin:false});});
rejected('self-rehashed index/receipt cannot rewrite reviewed policy pin',f=>{const entries=structuredClone(f.expectedEntries);entries[0].search_text+=' rewritten';f.setIndex(entries);sealAuthorityOnly(f,{pin:false});});
rejected('closure retains wrong active identity',f=>{f.candidate.lib_route_closure.search_index.active_identity='wasmc:lib-search@0.4.0';f.refresh();});
rejected('closure forged API count',f=>{f.candidate.lib_route_closure.api_routes--;f.refresh();});

// All following modules still validate and expose the real complete consumer
// ABI; refusal cannot be attributed to a deliberately missing export.
rejected('Core snapshot lies about embedded index digest',f=>{f.rebuildSearch({snapshotDigest:'0'.repeat(64)});f.rebind();});
rejected('Core snapshot count differs from actual index',f=>{f.rebuildSearch({snapshotCount:114});f.rebind();});
rejected('Core lookup exposes wrong full hit path',f=>{const entries=structuredClone(f.expectedEntries);entries[0].artifact_path='libs/legacy/artifact.wasm';f.rebuildSearch({entries});f.rebind();});
rejected('Core lookup loses one independently selected hit',f=>{f.rebuildSearch({entries:f.expectedEntries.slice(1),snapshotCount:113});f.rebind();});
rejected('Core pages return wrong protocol order with all lookups intact',f=>{f.rebuildSearch({entries:[...f.expectedEntries].reverse()});f.rebind();});
rejected('Core lookup signature differs despite matching index/header',f=>{const entries=structuredClone(f.expectedEntries),e=entries.find(x=>x.signature);e.signature='wrong:func()->_';f.rebuildSearch({entries});f.rebind();});
rejected('Core imports new ambient authority with complete exports',f=>{
  const b=f.read(f.search.root+'/artifact.wasm');let p=9,n=0,shift=0,x;do{x=b[p++];n|=(x&127)<<shift;shift+=7;}while(x&128);const end=p+n;
  // An unused i32 global import does not renumber functions or alter exports.
  const importSection=Buffer.from([2,12,1,1,120,5,116,111,107,101,110,3,127,0]);
  const module=Buffer.concat([b.subarray(0,end),importSection,b.subarray(end)]);assert(WebAssembly.validate(module));assert.equal(WebAssembly.Module.imports(new WebAssembly.Module(module)).length,1);f.put(f.search.root+'/artifact.wasm',module);f.rebind();
});
rejected('valid full-export Core loop is terminated by the actual gate',f=>{
  f.rebuildSearch({snapshotLoop:true});f.rebind();const started=Date.now();
  return {pattern:/actual Search Core rejected \(ETIMEDOUT\)/,assertAfter:()=>assert(Date.now()-started<15000,'timeout must not hang the gate')};
});
console.log(JSON.stringify({accepted:true,candidate_module:fileURLToPath(candidateModule),fixture_positives:positives,actual_negative_controls:negatives,selected_packages:18,selected_API_routes:95,synthetic_observable_calls:observableCalls,scope:'future candidate exact identity, selected-world route/signature/path/index closure and actual synthetic public-consumer observable parity; not real18 admission, SDK, strict Canonical ABI, actual production index provenance, legal review, install upgrade or release'}));
