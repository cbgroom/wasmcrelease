import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PreconnectedTcp} from './adapter.mjs';
function socket(){const s=new EventEmitter();s.destroyed=false;s.closed=false;s.pause=()=>{};s.resume=()=>{};s.destroy=()=>{s.destroyed=true;s.closed=true;s.emit('close');};return s;}
let controls=0;
for(const limit of [0,-1,65537,NaN,0.5]) {assert.throws(()=>new PreconnectedTcp(socket(),true,limit),e=>e===-5);controls++;}
for(const queued of [false,true]) {
  const s=socket(),tcp=new PreconnectedTcp(s,true,4);
  let pending;if(!queued)pending=assert.rejects(tcp.read(1),e=>e===-3);
  s.emit('data',Uint8Array.of(1,2,3,4,5));
  if(pending)await pending;
  await assert.rejects(tcp.read(1),e=>e===-3);await assert.rejects(tcp.write([1]),e=>e===-3);
  assert.equal(tcp.bufferedBytes(),0);await tcp.release();controls++;
}
{
  const s=socket(),tcp=new PreconnectedTcp(s,true,4);
  s.emit('data',Uint8Array.of(1,2,3));s.emit('data',Uint8Array.of(4,5));
  assert.equal(tcp.bufferedBytes(),3);await assert.rejects(tcp.read(1),e=>e===-3);
  await tcp.release();assert.equal(tcp.bufferedBytes(),0);controls++;
}
{
  const s=socket(),tcp=new PreconnectedTcp(s,true,4);
  s.emit('data',Uint8Array.of(1,2,3,4));assert.equal(tcp.bufferedBytes(),4);
  assert.deepEqual(await tcp.read(2),[1,2]);s.emit('data',Uint8Array.of(5,6));
  assert.deepEqual(await tcp.read(4),[3,4,5,6]);assert.equal(tcp.bufferedBytes(),0);await tcp.release();controls++;
}
{
  const s=socket();s.destroy=()=>{s.destroyed=true;};
  const tcp=new PreconnectedTcp(s,true,4);s.emit('data',Uint8Array.of(1,2,3));s.emit('data',Uint8Array.of(4,5));
  let settled=false;const pending=tcp.release().then(()=>{settled=true;});
  await assert.rejects(tcp.read(1),e=>e===-4);assert.equal(tcp.bufferedBytes(),3);assert.equal(settled,false);
  s.closed=true;s.emit('close');await pending;assert.equal(tcp.bufferedBytes(),0);controls++;
}
console.log(JSON.stringify({accepted:true,tcp_buffer_budget_controls:controls,overflow_no_delivery:true,copy_before_budget_check:false,release_after_close_ack:true,no_io_replay:true,native_buffer_budget_qualified:false}));
