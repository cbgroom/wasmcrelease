import { MemoryHost } from './reference.mjs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const success = [['describe',1],['window_acquire',4],['window_commit',100,3],['invoke',1,100],['window_commit',100,2],['release',100],['wait',101],['wait',101],['cancel',101],['release',101],['release',100],['wait',101]];
const cancelled = [['window_acquire',4],['window_commit',100,4],['invoke',1,100],['cancel',101],['wait',101],['release',101],['release',100]];
assert.deepEqual(new MemoryHost().trace(success).map(r=>r[0]),[3,100,0,101,-4,-4,3,3,-4,0,0,-1]);
assert.deepEqual(new MemoryHost().trace(cancelled).at(-1),[0,0,0]);
const scenarios = [success,cancelled,
  [['invoke',2,100],['invoke',999,100],['window_acquire',17],['window_acquire',-1],['window_acquire',2],['window_commit',100,3],['release',999],['open',1]],
  Array.from({length:10},()=>['window_acquire',16])];
assert.deepEqual(new MemoryHost().trace(scenarios[2]).map(r=>r[0]),[-2,-1,-3,-3,100,-5,-1,-7]);
assert.deepEqual(new MemoryHost().trace(scenarios[3]).map(r=>r[0]),[100,101,102,103,104,105,106,107,-3,-3]);
// Deterministic adversarial corpus, independent of either implementation.
let seed=123456;
const names=['describe','window_acquire','window_commit','invoke','wait','cancel','release','unknown'];
for(let i=0;i<100;i++) {
  const steps=[];
  for(let j=0;j<100;j++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    steps.push([names[seed%8], [1,2,100,101,102,103,999,-1,0,16,17][(seed>>>4)%11], (seed>>>8)%20]);
  }
  scenarios.push(steps);
}
const expected=scenarios.map(s=>new MemoryHost().trace(s));
const native=spawnSync(process.argv[2],[],{env:{},input:JSON.stringify(scenarios),encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
if(native.status!==0) throw new Error(native.stderr);
assert.deepEqual(JSON.parse(native.stdout),expected);
console.log(JSON.stringify({accepted:true,scenarios:scenarios.length,transitions:scenarios.reduce((n,s)=>n+s.length,0),backend:'memory-simulator',real_io:false}));
