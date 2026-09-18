import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createResidentApp} from './resident-app.mjs';

const [binary,appPath]=process.argv.slice(2);
if(!binary||!appPath) throw Error('usage: benchmark.mjs native-binary compiled-guest.wasm [--wasmtime]');
const libPath='libs/wasmc-owned-algorithms/artifact.wasm';
const libBytes=await readFile(libPath),appBytes=await readFile(appPath);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(digest(libBytes),'44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
assert.equal(digest(appBytes),'4eff84eccf06251a0b5de89e81d4faaeb5f51bce18724d8f011b95ea0ab7fd19');
let activeChild;
const watchdog=setTimeout(()=>{activeChild?.kill();console.error('resident benchmark deadline');process.exit(1);},120000);
const started=performance.now(),app=await createResidentApp(libBytes,appBytes);
const init=performance.now()-started,samples=[],rss=[];
for(let i=0;i<1000;i++)assert.equal(app.call([7,i%200]),BigInt(7+i%200));
let checksum=0;
for(let sample=0;sample<7;sample++){
  const start=performance.now();let total=0;
  for(let i=0;i<100000;i++)total+=Number(app.call([7,i%200]));
  samples.push(performance.now()-start);assert.equal(total,10650000);checksum+=total;
  rss.push(process.memoryUsage().rss);
}
assert.equal(app.libCalls(),701000);app.release();
const engines=process.argv.includes('--wasmtime')?['wasmi','wasmtime']:['wasmi'];
const results=[];
function summary(engine,init_ms,samples_ms,extra={}){
  assert.equal(samples_ms.length,7);assert.ok(samples_ms.every(n=>Number.isFinite(n)&&n>0));
  const sorted=[...samples_ms].sort((a,b)=>a-b),median=sorted[3];
  return {engine,init_ms,samples_ms,median_ns_per_call:median*1e6/100000,...extra};
}
results.push(summary('js',init,samples,{rss_samples_bytes:rss}));
for(const engine of engines){
  const child=spawn(binary,[libPath,appPath,...(engine==='wasmtime'?['--wasmtime']:[])],{env:{},stdio:['ignore','pipe','pipe']});
  activeChild=child;
  let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
  assert.equal(await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);}),0,err);
  activeChild=undefined;
  const receipt=JSON.parse(out);assert.equal(receipt.engine,engine);assert.equal(receipt.checksum,checksum);
  assert.equal(receipt.lib_calls,701000);assert.equal(receipt.calls_per_sample,100000);
  results.push(summary(engine,receipt.init_ms,receipt.samples_ms));
}
clearTimeout(watchdog);
const runtime=globalThis.Bun?{name:'bun',version:globalThis.Bun.version}:globalThis.Deno?{name:'deno',version:globalThis.Deno.version.deno}:{name:'node',version:process.version};
console.log(JSON.stringify({accepted:true,workload:'resident App to reviewed sum Lib; two bytes per call',calls_per_sample:100000,samples:7,checksum,lib_sha256:digest(libBytes),app_sha256:digest(appBytes),platform:process.platform,arch:process.arch,js_runtime:runtime,results,network_tps:false,durable_tps:false,performance_threshold_enforced:false}));
