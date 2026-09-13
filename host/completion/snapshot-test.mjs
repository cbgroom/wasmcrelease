import assert from 'node:assert/strict';
import {ScopedCompletionGuard} from './scoped-guard.mjs';
let controls=0;
for(const mode of ['getter','length']) {
  const guard=ScopedCompletionGuard.fresh(),window=guard.acquire(1),operation=guard.submit(window);
  let reads=0;const bytes=mode==='length'?new Proxy([7],{get(target,key){return key==='length'?(++reads===1?1:17):Reflect.get(target,key);}}):[];
  if(mode==='getter')Object.defineProperty(bytes,0,{get(){return ++reads===1?7:256;}});
  assert.equal(guard.complete(operation,bytes),0);assert.equal(reads,1);assert.deepEqual(guard.read(window),[7]);
  guard.release(operation);guard.release(window);assert.deepEqual(guard.counts(),[0,0]);controls++;
}
for(const bytes of [Array(1),[256],[-1],[0.5],[NaN]]) {
  const guard=ScopedCompletionGuard.fresh(),window=guard.acquire(1),operation=guard.submit(window);
  assert.throws(()=>guard.complete(operation,bytes),e=>e===-5);assert.equal(guard.poll(operation).drained,false);
  assert.throws(()=>guard.release(window),e=>e===-4);
  guard.complete(operation,[],-8);guard.release(operation);guard.release(window);controls++;
}
{
  const guard=ScopedCompletionGuard.fresh(),window=guard.acquire(1),operation=guard.submit(window),bytes=[];
  Object.defineProperty(bytes,0,{get(){guard.cancel(operation);return 7;}});
  guard.complete(operation,bytes);assert.equal(guard.poll(operation).state,'cancelled');assert.deepEqual(guard.read(window),[]);
  guard.release(operation);guard.release(window);controls++;
}
{
  const guard=ScopedCompletionGuard.fresh(),window=guard.acquire(1),operation=guard.submit(window),bytes=[];
  Object.defineProperty(bytes,0,{get(){guard.complete(operation,[9]);return 7;}});
  assert.throws(()=>guard.complete(operation,bytes),e=>e===-1);assert.deepEqual(guard.read(window),[9]);
  guard.release(operation);guard.release(window);controls++;
}
console.log(JSON.stringify({accepted:true,completion_snapshot_controls:controls,single_index_capture:true,sparse_denied:true,cancel_suppresses_delivery:true,reentrant_duplicate_denied:true,scoped_identity:true,core_owned_memory:false,real_io:false}));
