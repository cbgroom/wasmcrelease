// Controlled backend lifetime faults, not OS fault/recovery qualification.
import assert from 'node:assert/strict';
import {HostSession} from './session.mjs';
let controls=0;
const rejects=async (action,message)=>{await assert.rejects(action,message);controls++;};
const throws=(action,message)=>{assert.throws(action,message);controls++;};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const empty=session=>assert.deepEqual(session.counts(),{endpoints:0,unopened_grants:0,windows:0,operations:0,waiters:0,window_bytes:0});

const session=new HostSession([],{entropyFill:bytes=>bytes.fill(7)}),other=new HostSession([]);
const windows=Array.from({length:4},()=>session.window_acquire(16));
throws(()=>session.window_acquire(1),/limit/);
throws(()=>other.window_commit(windows[0],[1],1),/invalid-resource/);
throws(()=>session.window_commit({},[1],1),/invalid-resource/);
throws(()=>session.window_commit(windows[0],Array(1),1),/bounds/);
throws(()=>session.window_commit(windows[0],[256],1),/bounds/);
throws(()=>session.window_commit(windows[0],[1],2),/bounds/);
const ops=windows.map(window=>session.entropy_fill(window,16));
throws(()=>session.take_result(ops[0]),/busy/);
throws(()=>other.take_result(ops[0]),/invalid-resource/);
throws(()=>session.copy_out(windows[0]),/busy/);
await Promise.all([rejects(session.release(windows[0]),/busy/),rejects(session.release(ops[0]),/busy/)]);
await session.wait(ops);
// Terminal but unconsumed results still occupy all four slots.
assert.equal(session.counts().operations,4);
throws(()=>session.entropy_fill(windows[0],1),/limit/);
assert.equal(session.copy_out(windows[0]).length,16);
assert.equal(session.cancel(ops[0]),'already-terminal');controls++;
const taken=session.take_result(ops[0]);assert.equal(taken.transferred,16);controls++;
throws(()=>session.take_result(ops[0]),/already-terminal/);
assert.equal((await session.wait([ops[0]]))[0].result,taken);controls++;
assert.equal(session.counts().operations,4); // Taking does not retire the operation record.
for(const op of ops)await session.release(op);
await rejects(session.wait([ops[0]]),/invalid-resource/);
for(const window of windows)await session.release(window);
await session.release(session.root);empty(session);
await rejects(session.release(null),/invalid-resource/);
throws(()=>session.clock_read('wall'),/permission-denied/);
await other.release(other.root);empty(other);

const read=deferred(),close=deferred();let stops=0,closes=0;
const backend={read:()=>read.promise,write:async bytes=>bytes.length,
  terminateRead(){stops++;throw Error('controlled stop failure');},
  release:async()=>{closes++;if(closes===1)throw Error('controlled close failure');await close.promise;}};
const quarantine=new HostSession([{name:'peer',kind:'stream',backend,read:true,write:true}]);
const endpoint=quarantine.open(quarantine.root,'peer',{write:true}),window=quarantine.window_acquire(16);
const op=quarantine.read(endpoint,window,{length:16});
const waits=Array.from({length:4},()=>quarantine.wait([op],{timeoutMs:1000}));
await rejects(quarantine.wait([op]),/limit/);
await rejects(quarantine.wait([op,op]),/bounds/);
assert.deepEqual(await quarantine.wait([op],{timeoutMs:0}),[]);controls++;
assert.equal(quarantine.cancel(op),'accepted');assert.equal(quarantine.cancel(op),'accepted');assert.equal(stops,1);controls++;
await rejects(quarantine.release(window),/busy/);
await rejects(quarantine.release(endpoint),/busy/);
read.resolve([7]);
const results=await Promise.all(waits);
assert(results.every(result=>result[0].operation===op && result[0].quarantined && result[0].result.status==='cancelled'));controls++;
assert.equal(quarantine.counts().waiters,0);
throws(()=>quarantine.take_result(op),/cancelled/);
throws(()=>quarantine.take_result(op),/already-terminal/);
assert.equal(quarantine.counts().operations,1); // Error claim does not free quarantined pins.
throws(()=>quarantine.copy_out(window),/busy/);
await rejects(quarantine.release(op),/controlled close failure/);
assert.equal(quarantine.counts().operations,1);assert.equal(quarantine.counts().endpoints,1);controls++;
const retiring=quarantine.release(op);
await rejects(quarantine.release(op),/busy/);assert.equal(closes,2);
close.resolve();await retiring;
assert.deepEqual(quarantine.copy_out(window),[]);controls++;
await rejects(quarantine.release(endpoint),/invalid-resource/);
await quarantine.release(window);await quarantine.release(quarantine.root);empty(quarantine);

// Reentrant input getter retires its window: commit cannot revive it.
const reentrant=new HostSession([]),victim=reentrant.window_acquire(1);
const bytes=[];Object.defineProperty(bytes,0,{get(){void reentrant.release(victim);return 7;}});
throws(()=>reentrant.window_commit(victim,bytes,1),/invalid-resource/);
await reentrant.release(reentrant.root);empty(reentrant);

// Closing root is serialized and failed close keeps grants for explicit retry.
const rootClose=deferred();let attempts=0;
const grant={name:'file',kind:'file',read:false,write:false,backend:{release:async()=>{
  attempts++;if(attempts===1)throw Error('root-close-failure');await rootClose.promise;}}};
const rootSession=new HostSession([grant]),root=rootSession.root;
await rejects(rootSession.release(root),/root-close-failure/);
assert.equal(rootSession.counts().unopened_grants,1);controls++;
throws(()=>rootSession.open(root,'file'),/permission-denied/);
const rootRetiring=rootSession.release(root);await rejects(rootSession.release(root),/busy/);
rootClose.resolve();await rootRetiring;assert.equal(attempts,2);empty(rootSession);

// An accepted endpoint belongs to its operation until exactly-once claim.
let acceptedCloses=0,accepts=0,failedClose=true;
const acceptedBackend={read:async()=>[],write:async bytes=>bytes.length,release:async()=>{
  acceptedCloses++;if(failedClose){failedClose=false;throw Error('accepted-close-failure');}}};
const listening=new HostSession([{name:'listener',kind:'listener',read:true,write:true,
  backend:{accept:async()=>{accepts++;return acceptedBackend;},release:async()=>{}}}]);
const listener=listening.open(listening.root,'listener',{write:true});
const acceptedOp=listening.invoke(listener,'accept');
assert.equal(listening.counts().endpoints,2);controls++;
const passive=await listening.wait([acceptedOp]);
assert.equal(passive[0].result.kind,'endpoint');assert.equal('endpoint' in passive[0].result,false);controls++;
await rejects(listening.release(acceptedOp),/accepted-close-failure/);
throws(()=>listening.take_result(acceptedOp),/invalid-resource/); // Failed retirement is cleanup-only, never resurrection.
assert.equal(listening.counts().endpoints,2);assert.equal(listening.counts().operations,1);controls++;
await listening.release(acceptedOp);assert.equal(acceptedCloses,2);controls++;
const claimedOp=listening.invoke(listener,'accept');await listening.wait([claimedOp]);
const claimed=listening.take_result(claimedOp).endpoint;
assert.deepEqual(Object.keys(claimed),[]);controls++;
throws(()=>listening.take_result(claimedOp),/already-terminal/);
await listening.release(claimedOp);assert.equal(acceptedCloses,2);controls++;
await listening.release(claimed);assert.equal(acceptedCloses,3);assert.equal(accepts,2);controls++;
const revokedOp=listening.invoke(listener,'accept');await listening.wait([revokedOp]);listening.revoke();
throws(()=>listening.take_result(revokedOp),/permission-denied/);
await listening.release(revokedOp);await listening.release(listener);await listening.release(listening.root);empty(listening);
const arriving=deferred();let lateClosed=0;
const late=new HostSession([{name:'listener',kind:'listener',read:true,write:false,
  backend:{accept:()=>arriving.promise,terminateAccept:async()=>{},release:async()=>{}}}]);
const lateListener=late.open(late.root,'listener'),lateOp=late.invoke(lateListener,'accept');
assert.equal(late.cancel(lateOp),'accepted');controls++;
await rejects(late.release(lateOp),/busy/);
arriving.resolve({read:async()=>[],release:async()=>{lateClosed++;}});
await late.wait([lateOp]);throws(()=>late.take_result(lateOp),/cancelled/);
assert.equal(lateClosed,0);assert.equal(late.counts().endpoints,2);controls++;
await late.release(lateOp);assert.equal(lateClosed,1);controls++;
await late.release(lateListener);await late.release(late.root);empty(late);
let quotaAccepts=0;
const quota=new HostSession([{name:'listener',kind:'listener',read:true,write:false,
  backend:{accept:async()=>{quotaAccepts++;return {read:async()=>[],release:async()=>{}};},release:async()=>{}}}]);
const quotaListener=quota.open(quota.root,'listener'),held=[];
for(let i=0;i<3;i++){const op=quota.invoke(quotaListener,'accept');await quota.wait([op]);held.push(op);}
throws(()=>quota.invoke(quotaListener,'accept'),/limit/);
assert.equal(quotaAccepts,3);assert.equal(quota.counts().endpoints,4);controls++;
for(const op of held)await quota.release(op);
await quota.release(quotaListener);await quota.release(quota.root);empty(quota);
console.log(JSON.stringify({accepted:true,scope:'controlled-shared-session-lifetime-faults',controls,
  terminal_results_count_against_quota:true,waiters_bounded:true,foreign_stale_denied:true,
  failed_stop_and_close_retain_pins:true,explicit_cleanup_retry_only:true,reentrant_retirement_no_revival:true,
  resource_counts_zero:true,real_os_fault_proven:false,uniform_core_abi_accepted:false}));
