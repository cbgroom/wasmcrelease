import assert from 'node:assert/strict';
import {ScopedCompletionGuard} from '../../runtime/completion/scoped-guard.mjs';
import {readTcpWindow} from './read-window.mjs';
import {writeTcpWindow} from './write-window.mjs';
import {TcpStopFailure} from './stop-fence.mjs';

let controls=0;
for(const write of [false,true])for(const synchronous of [false,true]){
  const guard=ScopedCompletionGuard.fresh(),signal=new AbortController();let settle,stops=0,releases=0;
  const error=Error('backend close failure');
  const input={read:()=>new Promise(resolve=>{settle=resolve;}),write:()=>new Promise(resolve=>{settle=resolve;}),
    terminateRead(){stops++;if(synchronous)throw error;return Promise.reject(error);},release:()=>{releases++;}};
  const pending=write?writeTcpWindow(input,guard,[1,2],{signal:signal.signal}):readTcpWindow(input,guard,{signal:signal.signal});
  signal.abort();await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual(guard.counts(),[1,1]);assert.equal(releases,0);
  assert.throws(()=>guard.acquire(1),error=>error===-2);
  settle(write?2:[1,2]);
  const failure=await pending.then(()=>assert.fail('stop must fail'),error=>error);
  assert.ok(failure instanceof TcpStopFailure);assert.equal(failure.cause,error);
  assert.equal(failure.owner.input,input);assert.equal(failure.owner.guard,guard);
  assert.deepEqual(guard.counts(),[1,1]);assert.equal(stops,1);assert.equal(releases,0);
  assert.throws(()=>guard.acquire(1),error=>error===-2);
  assert.throws(()=>guard.read(failure.owner.window),error=>error===-2);
  assert.throws(()=>guard.release(failure.owner.operation),error=>error===-4);
  if(write)assert.deepEqual(failure.primary,{state:'cancelled',effect:'possibly_partial',acknowledged:2});
  else assert.equal(failure.primary,-6);
  controls++;
}
for(const write of [false,true]){
  const guard=ScopedCompletionGuard.fresh(),signal=new AbortController();signal.abort();
  const input={read:()=>assert.fail('pre-aborted read'),write:()=>assert.fail('pre-aborted write'),terminateRead:()=>Promise.reject(-8),release:()=>assert.fail('failed close cannot release')};
  const pending=write?writeTcpWindow(input,guard,[1],{signal:signal.signal}):readTcpWindow(input,guard,{signal:signal.signal});
  const failure=await pending.then(()=>assert.fail('stop failure expected'),error=>error);
  assert.ok(failure instanceof TcpStopFailure);assert.deepEqual(guard.counts(),[0,0]);
  assert.equal(failure.owner.operation,undefined);assert.throws(()=>guard.acquire(1),error=>error===-2);
  if(write)assert.deepEqual(failure.primary,{state:'cancelled',effect:'none',acknowledged:0});
  controls++;
}
console.log(JSON.stringify({accepted:true,stop_failure_controls:controls,synchronous_and_async:true,resources_retained:true,new_grants_revoked:true,no_force_release:true,no_replay:true,native_failed_stop_qualified:false}));
