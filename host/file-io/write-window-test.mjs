import assert from 'node:assert/strict';
import {CommittedWriteWindow} from './write-window.mjs';
let controls=0;
const bad=(fn,code)=>{assert.throws(fn,e=>e===code);controls++;};
bad(()=>new CommittedWriteWindow(17),-5);bad(()=>new CommittedWriteWindow(-1),-5);
const w=new CommittedWriteWindow(4);
await assert.rejects(()=>w.writeTo({write:async()=>0},0),e=>e===-5);controls++;
bad(()=>w.commit([1],2),-5);bad(()=>w.commit([256],1),-5);bad(()=>w.commit([,2],2),-5);
const source=[1,2,3,4];w.commit(source,4);source.fill(99);
let finish,calls=0,seen;
const pending=w.writeTo({write(offset,bytes) {assert.equal(offset,0);seen=bytes;calls++;return new Promise(resolve=>{finish=resolve;});}},0);
bad(()=>w.commit([9],1),-4);bad(()=>w.release(),-4);
await assert.rejects(()=>w.writeTo({write:async()=>0},0),e=>e===-4);controls++;
assert.deepEqual(seen,[1,2,3,4]);finish(4);await pending;assert.equal(calls,1);w.release();
bad(()=>w.commit([],0),-1);bad(()=>w.release(),-1);
const failure=new CommittedWriteWindow(1);failure.commit([7],1);
let attempts=0;
await assert.rejects(()=>failure.writeTo({write:async()=>{attempts++;throw -9;}},0),e=>e===-9);controls++;
failure.release();assert.equal(attempts,1);
const reentrant=new CommittedWriteWindow(1);reentrant.commit([3],1);
let settle,write;
const getter=[];Object.defineProperty(getter,0,{get() {
  write=reentrant.writeTo({write:()=>new Promise(resolve=>{settle=resolve;})},0);return 8;
}});getter.length=1;
bad(()=>reentrant.commit(getter,1),-4);settle(1);await write;reentrant.release();
console.log(JSON.stringify({accepted:true,negative_controls:controls,owned_snapshot:true,
  pin_until_settlement:true,no_automatic_retry:true,reentrant_pin_protected:true,
  backend:'controlled-negative-fixture',real_io:false}));
