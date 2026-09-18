import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from '../../../current/wasmc.mjs';
import {createResidentApp} from './resident-app.mjs';
const root=new URL('../../../',import.meta.url);
const app=await createResidentApp(await readFile(new URL('libs/wasmc-owned-algorithms/artifact.wasm',root)),await compile(await readFile(new URL('host/tests/e2e/guest.wasmc',root),'utf8')));
let controls=0;
try {
  let reads=0;const unstable=[7];Object.defineProperty(unstable,0,{get:()=>++reads===1?7:256});
  assert.equal(app.call(unstable),7n);assert.equal(reads,1);controls++;
  let lengths=0;const lengthProxy=new Proxy([8],{get:(target,key)=>key==='length'?(++lengths===1?1:17):Reflect.get(target,key)});
  assert.equal(app.call(lengthProxy),8n);assert.equal(lengths,1);controls++;
  const misleading=[256];misleading[Symbol.iterator]=function*(){yield 7;};const before=app.libCalls();
  assert.throws(()=>app.call(misleading),e=>e===-5);assert.equal(app.libCalls(),before);controls++;
  let traversals=0;const traversal=[7];traversal.forEach=fn=>{traversals++;fn(256,16);};
  assert.equal(app.call(traversal),7n);assert.equal(traversals,0);controls++;
  const count=app.libCalls();assert.throws(()=>app.call(new Array(1)),e=>e===-5);assert.equal(app.libCalls(),count);controls++;
  const reentrant=[9];Object.defineProperty(reentrant,0,{get:()=>{
    const calls=app.libCalls();assert.throws(()=>app.call([1]),e=>e===-8);assert.throws(()=>app.release(),e=>e===-4);assert.equal(app.libCalls(),calls);return 9;
  }});
  assert.equal(app.call(reentrant),9n);controls++;
  const broken=[7];Object.defineProperty(broken,0,{get:()=>{throw -9;}});const prior=app.libCalls();
  assert.throws(()=>app.call(broken),e=>e===-9);assert.equal(app.libCalls(),prior);assert.equal(app.call([7]),7n);controls++;
  assert.throws(()=>app.call(new Array(17).fill(1)),e=>e===-5);assert.equal(app.call([7]),7n);controls++;
  assert.throws(()=>app.call([7],1));const trapped=app.libCalls();assert.throws(()=>app.call([7]),e=>e===-8);assert.equal(app.libCalls(),trapped);controls++;
}finally{app.release();}
console.log(JSON.stringify({accepted:true,resident_snapshot_controls:controls,indexed_capture_once:true,external_iteration_ignored:true,preissue_failure_no_lib_call:true,preissue_reentry_denied:true,post_trap_no_replay:true,curated_fixture_not_untrusted_sdk:true}));
