import assert from 'node:assert/strict';
import {ScopedCompletionGuard} from '../completion/scoped-guard.mjs';
import {TcpOwnerSupervisor} from './supervisor.mjs';
const supervisor=new TcpOwnerSupervisor(1),fresh=ScopedCompletionGuard.fresh;
let bindings=0,reads=0,closes=0,checksum=0;const samples=[];
ScopedCompletionGuard.fresh=function(...args){bindings++;return fresh.apply(this,args);};
try {
  for(let sample=0;sample<5;sample++) {
    const start=performance.now();
    for(let i=0;i<10000;i++) {
      const value=await supervisor.read({read:async()=>{reads++;return[7];},release:async()=>{closes++;}});
      assert.deepEqual(value,[7]);checksum+=value[0];
    }
    samples.push(performance.now()-start);
  }
}finally{ScopedCompletionGuard.fresh=fresh;}
assert.equal(reads,50000);assert.equal(closes,50000);assert.equal(checksum,350000);
assert.deepEqual(supervisor.status(),{active:0,quarantined:0,limit:1});
const sorted=[...samples].sort((a,b)=>a-b);
console.log(JSON.stringify({accepted:true,workload:'controlled read completion retirement owner bookkeeping',calls:reads,closes,checksum,fresh_guard_bindings:bindings,samples_ms:samples,median_ns_per_call:sorted[2]*1e6/10000,real_io:false,network_tps:false,performance_threshold:false,native_async_qualified:false}));
