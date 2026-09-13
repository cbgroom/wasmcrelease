import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,open,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {compile} from '../../current/wasmc.mjs';
import {PreopenedFile} from '../file-io/adapter.mjs';
import {ScopedCompletionGuard} from '../completion/scoped-guard.mjs';
import {readWindow} from '../completion/read-window.mjs';
import {createCoreBytesProvider} from './provider.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const core=await readFile('standard/corelib/4.8.0/corelib.wasm');
assert.equal(digest(core),'f54a892aff9068e5c79464029423a2e8f753ddb44010af9ac34a5c9efce2069c');
await mkdir('target/corelib-io',{recursive:true});
const wasmc=await compile(await readFile('host/corelib-io/private-abi-guest.wasmc','utf8'));
assert.equal(WebAssembly.validate(wasmc),true);
await writeFile('target/corelib-io/wasmc-guest.wasm',wasmc);
const rust=await readFile('target/corelib-io/rust-guest.wasm');
assert.equal(WebAssembly.validate(rust),true);
const root=await mkdtemp('target/corelib-io/files-');let successes=0,controls=0;
let nativeCases=0;
async function native(args) {
  const child=spawn(process.argv[2],args,{env:{},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr+=b;});
  const timer=setTimeout(()=>child.kill(),30000);
  const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);}).finally(()=>clearTimeout(timer));
  if(status!==0)throw Error(stderr||'native file conformance exited/timed out');
  return JSON.parse(stdout);
}
try {
  for(const [name,wasm] of [['wasmc',wasmc],['rust',rust]]) {
    const provider=await createCoreBytesProvider(core),caller=await provider.caller(wasm);
    for(const [index,data] of [[],[7],[1,2,3,255],Array.from({length:16},(_,i)=>i)].entries()) {
      const input=`${root}/${name}-${index}.input`,output=`${root}/${name}-${index}.output`;
      await writeFile(input,Uint8Array.from(data));
      const guard=ScopedCompletionGuard.fresh();
      const bytes=await readWindow(new PreopenedFile(await open(input,'r'),false),guard);
      assert.deepEqual(bytes,data);assert.deepEqual(guard.counts(),[0,0]);
      const owner=provider.allocate(bytes);let result;
      try {result=owner.run(caller);}finally{owner.release();}
      assert.equal(result,BigInt(data.reduce((a,b)=>a+b,0)));
      assert.equal(owner.staleRejected(),true);assert.throws(()=>owner.run(caller),e=>e===-1);
      assert.equal(provider.count(),0);
      const encoded=Buffer.alloc(8);encoded.writeBigInt64LE(result);
      const sink=new PreopenedFile(await open(output,'wx+'),true);
      try{assert.equal(await sink.write(0,[...encoded]),8);await sink.invokeSync();}finally{await sink.release();}
      assert.deepEqual(await readFile(output),encoded);successes++;
    }
    const cancelInput=`${root}/${name}-cancel.input`;await writeFile(cancelInput,Uint8Array.of(7));
    const guard=ScopedCompletionGuard.fresh();let reads=0;
    const input=new PreopenedFile(await open(cancelInput,'r'),false),before=caller.calls();
    await assert.rejects(readWindow({read(...args){reads++;return input.read(...args);},release:()=>input.release()},guard,{cancelDelivery:true}),e=>e===-6);
    assert.equal(reads,1);assert.equal(caller.calls(),before);assert.equal(provider.count(),0);assert.deepEqual(guard.counts(),[0,0]);controls++;
    assert.throws(()=>provider.allocate(Array(17).fill(1)),e=>e===-5);assert.equal(provider.count(),0);controls++;
    const foreign=await (await createCoreBytesProvider(core)).caller(wasm),owned=provider.allocate([7]);
    assert.throws(()=>owned.run(foreign),e=>e===-4);assert.equal(foreign.calls(),0);owned.release();controls++;
    const trapped=provider.allocate([7,8,9]);
    assert.throws(()=>trapped.run(caller,1),WebAssembly.RuntimeError);trapped.release();
    assert.equal(provider.count(),0);assert.equal(trapped.staleRejected(),true);controls++;
    const next=provider.allocate([1]),calls=caller.calls();
    assert.throws(()=>next.run(caller),e=>e===-8);assert.equal(caller.calls(),calls);next.release();controls++;
    if(process.argv[2]) {
      const prefix=`native-${name}`,vectors=[[],[7],[1,2,3,255],Array.from({length:16},(_,i)=>i)];
      for(const [index,data] of vectors.entries())await writeFile(`${root}/${prefix}-${index}.input`,Uint8Array.from(data));
      const receipt=await native(['standard/corelib/4.8.0/corelib.wasm',`target/corelib-io/${name}-guest.wasm`,root,prefix,...(process.argv.includes('--wasmtime')?['--wasmtime']:[])]);
      assert.equal(receipt.accepted,true);assert.equal(receipt.trap_cleanup,true);assert.equal(receipt.stale_rejected,true);
      assert.equal(receipt.post_trap_no_replay,true);
      assert.deepEqual(receipt.results,[0,7,261,120]);
      for(const [index,value] of receipt.results.entries()) {
        const bytes=await readFile(`${root}/${prefix}-${index}.output`);
        assert.equal(bytes.length,8);assert.equal(bytes.readBigInt64LE(),BigInt(value));nativeCases++;
      }
    }
  }
  console.log(JSON.stringify({accepted:true,real_file_io:true,successes,controls,native_cases:nativeCases,native_engine:process.argv[2]?(process.argv.includes('--wasmtime')?'Wasmtime47':'Wasmi2'):null,provider_sha256:digest(core),wasmc_sha256:digest(wasmc),rust_sha256:digest(rust),core_owned_resources_remaining:0,caller_scope:'reviewed_private_abi_conformance_only',copy_profile:true,shared_everything:false,portable_std_qualified:false}));
} finally {await rm(root,{recursive:true,force:true});}
