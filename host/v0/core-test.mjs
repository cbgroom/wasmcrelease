import { compile } from '../../current/wasmc.mjs';
import { MemoryHost } from './reference.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
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
const native=spawnSync(process.argv[2],['target/thin-host/guest.wasm'],{env:{},encoding:'utf8',timeout:30000});
if(native.status!==0) throw new Error(native.stderr);
assert.deepEqual(JSON.parse(native.stdout),rows);
console.log(JSON.stringify({accepted:true,core_guest_cases:4,resource_cleanup:true,engines:'JS WebAssembly / Wasmi2',real_io:false}));
