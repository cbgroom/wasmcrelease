import assert from 'node:assert/strict';
import {ScopedCompletionGuard} from '../../runtime/completion/scoped-guard.mjs';
import {TcpOwnerSupervisor} from './supervisor.mjs';
import {TcpGuardRetirementFailure} from './stop-fence.mjs';
const original=ScopedCompletionGuard.prototype.release;let controls=0;
for(const phase of ['before-operation','after-operation','before-window','after-window','unack-operation','unack-window']) {
  let reads=0,closes=0,stops=0,releases=0;
  const supervisor=new TcpOwnerSupervisor(1);
  const endpoint={read:async()=>{reads++;return new Array(17).fill(7);},release:async()=>{closes++;},terminateRead:async()=>{stops++;}};
  const first=await supervisor.read(endpoint).catch(e=>e),ticket=first.quarantineTicket;
  assert.equal(first.reason,'malformed-completion');assert.deepEqual(first.owner.guard.counts(),[1,1]);
  ScopedCompletionGuard.prototype.release=function(resource){
    releases++;const fail=releases===(phase.endsWith('operation')?1:2);
    if(fail&&phase.startsWith('before'))throw -8;
    const result=original.call(this,resource);
    if(fail&&phase.startsWith('unack'))return undefined;if(fail)throw -8;return result;
  };
  try {
    const failure=await supervisor.retireQuarantine(ticket).catch(e=>e);
    assert.ok(failure instanceof TcpGuardRetirementFailure);
    assert.equal(failure.quarantineTicket,ticket);assert.equal(failure.owner.endpointRetired,true);
    assert.equal(failure.primary,first.primary);assert.equal(failure.cause,-8);
    const counts=failure.owner.guard.counts();
    assert.deepEqual(counts,phase==='before-operation'?[1,1]:['after-window','unack-window'].includes(phase)?[0,0]:[1,0]);
    assert.deepEqual(supervisor.status(),{active:0,quarantined:1,limit:1});
    await assert.rejects(supervisor.retireQuarantine(ticket),e=>e===-7);
    await assert.rejects(supervisor.read(endpoint),e=>e===-4);
    await assert.rejects(supervisor.read({read:()=>assert.fail('quota I/O')}),e=>e===-3);
    assert.deepEqual(failure.owner.guard.counts(),counts);
    assert.equal(reads,1);assert.equal(closes,1);assert.equal(stops,1);controls++;
  }finally{ScopedCompletionGuard.prototype.release=original;}
}
console.log(JSON.stringify({accepted:true,quarantine_retirement_controls:controls,unknown_internal_mutation_retains_quota:true,explicit_retry_rejected:true,no_business_io_replay:true,requires_outer_isolation:true}));
