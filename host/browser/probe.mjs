import {createResidentApp} from '../tcp/resident-app.mjs';
import {ScopedCompletionGuard} from '../completion/scoped-guard.mjs';
import {readTcpWindow} from '../tcp/read-window.mjs';
import {writeTcpWindow} from '../tcp/write-window.mjs';
import {TcpStopFailure} from '../tcp/stop-fence.mjs';

const check=(condition,message)=>{if(!condition)throw Error(message);};
const equal=(a,b)=>check(JSON.stringify(a)===JSON.stringify(b),'value mismatch');
const rejects=(call,code)=>{try{call();}catch(error){check(error===code,'error mismatch');return;}throw Error('expected rejection');};
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function load(url){const response=await fetch(url);check(response.ok,'fixture unavailable');return new Uint8Array(await response.arrayBuffer());}
async function run(){
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
  return {accepted:true,browser_user_agent:navigator.userAgent,app_sha256:appSha,lib_sha256:libSha,resident_calls:1000,core_cases:4,guard_cases:guardCases,stop_failure_cases:stopCases,trap_poisoned:true,no_replay:true,resource_cleanup:true,quarantine_retained:true,raw_tcp:false,real_device_io:false,mobile_qualified:false};
}
globalThis.receiptPromise=run().catch(error=>({accepted:false,error:String(error)})).then(receipt=>{
  document.querySelector('#receipt').textContent=JSON.stringify(receipt);
  document.title=receipt.accepted?'WAsmC Host PASS':'WAsmC Host FAIL';return receipt;
});
