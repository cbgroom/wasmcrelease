import assert from 'node:assert/strict';
import {encodeAndroidText} from './native-platform/android-input/platform/encode.mjs';
for (const text of ['a', '雪🙂'.repeat(12000)]) {
  const frame=encodeAndroidText(text), data=new TextDecoder().decode(frame.subarray(5));
  assert.equal(frame[0],4);assert.equal(new DataView(frame.buffer).getUint32(1,true),frame.length-5);assert.equal(data,text);
}
const legacy=encodeAndroidText('雪'.repeat(1000),{legacy:true});assert.equal(legacy[0],2);assert.equal(new DataView(legacy.buffer).getUint16(1,true),3000);
assert.throws(()=>encodeAndroidText('x'.repeat(65536),{legacy:true}),RangeError);
assert.throws(()=>encodeAndroidText(''),RangeError);assert.throws(()=>encodeAndroidText('x\0y'),RangeError);
console.log(JSON.stringify({accepted:true,new_utf8_bytes:84000,legacy_bytes:3000,invalid_rejected:true,device_test:false}));
