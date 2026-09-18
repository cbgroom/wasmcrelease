import { CompletionGuard } from './guard.mjs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const sessions=[new CompletionGuard(),new CompletionGuard()];
const steps=[],expected=[];
const add=(step,value)=>{steps.push(step);expected.push(value);};
const ok=v=>({ok:v}), err=v=>({error:v});
const poll=(state,drained,error=0)=>ok({state,drained,error});
add([0,'acquire',2],ok(65537));add([0,'submit',65537],ok(65538));
add([1,'poll',65538],err(-1));add([0,'release',65537],err(-4));add([0,'release',65538],err(-4));
add([0,'poll',4295032834],err(-1));
add([0,'complete',65538,[],-4294967296],err(-5));
add([0,'cancel',65538],ok(0));add([0,'poll',65538],poll('cancelled',false));add([0,'read',65537],err(-4));
add([0,'complete',65538,[1,2,3],0],err(-5));
add([0,'complete',65538,[7],0],ok(0));add([0,'poll',65538],poll('cancelled',true));add([0,'read',65537],ok([]));
add([0,'release',65538],ok(0));add([0,'release',65537],ok(0));add([0,'poll',65538],err(-1));
add([0,'acquire',2],ok(65539));add([0,'submit',65539],ok(65540));
add([0,'complete',65540,[1,2,3],0],err(-5));add([0,'poll',65540],poll('pending',false));
add([0,'complete',65540,[256],0],err(-5));
add([0,'complete',65540,[9,8],0],ok(0));add([0,'complete',65540,[3],0],err(-1));
add([0,'read',65539],ok([9,8]));add([0,'cancel',65540],err(-4));
add([0,'release',65540],ok(0));add([0,'release',65539],ok(0));
add([1,'acquire',1],ok(131073));add([1,'submit',131073],ok(131074));add([1,'revoke'],ok(0));
add([1,'read',131073],err(-2));add([1,'acquire',1],err(-2));
add([1,'complete',131074,[4],0],ok(0));add([1,'poll',131074],poll('cancelled',true));
add([1,'release',131074],ok(0));add([1,'release',131073],ok(0));
for(let i=5;i<=8;i++) add([0,'acquire',1],ok(65536+i));add([0,'acquire',1],err(-3));
for(let i=5;i<=8;i++) add([0,'release',65536+i],ok(0));
add([0,'acquire',1],ok(65545));add([0,'submit',65545],ok(65546));
add([0,'complete',65546,[],-8],ok(0));add([0,'poll',65546],poll('failed',true,-8));add([0,'read',65545],ok([]));
add([0,'release',65546],ok(0));add([0,'release',65545],ok(0));
for(let i=11;i<=17;i+=2) {
  add([0,'acquire',1],ok(65536+i));add([0,'submit',65536+i],ok(65537+i));
  add([0,'complete',65537+i,[],0],ok(0));add([0,'release',65536+i],ok(0));
}
add([0,'acquire',1],ok(65555));add([0,'submit',65555],err(-3));add([0,'release',65555],ok(0));
for(let i=12;i<=18;i+=2) add([0,'release',65536+i],ok(0));
const rows=[];
for(let i=0;i<steps.length;i++) {
  const [s,name,...args]=steps[i];let result;
  try {result=ok(sessions[s][name](...args));}catch(e){result=err(e);}
  assert.deepEqual(result,expected[i],JSON.stringify(steps[i]));
  rows.push({result,counts:sessions.map(g=>g.counts())});
}
assert.deepEqual(rows.at(-1).counts,[[0,0],[0,0]]);
const native=spawnSync(process.argv[2],[],{env:{},input:JSON.stringify(steps),encoding:'utf8',timeout:30000});
assert.equal(native.status,0,native.stderr);assert.deepEqual(JSON.parse(native.stdout),rows);
// A real asynchronous turn cannot deliver a cancelled completion or free its pin early.
const g=new CompletionGuard(),w=g.acquire(1),op=g.submit(w);
let finish;const completion=new Promise(resolve=>{finish=resolve;}).then(bytes=>g.complete(op,bytes));
g.cancel(op);assert.throws(()=>g.release(w),e=>e===-4);
finish([42]);await completion;assert.deepEqual(g.read(w),[]);g.release(op);g.release(w);
assert.deepEqual(g.counts(),[0,0]);
console.log(JSON.stringify({accepted:true,transitions:steps.length,sessions:2,counts_compared_each_step:true,late_completion_no_delivery:true,duplicate_no_replay:true,asynchronous_js_turn:true,resource_cleanup:true}));
