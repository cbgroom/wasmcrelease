// Trusted driver helper: consumes a preopened input; no paths or guest ABI.
export async function readWindow(input,guard,{cancelDelivery=false}={}) {
  let window,operation,value,failure;
  try {
    window=guard.acquire(16);operation=guard.submit(window);
    let bytes=[],error=0;
    try {
      const pending=input.read(0,16);
      let requestError=0;
      try { if(cancelDelivery) guard.cancel(operation); }
      catch(cause) { requestError=Number.isInteger(cause)&&cause<0?cause:-8; }
      // A failed cancel request cannot bypass awaiting an already-issued read.
      try { bytes=await pending; }
      catch(cause) { error=Number.isInteger(cause)&&cause<0?cause:-8; }
      if(requestError) error=requestError;
    } catch(cause) { error=Number.isInteger(cause)&&cause<0?cause:-8; }
    // Backend has settled. Even a read failure must acknowledge/drain its pin.
    try { guard.complete(operation,bytes,error); }
    catch { guard.complete(operation,[],-5); }
    const state=guard.poll(operation);
    if(state.state==='cancelled') throw -6;
    if(state.state==='failed') throw state.error;
    value=guard.read(window);
  } catch(cause) { failure=cause; }
  finally {
    // Never reach cleanup while the issued backend read is still unsettled.
    try { if(operation!==undefined) guard.release(operation); }
    catch(cause) { failure??=cause; }
    try { if(window!==undefined) guard.release(window); }
    catch(cause) { failure??=cause; }
    try { await input.release(); }
    catch(cause) { failure??=cause; }
  }
  if(failure!==undefined) throw failure;
  return value;
}
