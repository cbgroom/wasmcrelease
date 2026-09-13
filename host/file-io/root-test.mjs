import assert from 'node:assert/strict';
import {PreopenedRoot} from './root.mjs';
let controls=0;
const bad=(fn,code)=>{assert.throws(fn,e=>e===code);controls++;};
const file={close:async()=>{}}; // Negative ownership controls, not real I/O proof.
bad(()=>new PreopenedRoot(Array.from({length:5},(_,i)=>({name:`f${i}`,file:{close:async()=>{}},writable:false}))),-3);
bad(()=>new PreopenedRoot([{name:'../escape',file,writable:false}]),-5);
bad(()=>new PreopenedRoot([{name:'a',file,writable:false},{name:'a',file:{close:async()=>{}},writable:false}]),-5);
bad(()=>new PreopenedRoot([{name:'a',file,writable:false},{name:'b',file,writable:false}]),-5);
bad(()=>new PreopenedRoot([{name:'a',file,writable:1}]),-5);
const root=new PreopenedRoot([{name:'a',file,writable:false}]);
bad(()=>root.open('a',{write:true}),-2);assert.equal(root.describe().length,1);
bad(()=>root.open('a',{write:1}),-5);assert.equal(root.describe().length,1);
const child=root.open('a');bad(()=>root.open('a'),-2);await child.release();await root.release();
let closes=0,finish;
const retained=new PreopenedRoot([{name:'retry',writable:false,file:{close() {
  closes++;return closes===1?Promise.reject(Error('close failure')):new Promise(resolve=>{finish=resolve;});
}}}]);
await assert.rejects(()=>retained.release(),e=>e===-8);controls++;
bad(()=>retained.open('retry'),-1);
bad(()=>retained.describe(),-1);
const retry=retained.release();await assert.rejects(()=>retained.release(),e=>e===-4);controls++;
finish();await retry;assert.equal(closes,2);await retained.release();assert.equal(closes,2);
console.log(JSON.stringify({accepted:true,negative_controls:controls,failed_close_retained:true,
  retry_only_retirement:true,busy_release_nonconsuming:true,backend:'controlled-negative-fixture',real_io:false}));
