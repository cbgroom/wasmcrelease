// Consumes one exclusive endpoint. Result is trusted Host state, not guest ABI.
import {requestTcpStop,requireTcpStop,TcpStopFailure,TcpGuardRetirementFailure} from './stop-fence.mjs';
export async function writeTcpWindow(input,guard,data,{signal,deadlineMs=1000}={}) {
  let window,operation,timer,closed,result,failure,quarantine,stopped=false;
  const stop=()=>{
    if(stopped) return;stopped=true;
    if(operation!==undefined) guard.cancel(operation);
    closed=requestTcpStop(input,guard);
  };
  try {
    if(!Array.isArray(data)||!Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>5000||(signal!=null&&!(signal instanceof AbortSignal))) throw -5;
    const length=data.length;
    if(!Number.isInteger(length)||length<0||length>16) throw -5;
    const snapshot=new Array(length);
    for(let i=0;i<length;i++) {
      const value=data[i];
      if(!Number.isInteger(value)||value<0||value>255) throw -5;
      snapshot[i]=value;
    }
    if(signal?.aborted) {stop();result={state:'cancelled',effect:'none',acknowledged:0};}
    else {
      window=guard.acquire(snapshot.length);operation=guard.submit(window);
      signal?.addEventListener('abort',stop,{once:true});
      timer=setTimeout(stop,deadlineMs);
      let acknowledged=null,error=0;
      try {acknowledged=await input.write(snapshot);} catch {error=-9;}
      clearTimeout(timer);signal?.removeEventListener('abort',stop);
      if(acknowledged!==null&&(!Number.isInteger(acknowledged)||acknowledged<0||acknowledged>snapshot.length)) {acknowledged=null;error=-9;}
      if(!error&&acknowledged!==snapshot.length) error=-9;
      result=stopped?{state:'cancelled',effect:'possibly_partial',acknowledged}:
        error?{state:'failed',effect:'possibly_partial',acknowledged,error}:
          {state:'done',effect:'accepted_locally',acknowledged};
      if(closed) await requireTcpStop(closed,{input,guard,operation,window},result);
      guard.complete(operation,[],error);
    }
  } catch(cause) {if(cause instanceof TcpStopFailure) quarantine=cause;else failure=cause;}
  finally {
    clearTimeout(timer);if(signal instanceof AbortSignal) signal.removeEventListener('abort',stop);
    if(closed&&!quarantine) {
      try {await requireTcpStop(closed,{input,guard,operation,window},result);} catch(cause) {quarantine=cause;}
    }
    if(!quarantine) {
      try {await input.release();} catch(cause) {quarantine=new TcpStopFailure({input,guard,operation,window},cause,failure??result);}
    }
    if(!quarantine) {
      try {
        if(operation!==undefined){if(guard.release(operation)!==0)throw -8;operation=undefined;}
        if(window!==undefined){if(guard.release(window)!==0)throw -8;window=undefined;}
      }catch(cause){quarantine=new TcpGuardRetirementFailure({input,guard,operation,window},cause,failure??result);}
    }
  }
  if(quarantine) throw quarantine;
  if(failure!==undefined) throw failure;
  return result;
}
