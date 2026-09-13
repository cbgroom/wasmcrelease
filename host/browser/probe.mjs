import {createResidentApp} from '../tcp/resident-app.mjs';
import {ScopedCompletionGuard} from '../completion/scoped-guard.mjs';
import {readTcpWindow} from '../tcp/read-window.mjs';
import {writeTcpWindow} from '../tcp/write-window.mjs';
import {TcpStopFailure} from '../tcp/stop-fence.mjs';
import {TcpOwnerSupervisor} from '../tcp/supervisor.mjs';
import {MemoryHost} from '../v0/reference.mjs';

const check=(condition,message)=>{if(!condition)throw Error(message);};
const equal=(a,b)=>check(JSON.stringify(a)===JSON.stringify(b),'value mismatch');
const rejects=(call,code)=>{try{call();}catch(error){check(error===code,'error mismatch');return;}throw Error('expected rejection');};
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function load(url){const response=await fetch(url);check(response.ok,'fixture unavailable');return new Uint8Array(await response.arrayBuffer());}
async function run(){
  const kernelBytes=await load('/fixture/kernel.wasm'),memoryHost=new MemoryHost(),imports={};
  check(await digest(kernelBytes)==='3774b4d3484abf247f56dbd0adc28295fcafe2e06fe0247b797d2b7aef1abe21','kernel drift');
  for(const name of ['describe','window_acquire','window_commit','invoke','wait','cancel','release'])imports[name]=(a,b)=>memoryHost.step([name,a,b]);
  const kernel=await WebAssembly.instantiate(kernelBytes,{host:imports});
  for(const size of [0,1,4,16]){check(kernel.instance.exports.run(size)===size,'kernel result');check(memoryHost.windows.size===0&&memoryHost.ops.size===0,'kernel cleanup');equal(memoryHost.bytes,Array(size).fill(42));}
  const lib=await load('/libs/wasmc-owned-algorithms/artifact.wasm'),guest=await load('/fixture/guest.wasm');
  const libSha=await digest(lib),appSha=await digest(guest);
  check(libSha==='44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3','Lib drift');
  check(appSha==='4eff84eccf06251a0b5de89e81d4faaeb5f51bce18724d8f011b95ea0ab7fd19','App drift');
  const app=await createResidentApp(lib,guest);
  try{
    for(const size of [0,1,4,16])check(app.call(Array(size).fill(7))===BigInt(size*7),'guest result');
    for(let i=0;i<1000;i++)check(app.call([7,i%200])===BigInt(7+i%200),'resident result');
    rejects(()=>app.call(Array(17).fill(1)),-5);check(app.libCalls()===1004,'budget side effect');
    try{app.call([7],1);throw Error('expected guest trap');}catch(error){check(error instanceof WebAssembly.RuntimeError,'wrong trap');}
    rejects(()=>app.call([7]),-8);check(app.libCalls()===1005,'guest replay');
  }finally{app.release();}
  let guardCases=0;
  for(const size of [0,1,4,16]){
    const guard=ScopedCompletionGuard.fresh(),foreign=ScopedCompletionGuard.fresh();
    const window=guard.acquire(size),op=guard.submit(window);
    rejects(()=>foreign.poll(op),-1);guard.cancel(op);guard.complete(op,Array(size).fill(1));
    guard.release(op);guard.release(window);equal(guard.counts(),[0,0]);guardCases++;
  }
  let completionSnapshotCases=0;
  for(const mode of ['getter','length']) {
    const guard=ScopedCompletionGuard.fresh(),window=guard.acquire(1),op=guard.submit(window);let reads=0;
    const bytes=mode==='length'?new Proxy([7],{get(target,key){return key==='length'?(++reads===1?1:17):Reflect.get(target,key);}}):[];
    if(mode==='getter')Object.defineProperty(bytes,0,{get(){return ++reads===1?7:256;}});
    guard.complete(op,bytes);check(reads===1,'completion read twice');equal(guard.read(window),[7]);
    guard.release(op);guard.release(window);equal(guard.counts(),[0,0]);completionSnapshotCases++;
  }
  {
    const guard=ScopedCompletionGuard.fresh(),window=guard.acquire(1),op=guard.submit(window),bytes=[];
    Object.defineProperty(bytes,0,{get(){guard.complete(op,[9]);return 7;}});
    rejects(()=>guard.complete(op,bytes),-1);equal(guard.read(window),[9]);
    guard.release(op);guard.release(window);equal(guard.counts(),[0,0]);completionSnapshotCases++;
  }
  let writeSnapshotCases=0;
  {
    const guard=ScopedCompletionGuard.fresh(),data=[];let reads=0,writes=0,closes=0;
    Object.defineProperty(data,0,{get(){return ++reads===1?7:256;}});
    const input={write:async bytes=>{writes++;equal(bytes,[7]);return 1;},release:async()=>{closes++;}};
    equal(await writeTcpWindow(input,guard,data),{state:'done',effect:'accepted_locally',acknowledged:1});
    check(reads===1&&writes===1&&closes===1,'write snapshot ownership');equal(guard.counts(),[0,0]);writeSnapshotCases++;
  }
  let stopCases=0;globalThis.probeQuarantineOwners=[];
  for(const write of [false,true])for(const sync of [false,true]){
    const guard=ScopedCompletionGuard.fresh(),abort=new AbortController();let settle,released=false;
    const endpoint={read:()=>new Promise(resolve=>{settle=resolve;}),write:()=>new Promise(resolve=>{settle=resolve;}),terminateRead(){if(sync)throw -8;return Promise.reject(-8);},release(){released=true;}};
    const pending=write?writeTcpWindow(endpoint,guard,[1,2],{signal:abort.signal}):readTcpWindow(endpoint,guard,{signal:abort.signal});
    abort.abort();await new Promise(resolve=>setTimeout(resolve,1));equal(guard.counts(),[1,1]);
    rejects(()=>guard.acquire(1),-2);settle(write?2:[1,2]);
    const error=await pending.then(()=>{throw Error('missing quarantine');},error=>error);
    check(error instanceof TcpStopFailure&&error.owner.input===endpoint&&!released,'quarantine ownership');
    globalThis.probeQuarantineOwners.push(error);
    equal(guard.counts(),[1,1]);stopCases++;
  }
  const supervisor=new TcpOwnerSupervisor(1),abort=new AbortController();let settle,closed=false,reads=0;
  const endpoint={read(){reads++;return new Promise(resolve=>{settle=resolve;});},terminateRead:()=>closed?Promise.resolve():Promise.reject(-8),release:async()=>{}};
  const pending=supervisor.read(endpoint,{signal:abort.signal});abort.abort();settle([1]);
  const failure=await pending.catch(error=>error);check(failure instanceof TcpStopFailure,'supervisor quarantine');
  equal(supervisor.status(),{active:0,quarantined:1,limit:1});
  try{await supervisor.read({read:()=>{throw Error('quota I/O');}});throw Error('quota missing');}catch(error){check(error===-3,'quota error');}
  closed=true;await supervisor.retireQuarantine(failure.quarantineTicket);check(reads===1,'supervisor replay');
  equal(failure.owner.guard.counts(),[0,0]);equal(supervisor.status(),{active:0,quarantined:0,limit:1});
  let guardPoolCases=0;const originalSubmit=ScopedCompletionGuard.prototype.submit,seen=[];
  ScopedCompletionGuard.prototype.submit=function(window){const op=originalSubmit.call(this,window);seen.push({guard:this,window,op});return op;};
  try {
    const pooled=new TcpOwnerSupervisor(1);equal(await pooled.read({read:async()=>[7],release:async()=>{}}),[7]);let deliver;
    const next=pooled.read({read:()=>new Promise(resolve=>{deliver=resolve;}),release:async()=>{}});
    check(seen.length===2&&seen[0].guard===seen[1].guard,'idle guard not reused');
    rejects(()=>seen[0].guard.complete(seen[0].op,[9]),-1);equal(seen[1].guard.counts(),[1,1]);
    deliver([7]);equal(await next,[7]);equal(seen[1].guard.counts(),[0,0]);equal(pooled.status(),{active:0,quarantined:0,limit:1});guardPoolCases++;
  }finally{ScopedCompletionGuard.prototype.submit=originalSubmit;}
  return {accepted:true,browser_user_agent:navigator.userAgent,app_sha256:appSha,lib_sha256:libSha,kernel_sha256:await digest(kernelBytes),kernel_core_cases:4,kernel_simulator_only:true,resident_calls:1000,core_cases:4,guard_cases:guardCases,completion_snapshot_cases:completionSnapshotCases,driver_write_snapshot_cases:writeSnapshotCases,guard_pool_cases:guardPoolCases,stop_failure_cases:stopCases,supervisor_cases:1,trap_poisoned:true,no_replay:true,resource_cleanup:true,quarantine_retained:true,raw_tcp:false,real_device_io:false,mobile_qualified:false};
}
globalThis.receiptPromise=run().catch(error=>({accepted:false,error:String(error)})).then(receipt=>{
  document.querySelector('#receipt').textContent=JSON.stringify(receipt);
  document.title=receipt.accepted?'WAsmC Host PASS':'WAsmC Host FAIL';return receipt;
});
