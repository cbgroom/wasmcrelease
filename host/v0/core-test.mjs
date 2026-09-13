import { compile } from '../../current/wasmc.mjs';
import { MemoryHost } from './reference.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const wasm = await compile(await readFile('host/v0/guest.wasmc','utf8'));
await mkdir('target/thin-host',{recursive:true});
await writeFile('target/thin-host/guest.wasm',wasm);
const host = new MemoryHost();
const imports = {};
for(const name of ['describe','window_acquire','window_commit','invoke','wait','cancel','release']) imports[name]=(a,b)=>host.step([name,a,b]);
const {instance}=await WebAssembly.instantiate(wasm,{host:imports});
const rows=[];
for(const size of [0,1,4,16]) {
  const result=instance.exports.run(size);
  assert.equal(result,size);
  assert.equal(host.windows.size,0); assert.equal(host.ops.size,0);
  rows.push([result,host.windows.size,host.ops.size,...host.bytes]);
}
const jit=process.argv.includes('--wasmtime');
const child=spawn(process.argv[2],['target/thin-host/guest.wasm',...(jit?['--wasmtime']:[])],{env:{},stdio:['ignore','pipe','pipe']});
let stdout='',stderr='';child.stdout.on('data',bytes=>{stdout+=bytes;});child.stderr.on('data',bytes=>{stderr+=bytes;});
const timer=setTimeout(()=>child.kill(),30000);
const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);}).finally(()=>clearTimeout(timer));
if(status!==0)throw Error(stderr||'Native kernel exited or timed out');
assert.deepEqual(JSON.parse(stdout),rows);
console.log(JSON.stringify({accepted:true,core_guest_cases:4,guest_sha256:createHash('sha256').update(wasm).digest('hex'),resource_cleanup:true,engines:jit?'JS WebAssembly / Wasmtime47':'JS WebAssembly / Wasmi2',real_io:false}));
