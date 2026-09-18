import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createCoreBytesProvider} from './provider.mjs';
const core=await readFile('standard/corelib/4.8.0/corelib.wasm');
assert.equal(createHash('sha256').update(core).digest('hex'),'f54a892aff9068e5c79464029423a2e8f753ddb44010af9ac34a5c9efce2069c');
const receipts=[];
const nativeReceipts=[];
async function native(name) {
  const child=spawn(process.argv[2],['standard/corelib/4.8.0/corelib.wasm',`target/corelib-io/${name}-guest.wasm`,'unused','unused','--lifetime-only',...(process.argv.includes('--wasmtime')?['--wasmtime']:[])],{env:{},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr+=b;});
  const timer=setTimeout(()=>child.kill(),30000);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);}).finally(()=>clearTimeout(timer));
  if(code!==0)throw Error(stderr||'native lifetime exited or timed out');
  const r=JSON.parse(stdout);assert.equal(r.accepted,true);assert.equal(r.corelib_owned_lifetime,true);
  assert.equal(r.calls,100000);assert.equal(r.checksum,14342320);
  assert.equal(r.owned_allocations,100000);assert.equal(r.owned_drops,100000);assert.equal(r.long_range_stale_rejected,true);
  assert.equal(r.memory_bytes.length,6);assert.equal(r.memory_bytes.at(-1),r.memory_bytes[1]);
  assert.ok(Number.isFinite(r.preparation_ms)&&r.preparation_ms>=0&&Number.isFinite(r.steady_ms)&&r.steady_ms>0);
  assert.ok(Math.abs(r.ns_per_cycle-r.steady_ms*1e6/100000)<1e-7);
  return {caller:name,...r};
}
for(const name of ['wasmc','rust']) {
  const preparation=performance.now(),provider=await createCoreBytesProvider(core);
  const callerBytes=await readFile(`target/corelib-io/${name}-guest.wasm`);
  const caller=await provider.caller(callerBytes);
  const preparationMs=performance.now()-preparation,baseline=provider.memoryBytes();
  const samples=[baseline];let first,checksum=0n;
  const start=performance.now();
  for(let i=0;i<100000;i++) {
    const owner=provider.allocate([7,i&255,9]);first??=owner;
    try{const value=owner.run(caller);assert.equal(value,BigInt(16+(i&255)));checksum+=value;}finally{owner.release();}
    assert.equal(provider.count(),0);
    if((i+1)%20000===0)samples.push(provider.memoryBytes());
  }
  const elapsedMs=performance.now()-start;
  assert.equal(caller.calls(),100000);assert.equal(first.staleRejected(),true);
  assert.throws(()=>first.run(caller),e=>e===-1);
  assert.equal(samples.at(-1),samples[1]); // Bounded fixture reaches a memory plateau.
  receipts.push({caller:name,caller_sha256:createHash('sha256').update(callerBytes).digest('hex'),calls:caller.calls(),checksum:checksum.toString(),preparation_ms:preparationMs,steady_ms:elapsedMs,ns_per_cycle:elapsedMs*1e6/100000,memory_bytes:samples,long_range_stale_rejected:true,core_owner_records_remaining:provider.count()});
  if(process.argv[2])nativeReceipts.push(await native(name));
}
assert.equal(receipts[0].checksum,receipts[1].checksum);
console.log(JSON.stringify({accepted:true,corelib_owned_lifetime:true,receipts,native_receipts:nativeReceipts,native_engine:process.argv[2]?(process.argv.includes('--wasmtime')?'Wasmtime47':'Wasmi2'):null,copy_profile:true,includes_allocation_app_drop_and_oracles:true,rss_leak_qualified:false,file_network_throughput:false,portable_std_qualified:false}));
