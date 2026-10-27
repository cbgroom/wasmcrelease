import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const stage=resolve(process.argv[2]??'');assert.ok(process.argv[2]);
const expected='8231aba425ef1bb0aa07a760ff4c77917e247382ef73a41408db6b6b1cb40b1e';
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(await readFile(stage+'/current/lib_core.wasm')),expected);
assert.equal(sha(await readFile(stage+'/current/wasmc_compiler.wasm')),'d725ecc9e6fe5b2717b566bdc86b7a571f76b4abc71f111f048f91bb539ded09');
const sidecar=await import(pathToFileURL(stage+'/current/index.mjs').href),embedded=await import(pathToFileURL(stage+'/current/wasmc.mjs').href);
(0,eval)((await readFile(stage+'/current/wasmc.global.js')).toString());
const source='package local:large_records; interface api { record Cell { v: u32 } run: func(n: u32) -> u32 { let mut xs: list<Cell> = list.new(); let i: u32 = 0; while (i < n) { xs.push({v:i}); i = i + 1; } return xs.len() + xs.get(n-1).v; } } world app { export api; }';
const rounds=[1,512,10000,7,4096],rows=[];
for(const [name,api] of [['sidecar',sidecar],['embedded',embedded],['global',globalThis.Wasmc]]){const compiled=await api.compileLib(source);assert.equal(sha(compiled.libWasm),expected);const app=await api.instantiateLib(source);for(const n of rounds){const result=app.exports.run(n);assert.equal(Array.isArray(result)?result[0]:result,2*n-1);if(Array.isArray(result))assert.equal(result[1],0)}rows.push({entry:name,rounds})}
console.log(JSON.stringify({accepted:true,core_sha256:expected,compiler_sha256:'d725ecc9e6fe5b2717b566bdc86b7a571f76b4abc71f111f048f91bb539ded09',same_instance_per_entry:true,actual_values_checked:true,rows,formal_release:false}));
