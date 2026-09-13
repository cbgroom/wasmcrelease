// Consumes one exclusive endpoint. Result is trusted Host state, not guest ABI.
export async function writeTcpWindow(input,guard,data,{signal,deadlineMs=1000}={}) {
  let window,operation,timer,closed,result,cleanupError,stopped=false;
  const stop=()=>{
    if(stopped) return;stopped=true;
    if(operation!==undefined) guard.cancel(operation);
    closed=input.terminateRead();
  };
  try {
    if(!Array.isArray(data)||data.length>16||Array.from(data).some(b=>!Number.isInteger(b)||b<0||b>255)||!Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>5000||(signal!=null&&!(signal instanceof AbortSignal))) throw -5;
    const snapshot=[...data];
    if(signal?.aborted) {stop();result={state:'cancelled',effect:'none',acknowledged:0};}
    else {
      window=guard.acquire(snapshot.length);operation=guard.submit(window);
      signal?.addEventListener('abort',stop,{once:true});
      timer=setTimeout(stop,deadlineMs);
      let acknowledged=null,error=0;
      try {acknowledged=await input.write(snapshot);} catch {error=-9;}
      clearTimeout(timer);signal?.removeEventListener('abort',stop);
      if(closed) await closed;
      if(acknowledged!==null&&(!Number.isInteger(acknowledged)||acknowledged<0||acknowledged>snapshot.length)) {acknowledged=null;error=-9;}
      if(!error&&acknowledged!==snapshot.length) error=-9;
      guard.complete(operation,[],error);
      result=stopped?{state:'cancelled',effect:'possibly_partial',acknowledged}:
        error?{state:'failed',effect:'possibly_partial',acknowledged,error}:
          {state:'done',effect:'accepted_locally',acknowledged};
    }
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',stop);
    if(closed) await closed;
    if(operation!==undefined) guard.release(operation);
    if(window!==undefined) guard.release(window);
    try {await input.release();} catch(cause) {cleanupError=cause;}
  }
  if(cleanupError!==undefined) result={...result,cleanup_error:cleanupError};
  return result;
}
