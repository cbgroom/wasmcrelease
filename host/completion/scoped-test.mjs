import { ScopedCompletionGuard, issueBindingIdentity } from './scoped-guard.mjs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const a=randomBytes(32).toString('hex'),b=randomBytes(32).toString('hex');assert.notEqual(a,b);
const runtimeArgs=process.versions.deno?['run','host/completion/scoped-reference.mjs']:['host/completion/scoped-reference.mjs'];
function child(binary,prefix,args) {
  const r=spawnSync(binary,[...prefix,...args],{env:{},encoding:'utf8',timeout:30000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
const native=process.argv[2];
const jsOld=child(process.execPath,runtimeArgs,['create',a]);const nativeOld=child(native,[],['create',a]);
assert.deepEqual(jsOld,nativeOld);
const jsNew=child(process.execPath,runtimeArgs,['exercise',b,jsOld.window,jsOld.operation]);
const nativeNew=child(native,[],['exercise',b,nativeOld.window,nativeOld.operation]);assert.deepEqual(jsNew,nativeNew);
assert.equal(jsOld.window.split(':')[1],jsNew.window.split(':')[1]);
assert.equal(jsOld.operation.split(':')[1],jsNew.operation.split(':')[1]);
assert.notEqual(jsOld.window,jsNew.window);assert.deepEqual(jsNew.foreign,Array(6).fill(-1));
assert.deepEqual(jsNew.live,[1,1]);assert.deepEqual(jsNew.bytes,[7]);assert.deepEqual(jsNew.final,[0,0]);
let negative=0;
for(const identity of ['', '0'.repeat(64),'f'.repeat(63),'G'.repeat(64),'F'.repeat(64),null]) {
  assert.throws(()=>new ScopedCompletionGuard(identity),e=>e===-5);negative++;
}
const g=new ScopedCompletionGuard(a),w=g.acquire(1),op=g.submit(w);
for(const ticket of [null,{},'',a+':0',a+':065537',a+':2147483648',a+':65537:extra',b+':65537']) {
  assert.throws(()=>g.poll(ticket),e=>e===-1);assert.deepEqual(g.counts(),[1,1]);negative++;
}
g.cancel(op);assert.throws(()=>g.release(w),e=>e===-4);g.complete(op,[7]);assert.deepEqual(g.read(w),[]);
g.release(op);g.release(w);assert.deepEqual(g.counts(),[0,0]);
let entropyControls=0;
for(const [fill,error] of [[()=>{throw Error('entropy unavailable');},-8],[bytes=>{bytes[0]=7;throw Error('partial failure');},-8],[()=>{},-5],[()=>Promise.resolve(),-8]]) {
  assert.throws(()=>issueBindingIdentity(fill),e=>e===error);entropyControls++;
}
assert.equal(issueBindingIdentity(bytes=>bytes.fill(7)),'07'.repeat(32));entropyControls++;
const seen=new Set();
for(const [binary,prefix] of [[process.execPath,runtimeArgs],[native,[]]]) {
  const old=child(binary,prefix,['fresh-create']);
  const fresh=child(binary,prefix,['fresh-exercise','',old.window,old.operation]);
  assert.equal(old.window.split(':')[1],fresh.window.split(':')[1]);
  for(const ticket of [old.window,fresh.window]) {
    const identity=ticket.split(':')[0];assert.match(identity,/^[0-9a-f]{64}$/);assert.notEqual(identity,'0'.repeat(64));assert.ok(!seen.has(identity));seen.add(identity);
  }
  assert.deepEqual(fresh.foreign,Array(6).fill(-1));assert.deepEqual(fresh.live,[1,1]);assert.deepEqual(fresh.bytes,[7]);assert.deepEqual(fresh.final,[0,0]);
}
console.log(JSON.stringify({accepted:true,independent_processes:8,local_id_collision_verified:true,foreign_operations_denied:6,negative_controls:negative,entropy_controls:entropyControls,host_issued_identities:seen.size,resource_cleanup:true,injected_wire_fixture_only:true,guest_abi_changed:false}));
