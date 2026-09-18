import assert from 'node:assert/strict';
import {ScopedCompletionGuard} from '../../runtime/completion/scoped-guard.mjs';
import {readTcpWindow} from './read-window.mjs';
import {writeTcpWindow} from './write-window.mjs';

let controls=0;
for(const write of [false,true])for(const signal of [0,'not a signal',{}, {removeEventListener:()=>assert.fail('invalid policy hook')}]){
  const guard=ScopedCompletionGuard.fresh();let released=0;
  const input={read:()=>assert.fail('invalid policy read'),write:()=>assert.fail('invalid policy write'),release:async()=>{released++;}};
  const pending=write?writeTcpWindow(input,guard,[1],{signal}):readTcpWindow(input,guard,{signal});
  await assert.rejects(pending,error=>error===-5);assert.deepEqual(guard.counts(),[0,0]);assert.equal(released,1);controls++;
}
for(const synchronous of [false,true]){
  const guard=ScopedCompletionGuard.fresh();let released=0,reads=0;
  const input={read(){reads++;if(synchronous)throw Error('immediate read error');return Promise.reject(Error('async read error'));},release:async()=>{released++;}};
  await assert.rejects(readTcpWindow(input,guard),error=>error===-8);
  assert.deepEqual(guard.counts(),[0,0]);assert.equal(reads,1);assert.equal(released,1);controls++;
}
console.log(JSON.stringify({accepted:true,driver_error_controls:controls,invalid_signal_no_io:true,synchronous_read_failure_drained:true,resource_cleanup:true,no_replay:true}));
