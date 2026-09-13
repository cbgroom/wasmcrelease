import { CompletionGuard } from './guard.mjs';
import { readWindow } from './read-window.mjs';
import { PreopenedFile } from '../file-io/adapter.mjs';
import assert from 'node:assert/strict';
let controls=0;
{
  const g=new CompletionGuard(),w=g.acquire(1),op=g.submit(w);
  assert.throws(()=>g.complete(op,new Array(1)),e=>e===-5);
  assert.throws(()=>g.complete(op,[],-2147483649),e=>e===-5);
  g.cancel(op);assert.throws(()=>g.complete(op,[1,2]),e=>e===-5);
  assert.deepEqual(g.poll(op),{state:'cancelled',drained:false,error:0});
  g.complete(op,[]);g.release(op);g.release(w);
  let writes=0;const file=new PreopenedFile({write:async()=>{writes++;},close:async()=>{}},true);
  await assert.rejects(file.write(0,new Array(1)),e=>e===-5);assert.equal(writes,0);await file.release();controls++;
}
// An in-flight descriptor cannot be concurrently read/written/synced/closed.
for(const operation of ['read','write','invokeSync']) {
  let finish,closes=0;
  const pending=new Promise(resolve=>{finish=resolve;});
  const file={
    read:async bytes=>{await pending;bytes[0]=7;return {bytesRead:1};},
    write:async()=>{await pending;return {bytesWritten:1};},
    sync:async()=>{await pending;},close:async()=>{closes++;},
  };
  const input=new PreopenedFile(file,true);
  const issued=operation==='read'?input.read(0,1):operation==='write'?input.write(0,[7]):input.invokeSync();
  await assert.rejects(input.read(0,1),e=>e===-4);
  await assert.rejects(input.write(0,[7]),e=>e===-4);
  await assert.rejects(input.invokeSync(),e=>e===-4);
  await assert.rejects(input.release(),e=>e===-4);
  assert.equal(closes,0);finish();await issued;await input.release();assert.equal(closes,1);controls++;
}
for(const [result,error,closeError] of [[null,-5,-8],[null,new Error('I/O'),undefined],[[256],-5,undefined]]) {
  const g=new CompletionGuard();let closes=0;
  const input={read:async()=>{if(result===null) throw error;return result;},release:async()=>{closes++;if(closeError) throw closeError;}};
  await assert.rejects(readWindow(input,g),e=>e===(error instanceof Error?-8:error));
  assert.deepEqual(g.counts(),[0,0]);assert.equal(closes,1);controls++;
}
// Even if requesting cancellation fails, wait for the already-issued backend.
{
  const g=new CompletionGuard();let finish,closes=0;
  const input={read:()=>{g.revoke();return new Promise(resolve=>{finish=resolve;});},release:async()=>{closes++;}};
  const pending=readWindow(input,g,{cancelDelivery:true});
  assert.deepEqual(g.counts(),[1,1]);assert.equal(closes,0);
  finish([7]);await assert.rejects(pending,e=>e===-6);
  assert.deepEqual(g.counts(),[0,0]);assert.equal(closes,1);controls++;
}
// Reusing a drained window cannot let an old completion overwrite new input.
{
  const g=new CompletionGuard(),w=g.acquire(1),a=g.submit(w);
  g.complete(a,[1]);const b=g.submit(w);
  assert.throws(()=>g.complete(a,[9]),e=>e===-1);
  assert.throws(()=>g.read(w),e=>e===-4);
  const bytes=[2];g.complete(b,bytes);bytes[0]=9;
  const read=g.read(w);read[0]=8;assert.deepEqual(g.read(w),[2]);
  g.release(a);g.release(b);g.release(w);assert.deepEqual(g.counts(),[0,0]);controls++;
}
{
  const g=new CompletionGuard();let previous=0;
  for(let i=0;i<32767;i++) {const id=g.acquire(0);assert.ok(id>previous);previous=id;g.release(id);}
  assert.throws(()=>g.acquire(0),e=>e===-3);
  assert.deepEqual(g.counts(),[0,0]);controls++;
}
console.log(JSON.stringify({accepted:true,fault_controls:controls,sequence_allocations:32767,failed_read_drains:true,busy_descriptor_not_closed:true,original_error_preserved:true,old_completion_no_overwrite:true}));
