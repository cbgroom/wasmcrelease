import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const [artifact,pin,out]=process.argv.slice(2);assert(artifact&&/^[0-9a-f]{64}$/.test(pin??'')&&out);
const bytes=readFileSync(resolve(artifact)),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(bytes),pin,'independent installed artifact pin');
const ns='[export]wasmc:resource-counter/counters@0.0.2';
const module=new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module).map(x=>[x.module,x.name,x.kind]),[[ns,'[resource-new]counter','function'],[ns,'[resource-drop]counter','function']]);
const exports=new WebAssembly.Instance(module,{[ns]:{'[resource-new]counter':rep=>rep,'[resource-drop]counter':()=>{}}}).exports;
const api='wasmc:resource-counter/counters@0.0.2#',create=exports[api+'[constructor]counter'],value=exports[api+'[method]counter.value'],add=exports[api+'[method]counter.add'],drop=exports[api+'[dtor]counter'];
const count=1_000_000,handles=new Int32Array(count),unique=new Set();
for(let i=0;i<count;i++){const h=create(i);assert(h!==0,'invalid resource representation');assert(!unique.has(h),'duplicate live resource representation');unique.add(h);handles[i]=h;}
for(let i=0;i<count;i++){assert.equal(value(handles[i]),i);if(i%10000===0)assert.equal(add(handles[i],1),i+1);}
const peak=exports.memory.buffer.byteLength;
for(const h of handles)drop(h);
for(let i=0;i<1000;i++){const h=create(-i);assert.equal(value(h),i===0?0:-i);drop(h);}
assert.equal(sha(readFileSync(resolve(artifact))),pin,'artifact drift');
const result={schema:'wasmc.frozen-counter-scale/v1',accepted:true,artifact_sha256:pin,live_counters:count,checked_values:count,mutated_counters:100,drop_count:count,recovery_counters:1000,peak_linear_memory_bytes:peak,scope:'single installed Core module in-process; host resource-new modeled by identity, not deployed MCPGit or exhaustive upper-bound proof'};
writeFileSync(resolve(out),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
