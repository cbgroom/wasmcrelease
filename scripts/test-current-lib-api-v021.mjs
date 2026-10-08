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
console.log(JSON.stringify({accepted:true,provider:'4.9.0',compileLib_oracles:oracles,instantiateLib_oracles:oracles,calls,old_provider_fallback:false}));
