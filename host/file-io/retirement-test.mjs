import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PreopenedFile} from './adapter.mjs';
import {PreconnectedTcp} from '../tcp/adapter.mjs';
let controls=0;
for(const synchronous of [false,true]) {
  let calls=0,allow=false,ack;
  const file={close(){calls++;if(!allow){if(synchronous)throw Error('close fault');return Promise.reject(Error('close fault'));}return new Promise(resolve=>{ack=resolve;});},read(){assert.fail('retired file read');},write(){assert.fail('retired file write');},sync(){assert.fail('retired file sync');}};
  const endpoint=new PreopenedFile(file,true);
  await assert.rejects(endpoint.release(),e=>e===-8);assert.equal(endpoint.file,file);
  await assert.rejects(endpoint.read(0,1),e=>e===-1);
  await assert.rejects(endpoint.write(0,[1]),e=>e===-1);
  await assert.rejects(endpoint.invokeSync(),e=>e===-1);assert.equal(calls,1);
  allow=true;const pending=endpoint.release();assert.equal(endpoint.file,file);
  await assert.rejects(endpoint.release(),e=>e===-4);
  await assert.rejects(endpoint.read(0,1),e=>e===-4);
  ack();assert.equal(await pending,0);assert.equal(endpoint.file,null);
  await assert.rejects(endpoint.release(),e=>e===-1);assert.equal(calls,2);controls++;
}
{
  let calls=0,allow=false;
  const socket=new EventEmitter();socket.destroyed=false;socket.closed=false;
  socket.pause=()=>{};socket.write=()=>assert.fail('retired socket write');
  socket.destroy=()=>{calls++;if(!allow)throw Error('destroy fault');socket.destroyed=true;return socket;};
  const endpoint=new PreconnectedTcp(socket);
  await assert.rejects(endpoint.release(),e=>e.message==='destroy fault');
  await assert.rejects(endpoint.read(1),e=>e===-1);
  await assert.rejects(endpoint.write([1]),e=>e===-1);assert.equal(calls,1);
  allow=true;let settled=false;const pending=endpoint.release().then(value=>{settled=true;return value;});
  await assert.rejects(endpoint.release(),e=>e===-4);
  await assert.rejects(endpoint.write([1]),e=>e===-4);assert.equal(settled,false);
  assert.equal(socket.destroyed,true); // destroyed is deliberately not close ack.
  socket.closed=true;socket.emit('close');assert.equal(await pending,0);
  await assert.rejects(endpoint.release(),e=>e===-1);assert.equal(calls,2);controls++;
}
console.log(JSON.stringify({accepted:true,retirement_controls:controls,failed_close_owner_retained:true,pending_close_busy:true,destroyed_not_ack:true,explicit_close_retry_only:true,business_io_calls:0,general_driver_quarantine_qualified:false}));
