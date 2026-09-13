// Consumes a trusted preconnected endpoint. Host chooses signal/deadline policy.
import {requestTcpStop,requireTcpStop,TcpStopFailure} from './stop-fence.mjs';
export async function readTcpWindow(input,guard,{signal,deadlineMs=1000,revokeOnAbort=false}={}) {
  let window,operation,timer,stopPromise,value,failure,stopped=0;
  const stop=revoked=>{
    if(stopped) return;
    stopped=revoked?-2:-6;
    if(revoked) guard.revoke();
    if(operation!==undefined) {
      if(!revoked) guard.cancel(operation);
    }
    stopPromise=requestTcpStop(input,guard);
  };
  const abort=()=>stop(revokeOnAbort);
  try {
    if(!Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>5000) throw -5;
    if(signal!=null && !(signal instanceof AbortSignal)) throw -5;
    if(signal?.aborted) {stop(revokeOnAbort);throw stopped;}
    window=guard.acquire(16);operation=guard.submit(window);
    // Attach the policy hook before issuing I/O; no hook error can skip its wait.
    signal?.addEventListener('abort',abort,{once:true});
    const pending=(async()=>input.read(16))();
    timer=setTimeout(()=>stop(false),deadlineMs);
    let bytes=[],error=0;
    try {bytes=await pending;} catch {error=-8;}
    // Clear policy hooks once the issued backend read settles. No replay.
    clearTimeout(timer);if(signal instanceof AbortSignal) signal.removeEventListener('abort',abort);
    if(stopPromise) await requireTcpStop(stopPromise,{input,guard,operation,window},stopped||error);
    guard.complete(operation,bytes,error);
    if(stopped) throw stopped;
    const state=guard.poll(operation);
    if(state.state==='failed') throw state.error;
    value=guard.read(window);
  } catch(cause) {failure=cause;}
  finally {
    clearTimeout(timer);if(signal instanceof AbortSignal) signal.removeEventListener('abort',abort);
    if(!(failure instanceof TcpStopFailure)) {
      try {if(stopPromise) await requireTcpStop(stopPromise,{input,guard,operation,window},failure);} catch(cause) {failure=cause;}
    }
    if(!(failure instanceof TcpStopFailure)) {
      try {await input.release();} catch(cause) {
        failure=new TcpStopFailure({input,guard,operation,window},cause,failure??{state:'done',delivery:'suppressed_by_failed_retirement'});
      }
    }
    if(!(failure instanceof TcpStopFailure)) {
      try {if(operation!==undefined) guard.release(operation);} catch(cause) {failure??=cause;}
      try {if(window!==undefined) guard.release(window);} catch(cause) {failure??=cause;}
    }
  }
  if(failure!==undefined) throw failure;
  return value;
}
