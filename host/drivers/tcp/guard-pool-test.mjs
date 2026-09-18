import assert from 'node:assert/strict';
import {ScopedCompletionGuard} from '../../runtime/completion/scoped-guard.mjs';
import {TcpOwnerSupervisor} from './supervisor.mjs';
const fresh=ScopedCompletionGuard.fresh,submit=ScopedCompletionGuard.prototype.submit,release=ScopedCompletionGuard.prototype.release;
let controls=0;
async function observed(task) {
  const guards=[],tickets=[];
  ScopedCompletionGuard.fresh=function(){const guard=fresh.call(this);guards.push(guard);return guard;};
  ScopedCompletionGuard.prototype.submit=function(window){const operation=submit.call(this,window);tickets.push({guard:this,window,operation});return operation;};
  try{await task(guards,tickets);}finally{ScopedCompletionGuard.fresh=fresh;ScopedCompletionGuard.prototype.submit=submit;ScopedCompletionGuard.prototype.release=release;}
}
const immediate=()=>({read:async()=>[7],release:async()=>{}});
await observed(async(guards,tickets)=>{
  const supervisor=new TcpOwnerSupervisor(1);
  for(let i=0;i<40000;i++)assert.deepEqual(await supervisor.read(immediate()),[7]);
  assert.equal(guards.length,3);assert.equal(new Set(tickets.map(t=>t.operation)).size,40000);
  const first=tickets[0];assert.throws(()=>first.guard.poll(first.operation),e=>e===-1);
  for(const guard of guards){assert.throws(()=>guard.release(first.window),e=>e===-1);assert.deepEqual(guard.counts(),[0,0]);}
  assert.deepEqual(supervisor.status(),{active:0,quarantined:0,limit:1});controls++;
});
await observed(async(guards,tickets)=>{
  const supervisor=new TcpOwnerSupervisor(2);let ackA,ackB;
  const a=supervisor.read({read:async()=>[7],release:()=>new Promise(resolve=>{ackA=resolve;})});
  const b=supervisor.read({read:async()=>[7],release:()=>new Promise(resolve=>{ackB=resolve;})});
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(guards.length,2);
  await assert.rejects(supervisor.read(immediate()),e=>e===-3);assert.equal(guards.length,2);
  ackA();await a;const previous=tickets[0];let deliver;
  const c=supervisor.read({read:()=>new Promise(resolve=>{deliver=resolve;}),release:async()=>{}});
  assert.equal(guards.length,2);assert.equal(tickets[2].guard,previous.guard);
  assert.throws(()=>previous.guard.complete(previous.operation,[9]),e=>e===-1);assert.deepEqual(previous.guard.counts(),[1,1]);
  deliver([7]);await c;ackB();await b;assert.deepEqual(supervisor.status(),{active:0,quarantined:0,limit:2});controls++;
});
await observed(async(guards)=>{
  const supervisor=new TcpOwnerSupervisor(1),abort=new AbortController();let deliver;
  const pending=supervisor.read({read:()=>new Promise(resolve=>{deliver=resolve;}),terminateRead:async()=>{},release:async()=>{}},{signal:abort.signal,revokeOnAbort:true});
  abort.abort();deliver([7]);await assert.rejects(pending,e=>e===-2);
  assert.equal(guards[0].reusable(),false);assert.deepEqual(guards[0].counts(),[0,0]);
  await supervisor.read(immediate());assert.equal(guards.length,2);controls++;
});
await observed(async(guards)=>{
  const supervisor=new TcpOwnerSupervisor(1);const input={read:async()=>Array(17).fill(7),terminateRead:async()=>{},release:async()=>{}};
  const failure=await supervisor.read(input).catch(e=>e);assert.equal(failure.reason,'malformed-completion');
  await assert.rejects(supervisor.read(immediate()),e=>e===-3);assert.equal(guards.length,1);
  await supervisor.retireQuarantine(failure.quarantineTicket);await supervisor.read(immediate());
  assert.equal(guards.length,2);assert.equal(guards[0].reusable(),false);controls++;
});
await observed(async(guards)=>{
  const supervisor=new TcpOwnerSupervisor(2);let calls=0;
  ScopedCompletionGuard.prototype.release=function(ticket){const value=release.call(this,ticket);if(++calls===2)throw -8;return value;};
  const failure=await supervisor.read(immediate()).catch(e=>e);assert.equal(failure.reason,'guard-retirement');
  ScopedCompletionGuard.prototype.release=release;assert.deepEqual(failure.owner.guard.counts(),[0,0]);
  await supervisor.read(immediate());assert.equal(guards.length,2);assert.equal(guards[0].reusable(),false);
  assert.deepEqual(supervisor.status(),{active:0,quarantined:1,limit:2});controls++;
});
console.log(JSON.stringify({accepted:true,guard_pool_controls:controls,rotation_cycles:40000,fresh_bindings_for_rotation:3,unique_operation_tickets:40000,pending_or_revoked_not_reused:true,empty_unknown_quarantine_not_reused:true,close_ack_before_reuse:true,controlled_backend:true,real_io:false,native_pool_qualified:false}));
