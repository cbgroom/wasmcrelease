import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PreauthorizedDatagram} from './adapter.mjs';

function controlled() {
  const socket=new EventEmitter();
  socket.address=()=>({address:'127.0.0.1',port:7});
  const trace={sends:0,closes:0};let callback;
  socket.send=(bytes,port,address,done)=>{trace.sends++;trace.bytes=bytes;assert.equal(port,8);assert.equal(address,'127.0.0.1');callback=done;};
  socket.close=()=>{trace.closes++;socket.emit('close');};
  return {socket,trace,settle:error=>callback(error),endpoint:new PreauthorizedDatagram(socket,{address:'127.0.0.1',port:8})};
}
let controls=0;
for(const failed of [false,true]) {
  const {socket,trace,settle,endpoint}=controlled(),input=[7];
  const write=endpoint.write(input),result=failed?assert.rejects(write,e=>e===-9):write;
  input[0]=99;input.push(255);assert.deepEqual([...trace.bytes],[7]);
  await assert.rejects(endpoint.read(),e=>e===-4);controls++;
  await assert.rejects(endpoint.release(),e=>e===-4);controls++;
  assert.throws(()=>endpoint.terminateRead(),e=>e===-4);controls++;
  assert.equal(trace.closes,0);assert.equal(trace.sends,1);
  settle(failed?new Error('controlled send completion failure'):undefined);
  if(failed)await result;else assert.equal(await result,1);
  await endpoint.release();assert.equal(trace.closes,1);assert.equal(trace.sends,1);controls++;
  await assert.rejects(endpoint.write([7]),e=>e===-1);controls++;
  assert.equal(socket.listenerCount('close'),0);
}
{
  const {socket,trace,endpoint}=controlled();
  socket.close=()=>{trace.closes++;if(trace.closes===1)throw new Error('controlled close failure');socket.emit('close');};
  await assert.rejects(endpoint.release(),/controlled close failure/);
  await assert.rejects(endpoint.read(),e=>e===-1);
  await assert.rejects(endpoint.write([1]),e=>e===-1);assert.equal(trace.sends,0);
  await endpoint.release();assert.equal(trace.closes,2);controls++;
}
{
  const {socket,trace,endpoint}=controlled();
  socket.close=()=>{trace.closes++;};
  let retired=false;const retirement=endpoint.release().then(()=>{retired=true;});
  await Promise.resolve();assert.equal(retired,false);
  await assert.rejects(endpoint.read(),e=>e===-4);
  await assert.rejects(endpoint.write([1]),e=>e===-4);
  socket.emit('close');await retirement;assert.equal(retired,true);
  assert.equal(trace.closes,1);assert.equal(trace.sends,0);controls++;
}
console.log(JSON.stringify({accepted:true,udp_retirement_controls:controls,pending_send_stop_denied:true,owned_send_snapshot:true,send_completion_before_release:true,close_ack_before_retirement:true,failed_close_explicit_retry_only:true,no_business_io_replay:true,controlled_backend:true,os_fault_qualified:false,native_async_qualified:false}));
