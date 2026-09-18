import assert from 'node:assert/strict';
import {ScopedCompletionGuard} from '../../runtime/completion/scoped-guard.mjs';
import {TcpOwnerSupervisor} from './supervisor.mjs';
import {TcpStopFailure} from './stop-fence.mjs';
const original=ScopedCompletionGuard.prototype.release;let controls=0;
for(const mode of ['read','write'])for(const phase of ['before-operation','after-operation','before-window','after-window','unack-operation','unack-window']) {
  let releases=0,reads=0,writes=0,closes=0,stops=0;
  ScopedCompletionGuard.prototype.release=function(ticket){
    releases++;
    const fail=releases===(phase.endsWith('operation')?1:2);
    if(fail&&phase.startsWith('before'))throw -8;
    const result=original.call(this,ticket);if(fail&&phase.startsWith('unack'))return undefined;if(fail)throw -8;return result;
  };
  try {
    const supervisor=new TcpOwnerSupervisor(1);
    const endpoint={read:async()=>{reads++;return[7];},write:async()=>{writes++;return 1;},release:async()=>{closes++;},terminateRead:async()=>{stops++;}};
    const failure=await (mode==='read'?supervisor.read(endpoint):supervisor.write(endpoint,[7])).catch(e=>e);
    assert.ok(failure instanceof TcpStopFailure);assert.equal(failure.reason,'guard-retirement');assert.equal(failure.cause,-8);
    assert.equal(failure.owner.endpointRetired,true);assert.equal(closes,1);assert.equal(reads+writes,1);assert.equal(stops,0);
    assert.deepEqual(supervisor.status(),{active:0,quarantined:1,limit:1});
    const counts=failure.owner.guard.counts();assert.deepEqual(counts,phase==='before-operation'?[1,1]:['after-window','unack-window'].includes(phase)?[0,0]:[1,0]);
    assert.deepEqual(failure.primary,mode==='read'?{state:'done',delivery:'suppressed_by_failed_retirement'}:{state:'done',effect:'accepted_locally',acknowledged:1});
    await assert.rejects(supervisor.read(endpoint),e=>e===-4);
    await assert.rejects(supervisor.read({read:()=>assert.fail('quota I/O')}),e=>e===-3);
    await assert.rejects(supervisor.retireQuarantine(failure.quarantineTicket),e=>e===-7);
    assert.deepEqual(failure.owner.guard.counts(),counts);assert.deepEqual(supervisor.status(),{active:0,quarantined:1,limit:1});
    assert.equal(closes,1);assert.equal(reads+writes,1);assert.equal(stops,0);controls++;
  }finally{ScopedCompletionGuard.prototype.release=original;}
}
console.log(JSON.stringify({accepted:true,guard_retirement_controls:controls,unknown_release_owner_retained:true,quarantine_counts_toward_quota:true,acknowledged_endpoint_not_reclosed:true,no_business_io_replay:true,automatic_recovery:false,requires_outer_isolation:true,controlled_internal_faults:true,native_async_qualified:false}));
