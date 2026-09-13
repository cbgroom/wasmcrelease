import assert from 'node:assert/strict';
import {PreopenedFile} from './adapter.mjs';
let controls=0;
{
  const calls=[];let ack;
  const file={write(bytes,start,length,position){calls.push({bytes:[...bytes],start,length,position});return calls.length===1?new Promise(resolve=>{ack=resolve;}):Promise.resolve({bytesWritten:length});},async close(){}};
  const endpoint=new PreopenedFile(file,true), input=[1,2,3];
  const pending=endpoint.write(4,input);
  input[1]=99;input.push(4);
  await assert.rejects(endpoint.release(),e=>e===-4);
  ack({bytesWritten:1});assert.equal(await pending,3);
  assert.deepEqual(calls,[{bytes:[1,2,3],start:0,length:3,position:4},{bytes:[2,3],start:0,length:2,position:5}]);
  await endpoint.release();controls++;
}
{
  let reads=0,issued;
  const input=[];Object.defineProperty(input,0,{get(){reads++;return reads===1?7:256;}});
  const endpoint=new PreopenedFile({async write(bytes){issued=[...bytes];return {bytesWritten:bytes.length};},async close(){}},true);
  assert.equal(await endpoint.write(0,input),1);assert.equal(reads,1);assert.deepEqual(issued,[7]);await endpoint.release();controls++;
}
for(const bytesWritten of [0,-1,4,NaN,0.5]) {
  let calls=0;
  const endpoint=new PreopenedFile({async write(){calls++;return {bytesWritten};},async close(){}},true);
  await assert.rejects(endpoint.write(0,[1,2,3]),e=>e===-9);assert.equal(calls,1);await endpoint.release();controls++;
}
console.log(JSON.stringify({accepted:true,file_write_snapshot_controls:controls,caller_mutation_isolated:true,index_read_once:true,malformed_ack_rejected:true,business_io_replay:false,os_fault_qualified:false}));
