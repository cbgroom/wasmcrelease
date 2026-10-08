import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as sidecar from '../current/index.mjs';
import * as single from '../current/wasmc.mjs';
(0,eval)(readFileSync(new URL('../current/wasmc.global.js',import.meta.url),'utf8'));
const source='package local:current_lib_api; interface api {run: func() -> u32 {let mut values: list<u32> = list.new(); values.push(7); return values.len();}} world app {export api;}';
let oracles=0,calls=0;
for(const api of [sidecar,single,globalThis.Wasmc]){
 const compiled=await api.compileLib(source);
 assert.ok(WebAssembly.validate(compiled.appWasm));
 assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(compiled.libWasm)),[]);
 const app=await api.instantiateLib(source);
 for(let i=0;i<256;i++){const result=app.exports.run();assert.equal(Array.isArray(result)?result[0]:result,1);if(Array.isArray(result))assert.equal(result[1],0);calls++;}
 oracles++;
}

const booleanSource='package current:boolean_zero; interface api { run: func(flag:bool)->bool { let mut values:list<bool> = list.new(); values.push(flag); let answer:bool = if(flag){true}else{false}; return answer; } } world app { export api; }';
let booleanCalls=0,booleanTypeNegatives=0;
for(const api of [sidecar,single,globalThis.Wasmc]){
 const compiled=await api.compileLib(booleanSource);
 assert.ok(WebAssembly.validate(compiled.appWasm));
 const app=await api.instantiateLib(booleanSource);
 for(let round=0;round<256;round++)for(const flag of [0,1]){
  const result=app.exports.run(flag);assert.equal(Array.isArray(result)?result[0]:result,flag);
  if(Array.isArray(result))assert.equal(result[1],0);booleanCalls++;
 }
 for(const changed of [
  booleanSource.replace('if(flag){true}else{false}','if(flag){1}else{0}'),
  booleanSource.replace('values.push(flag)','values.push(1)')
 ]){await assert.rejects(api.compileLib(changed));booleanTypeNegatives++;}
}

console.log(JSON.stringify({accepted:true,provider:'4.9.0',compileLib_oracles:oracles,instantiateLib_oracles:oracles,calls,boolean_conditional_calls:booleanCalls,boolean_numeric_rejections:booleanTypeNegatives,old_provider_fallback:false}));
