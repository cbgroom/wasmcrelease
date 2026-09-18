import assert from 'node:assert/strict';
import {PreopenedFile} from './adapter.mjs';
let controls=0;
for(const bytesRead of [-1,4,NaN,0.5,undefined]) {
  let calls=0;
  const endpoint=new PreopenedFile({async read(bytes){calls++;bytes.set([7,8,9]);return {bytesRead};},async close(){}},false);
  await assert.rejects(endpoint.read(0,3),e=>e===-8);assert.equal(calls,1);await endpoint.release();controls++;
}
for(const bytesRead of [0,1,3]) {
  const endpoint=new PreopenedFile({async read(bytes){bytes.set([7,8,9]);return {bytesRead};},async close(){}},false);
  assert.deepEqual(await endpoint.read(0,3),[7,8,9].slice(0,bytesRead));await endpoint.release();controls++;
}
console.log(JSON.stringify({accepted:true,file_read_completion_controls:controls,invalid_count_no_delivery:true,business_io_replay:false,os_fault_qualified:false}));
