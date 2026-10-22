// Real, immutable 42-Root baseline and original JSON005 producer packet.
// Faults live in byte-map overlays; no product or producer file is changed.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {currentProductReader,currentProductPaths} from './current-lib-release-v3.mjs';
import {composeCurrentLibs,composeCurrentLibData} from './lib-current-composition-v1.mjs';
import {digest,sha} from './lib-refresh-cache-v2.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url)),read=currentProductReader(repo);
const basePath='catalog/libs-current-v2.json',catalog=JSON.parse(read(basePath));
const root='standard/wasmc-json/0.0.5',packet='admission/ordinary-canonical-host-v024/json005-authoring';
const options={schema:'wasmc.current-lib-composition-input/v1',
  base:{catalog_path:basePath,catalog_sha256:'81db5d610d53c7627fd91a4bbd47a22610bd1982718b845dc1557b81657f0e74'},
  reused_ids:catalog.packages.map(row=>row.id).filter(id=>id!=='wasmc-json'),
  replacements:[{id:'wasmc-json',version:'0.0.5',profile:'value',root,
    manifest_sha256:'3bfaa6449d8800aaa98a7068ceccaae3527490f6cb7773b53b70195e9c7eaadc',
    root_inventory_sha256:'c4adbe3a37e49d028c7f0a8351bab2686ef26ae154549068b4bb1a8b1b39e63c',
    source:{root:packet,inventory_sha256:'c0401da65d1f4ff9075b1846e2e925953f75d1c8c6fbd26c5001a4f23ce125c1',
      producer_custody:'producer-custody.json',materialization_custody:'source-spec-custody.json',
      source_spec:'source-lib.build.json',materialized_spec:'lib.build.json',
      generated_source:'workspace/json-adapter/src/lib.rs',logic:'workspace/json-adapter/src/logic.rs',
      cargo_manifest:'workspace/json-adapter/Cargo.toml',cargo_lock:'workspace/json-adapter/Cargo.lock',wit:'lib.wit',
      authority:{original_receipt_sha256:'3f59cb728932ac7b3a414b8e5c206428027c3d484c5355eca76af08b1e7fc6f3',
        driver_sha256:'73b6c3c9fc05bd1ccf5c19294ca74320438f9620eba7d11bb3d78a92f60a8286',
        original_source:'8873006f3ab94d6213cf1f41782519e1773f553d',
        canonical_source_commit:'9e6d8f1732733f457c1799c565a9962035250be4',
        canonical_source_blob:'d0dda97116202e0639db647348cdc324b066a005'}}}]};
const data=new Map();
const required=new Set([basePath,catalog.registry.path,catalog.index.path,catalog.cohort.path,'LICENSE',
  ...currentProductPaths(repo),...currentProductPaths(repo,'licenses'),
  ...currentProductPaths(repo,root),...currentProductPaths(repo,packet)]);
for(const row of catalog.packages)for(const pin of Object.values(row.source))required.add(pin.path);
for(const path of required)data.set(path,read(path));
const input=map=>({read:path=>{assert.ok(map.has(path),'missing byte input: '+path);return map.get(path);},
  paths:prefix=>[...map.keys()].filter(path=>path.startsWith(prefix+'/')).sort()});
const results=[];
const receipt=await composeCurrentLibs(repo,options);
assert.deepEqual(receipt.summary,{packages:42,reused_roots:41,imported_roots:1,apis:246,entries:288,fresh_builds:0});
assert.equal(receipt.base.original_closure.actual_Core_Search_snapshot_lookup_pagination,true);
assert.equal(receipt.fresh_full_q0,false);assert.equal(receipt.public_admission,false);assert.equal(receipt.released,false);
assert.equal(receipt.installation,false);assert.equal(receipt.rows.find(row=>row.id==='wasmc-json').required_current_authoring_admission,true);
assert.equal(receipt.rows.find(row=>row.id==='wasmc-json').wit.api_routes.length,13);
assert.equal(receipt.rows.find(row=>row.id==='wasmc-json').origin.original_receipt_bytes_verified,false);
for(const row of receipt.rows.filter(row=>row.origin.kind==='reused-public-root')){
  assert.deepEqual(row.catalog_row,catalog.packages.find(base=>base.id===row.id));
  assert.equal(digest(row.files),row.catalog_row.root_inventory_sha256);
}
assert.deepEqual(composeCurrentLibData(input(data),options),receipt,'physical Root verifier and byte-map verifier agree');
results.push({name:'actual old42-Root closure and new41+1 composition, byte-exact reused Roots and original13-API Root',pass:true});
const reject=(name,mutate,pattern)=>{
  const map=new Map(data),o=structuredClone(options);mutate(o,map);
  assert.throws(()=>composeCurrentLibData(input(map),o),pattern,name);results.push({name,pass:true,rejected:true});
};
const editJson=(map,path,mutate)=>{const value=JSON.parse(map.get(path));mutate(value);map.set(path,Buffer.from(JSON.stringify(value)+'\n'));};
const rehashPacket=(o,map)=>{const files={};for(const path of input(map).paths(packet)){
  const b=map.get(path);files[path.slice(packet.length+1)]={bytes:b.length,sha256:sha(b)};
}o.replacements[0].source.inventory_sha256=digest(files);};
reject('wrong independent base catalog pin',o=>o.base.catalog_sha256='0'.repeat(64),/catalog independent pin/);
reject('missing reused identity',o=>o.reused_ids.shift(),/exact whole current cohort/);
reject('duplicate reused identity',o=>o.reused_ids.splice(0,0,o.reused_ids[0]),/ordered unique explicit/);
reject('duplicate replacement identity',o=>o.replacements.push(structuredClone(o.replacements[0])),/duplicate replacement/);
reject('reuse and replacement overlap',o=>o.reused_ids.push('wasmc-json'),/ordered unique explicit|exact whole current cohort/);
reject('unknown replacement identity',o=>o.replacements[0].id='made-up-lib',/exact whole current cohort/);
reject('missing actual reused artifact',(o,map)=>{
  const row=catalog.packages.find(row=>row.profile==='value'&&row.id!=='wasmc-json');map.delete(row.root+'/artifact.wasm');
},/missing byte input/);
reject('changed actual reused artifact',(o,map)=>{
  const row=catalog.packages.find(row=>row.profile==='value'&&row.id!=='wasmc-json'),path=row.root+'/artifact.wasm';
  const bytes=Buffer.from(map.get(path));bytes[bytes.length-1]^=1;map.set(path,bytes);
});
reject('undeclared actual reused Root file',(o,map)=>map.set(catalog.packages[0].root+'/hidden.bin',Buffer.from('extra')),/no unselected or hidden current packages/);
reject('wrong imported manifest pin',o=>o.replacements[0].manifest_sha256='0'.repeat(64),/independent imported manifest/);
reject('wrong imported whole Root pin',o=>o.replacements[0].root_inventory_sha256='0'.repeat(64),/independent imported whole-Root/);
reject('changed actual imported Wasm',(o,map)=>{
  const path=root+'/artifact.wasm',bytes=Buffer.from(map.get(path));bytes[bytes.length-1]^=1;map.set(path,bytes);
},/independent imported whole-Root/);
reject('undeclared imported Root file',(o,map)=>map.set(root+'/hidden.bin',Buffer.from('extra')),/independent imported whole-Root/);
reject('wrong source packet pin',o=>o.replacements[0].source.inventory_sha256='0'.repeat(64),/independent source packet inventory/);
reject('changed actual source implementation',(o,map)=>{
  const path=packet+'/workspace/json-adapter/src/logic.rs';map.set(path,Buffer.concat([map.get(path),Buffer.from('\n// changed\n')]));
},/independent source packet inventory/);
reject('self-rehashed packet with different implementation',(o,map)=>{
  const path=packet+'/workspace/json-adapter/src/logic.rs';map.set(path,Buffer.concat([map.get(path),Buffer.from('\n// changed\n')]));rehashPacket(o,map);
},/actual Lib implementation source/);
reject('self-rehashed packet with forged producer',(o,map)=>{
  editJson(map,packet+'/producer-custody.json',p=>p.driver_sha256='0'.repeat(64));rehashPacket(o,map);
},/original producer authority/);
reject('self-rehashed packet with forged original receipt',(o,map)=>{
  editJson(map,packet+'/producer-custody.json',p=>p.original_private_receipt_sha256='0'.repeat(64));rehashPacket(o,map);
},/original receipt authority/);
reject('self-rehashed packet with failed original producer',(o,map)=>{
  editJson(map,packet+'/producer-custody.json',p=>p.original_producer_report.accepted=false);rehashPacket(o,map);
});
reject('self-rehashed packet with false produced API count',(o,map)=>{
  editJson(map,packet+'/producer-custody.json',p=>p.original_producer_report.function_count--);rehashPacket(o,map);
},/producer function count versus actual selected WIT/);
reject('self-rehashed packet with relabelled build Source',(o,map)=>{
  editJson(map,packet+'/producer-custody.json',p=>p.original_source='0'.repeat(40));rehashPacket(o,map);
},/observed build Source authority/);
reject('self-rehashed packet with wrong canonical source',(o,map)=>{
  editJson(map,packet+'/source-spec-custody.json',p=>p.canonical_source_spec.source_commit='0'.repeat(40));rehashPacket(o,map);
},/canonical source commit/);
reject('self-rehashed packet with wrong source spec',(o,map)=>{
  editJson(map,packet+'/source-lib.build.json',p=>p.skill.description+=' changed');rehashPacket(o,map);
},/original source spec/);
reject('materialization changes more than producer locator',(o,map)=>{
  editJson(map,packet+'/lib.build.json',p=>p.skill.description+=' changed');
  editJson(map,packet+'/source-spec-custody.json',p=>p.materialized_sha256=sha(map.get(packet+'/lib.build.json')));rehashPacket(o,map);
},/only producer crate locator/);
reject('self-rehashed packet with wrong original WIT',(o,map)=>{
  const path=packet+'/lib.wit';map.set(path,Buffer.concat([map.get(path),Buffer.from('\n// different original source\n')]));rehashPacket(o,map);
},/source and produced WIT/);
reject('self-rehashed packet with wrong generated source',(o,map)=>{
  const path=packet+'/workspace/json-adapter/src/lib.rs';map.set(path,Buffer.concat([map.get(path),Buffer.from('\n// changed\n')]));rehashPacket(o,map);
},/actual generated Rust source/);
reject('unsafe imported Root locator',o=>o.replacements[0].root='../private',/safe composition input path/);
reject('unsupported imported profile',o=>o.replacements[0].profile='native',/v1 imports only complete canonical value Roots/);
reject('closed composition schema',o=>o.q0_accepted=true,/closed composition input schema/);
// A provider that changes bytes only on the end-of-read is rejected too.
{
  const base=input(data),path=packet+'/workspace/json-adapter/src/logic.rs';let reads=0;
  const changing={...base,read:p=>{const bytes=base.read(p);return p===path&&++reads>2?Buffer.concat([bytes,Buffer.from('changed')]):bytes;}};
  assert.throws(()=>composeCurrentLibData(changing,options),/source packet changed during composition|producer packet changed during composition|source\/Root changed during composition/);
  results.push({name:'source packet changes after earlier successful verification',pass:true,rejected:true});
}
{
  const base=input(data),path=catalog.cohort.path;let reads=0;
  const changing={...base,read:p=>{const bytes=base.read(p);return p===path&&++reads>2?Buffer.concat([bytes,Buffer.from('\n')]):bytes;}};
  assert.throws(()=>composeCurrentLibData(changing,options),/base product input changed during composition/);
  results.push({name:'base producer cohort changes after earlier successful verification',pass:true,rejected:true});
}
assert.equal(sha(read(basePath)),options.base.catalog_sha256,'original catalog unchanged');
for(const row of receipt.rows)for(const [name,pin]of Object.entries(row.files))assert.equal(sha(read(row.root+'/'+name)),pin.sha256,'every original Root byte unchanged');
console.log(JSON.stringify({schema:'wasmc.current-lib-composition-controls/v1',accepted:true,tests:results.length,
  composition_schema:receipt.schema,composition_sha256:digest(receipt),input_sha256:digest(options),summary:receipt.summary,
  public_admission:false,fresh_full_q0:false,results,
  scope:'Actual source-custody/whole-Root composition and byte-overlay rejection controls; no current authoring/catalog admission, new-index Search, installation or formal release claimed.'}));
