import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compileLib } from '../../current/index.mjs';
const load=async p=>new Uint8Array(await readFile(new URL(p,import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const root='../../standard/wasmc-std/1.4.0/';
const provider=await load('../../standard/corelib/4.8.0/corelib.wasm');
const lib=await load(root+'artifact.wasm');
const plan=await load(root+'typed-resource-plan.json');
assert.equal(sha(provider),'f54a892aff9068e5c79464029423a2e8f753ddb44010af9ac34a5c9efce2069c');
assert.equal(sha(lib),'f8a8ce447f776a47680e02e19ea3a69827edbbc46e01985803ce3d3df51178d7');
assert.equal(sha(plan),'b83e1db2a815ea1ce7618ca402dd0bcf9aba1301270393b7452036531afe5664');
const source=new TextDecoder().decode(await load('standard.wasmc'));
const compiled=(await compileLib(source,{plan,libWasmBytes:lib})).appWasm;
const frozen=await load('standard-wasmc.wasm');
assert.equal(sha(compiled),sha(frozen),'current hosted compiler must reproduce qualified App bytes');
let calls=0;
for(const caller of [compiled,await load('standard-rust.wasm')]) {
 const pm=new WebAssembly.Module(provider);
 assert.deepEqual(WebAssembly.Module.imports(pm),[]);
 const p=new WebAssembly.Instance(pm,{});
 assert.equal(p.exports.provider_domain_init(127,7),0);
 const lm=new WebAssembly.Module(lib);
 for(const i of WebAssembly.Module.imports(lm)) assert.equal(i.module,'wasmc:lib/wasmc.lib_managed_object_heap@4.8.0');
 const l=new WebAssembly.Instance(lm,{'wasmc:lib/wasmc.lib_managed_object_heap@4.8.0':p.exports});
 assert.equal(l.exports.std_init(),0);
 const am=new WebAssembly.Module(caller);
 for(const i of WebAssembly.Module.imports(am)) assert.equal(i.module,'wasmc:lib/wasmc.std@1.4.0');
 const a=new WebAssembly.Instance(am,{'wasmc:lib/wasmc.std@1.4.0':l.exports});
 for(let round=0;round<128;round++)for(const index of[0,1,2,99,4294967295])for(const item of[0,1,128,255]){
  const actual=a.exports.run(index,item);
  assert.equal(Array.isArray(actual)?actual[0]:actual,[-7,0,2147483647][index]??9);
  if(Array.isArray(actual))assert.equal(actual[1],0);
  calls++;
 }
}
console.log(JSON.stringify({accepted:true,standard_lib:'wasmc:std@1.4.0',functions:73,dual_consumer_calls:calls,current_hosted_compiler_reproduced:true}));
