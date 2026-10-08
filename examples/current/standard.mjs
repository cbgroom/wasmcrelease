import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compileLib} from '../../current/index.mjs';
import {preflightCoreArtifact} from '../../scripts/core-compatibility.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const load=async p=>new Uint8Array(await readFile(new URL(p,import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const installed=process.argv.indexOf('--installed');
const base=installed<0?new URL('../../',import.meta.url):pathToFileURL(resolve(process.argv[installed+1])+'/');
const root=new URL('standard/wasmc-std/1.4.1/',base).href;
const provider=await load(new URL('standard/corelib/4.9.0/corelib.wasm',base).href);
const lib=await load(root+'artifact.wasm'),plan=await load(root+'typed-resource-plan.json');
preflightCoreArtifact('standard-provider',provider);preflightCoreArtifact('standard',lib);
assert.equal(sha(provider),'c3ac42b93f4c27e24065abe804b91f54761eff782e2971e947847b3d20ee7e00');
assert.equal(sha(lib),'b79a499c8300361125e7fcdae02170184b82d4bbeff4d8f24ed95f3fd4db8d3b');
assert.equal(sha(plan),'8be27de32e1e8dadcb997f2b886d0349531eb9448c1b7dd73a74a3d9e34f87b3');
const source=new TextDecoder().decode(await load('standard.wasmc'));
const compiled=(await compileLib(source,{plan,libWasmBytes:lib})).appWasm;
const sealed=await load('standard-wasmc.wasm'),rust=await load('standard-rust.wasm');
const pins=JSON.parse(new TextDecoder().decode(await load('standard-fixtures.json')));
assert.equal(sha(compiled),pins.wasmc_sha256);assert.equal(sha(sealed),pins.wasmc_sha256);assert.equal(sha(rust),pins.rust_sha256);
let calls=0;
for(const bytes of [compiled,sealed,rust]){
 const pm=new WebAssembly.Module(provider);assert.deepEqual(WebAssembly.Module.imports(pm),[]);
 const p=new WebAssembly.Instance(pm,{});assert.equal(p.exports.provider_domain_init(127,7),0);
 const lm=new WebAssembly.Module(lib);
 for(const i of WebAssembly.Module.imports(lm))assert.equal(i.module,'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0');
 const l=new WebAssembly.Instance(lm,{'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0':p.exports});assert.equal(l.exports.std_init(),0);
 const am=new WebAssembly.Module(bytes);
 for(const i of WebAssembly.Module.imports(am))assert.equal(i.module,'wasmc:lib/wasmc.std@1.4.1');
 const a=new WebAssembly.Instance(am,{'wasmc:lib/wasmc.std@1.4.1':l.exports});
 for(let round=0;round<128;round++)for(const index of [0,1,2,99,4294967295])for(const item of [0,1,128,255]){
  const result=a.exports.run(index,item);assert.equal(Array.isArray(result)?result[0]:result,[-7,0,2147483647][index]??9);
  if(Array.isArray(result))assert.equal(result[1],0);calls++;
 }
}
console.log(JSON.stringify({accepted:true,standard_lib:'wasmc:std@1.4.1',functions:73,consumer_count:3,consumer_calls:calls,current_app_sha256:sha(compiled),rust_sdk_sha256:pins.rust_sdk_sha256}));
