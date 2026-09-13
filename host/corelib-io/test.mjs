import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,open,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
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
  }
  console.log(JSON.stringify({accepted:true,real_file_io:true,successes,controls,provider_sha256:digest(core),wasmc_sha256:digest(wasmc),rust_sha256:digest(rust),core_owned_resources_remaining:0,caller_scope:'reviewed_private_abi_conformance_only',copy_profile:true,shared_everything:false,portable_std_qualified:false}));
} finally {await rm(root,{recursive:true,force:true});}
