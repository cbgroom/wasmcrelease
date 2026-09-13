import assert from 'node:assert/strict';
import {TcpOwnerSupervisor} from './supervisor.mjs';
let controls=0;
for(const mode of ['getter','length']) {
  let reads=0,writes=0,closes=0;
  const data=mode==='length'?new Proxy([7],{get(target,key){return key==='length'?(++reads===1?1:17):Reflect.get(target,key);}}):[];
  if(mode==='getter')Object.defineProperty(data,0,{get(){return ++reads===1?7:256;}});
  const input={write:async bytes=>{writes++;assert.deepEqual(bytes,[7]);return 1;},release:async()=>{closes++;},terminateRead:()=>assert.fail('unexpected stop')};
  const supervisor=new TcpOwnerSupervisor(1);
  assert.deepEqual(await supervisor.write(input,data),{state:'done',effect:'accepted_locally',acknowledged:1});
  assert.equal(reads,1);assert.equal(writes,1);assert.equal(closes,1);assert.deepEqual(supervisor.status(),{active:0,quarantined:0,limit:1});controls++;
}
for(const data of [Array(1),[256],[-1],[0.5],[NaN],Array(17).fill(7)]) {
  let closes=0;const input={write:()=>assert.fail('invalid bytes issued'),release:async()=>{closes++;},terminateRead:()=>assert.fail('invalid stop')};
  await assert.rejects(new TcpOwnerSupervisor(1).write(input,data),e=>e===-5);assert.equal(closes,1);controls++;
}
console.log(JSON.stringify({accepted:true,tcp_driver_write_snapshot_controls:controls,index_read_once:true,invalid_before_io:true,retirement_verified:true,no_business_io_replay:true,controlled_backend:true,native_async_qualified:false}));
