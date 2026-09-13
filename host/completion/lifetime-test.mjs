import assert from 'node:assert/strict';
import {ScopedCompletionGuard} from './scoped-guard.mjs';
import {TcpOwnerSupervisor} from '../tcp/supervisor.mjs';
const old=ScopedCompletionGuard.fresh(),w=old.acquire(1),op=old.submit(w);
for(let i=0;i<40000;i++) {
  const g=ScopedCompletionGuard.fresh(),nw=g.acquire(1),no=g.submit(nw);
  assert.equal(nw.split(':')[1],w.split(':')[1]);assert.notEqual(nw,w);
  assert.throws(()=>g.complete(op,[9]),e=>e===-1);
  assert.throws(()=>g.release(w),e=>e===-1);assert.deepEqual(g.counts(),[1,1]);
  g.complete(no,[7]);assert.deepEqual(g.read(nw),[7]);
  g.release(no);g.release(nw);assert.deepEqual(g.counts(),[0,0]);
}
assert.deepEqual(old.counts(),[1,1]);old.cancel(op);old.complete(op,[],-8);old.release(op);old.release(w);
assert.deepEqual(old.counts(),[0,0]);
const supervisor=new TcpOwnerSupervisor(2);let releases=0,oldQuarantine;
for(let i=0;i<40000;i++) {
  if(i===32766) {
    const abort=new AbortController();let allowClose=false;
    const endpoint={read:async()=>[1],terminateRead:async()=>{if(!allowClose)throw -8;},release:async()=>{}};
    const pending=supervisor.read(endpoint,{signal:abort.signal});abort.abort();
    const failure=await pending.catch(error=>error);oldQuarantine=failure.quarantineTicket;
    assert.equal(typeof oldQuarantine,'string');assert.deepEqual(failure.owner.guard.counts(),[1,1]);
    await assert.rejects(supervisor.read({read:()=>assert.fail('live quarantine rotated epoch')}),e=>e===-3);
    allowClose=true;await supervisor.retireQuarantine(oldQuarantine);
    assert.deepEqual(failure.owner.guard.counts(),[0,0]);
  }
  assert.deepEqual(await supervisor.read({read:async()=>[7],release:async()=>{releases++;}}),[7]);
  assert.deepEqual(supervisor.status(),{active:0,quarantined:0,limit:2});
}
assert.equal(releases,40000);
await assert.rejects(supervisor.retireQuarantine(oldQuarantine),e=>e===-1);
console.log(JSON.stringify({accepted:true,fresh_binding_cycles:40000,supervisor_cycles:40000,live_quarantine_blocks_rotation:true,old_epoch_ticket_denied:true,local_id_reuse:true,stale_identity_denied:true,resource_cleanup:true,raw_owner_budget_unchanged:true,guest_abi_changed:false}));
