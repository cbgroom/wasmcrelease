// Host-only acknowledgement fence. It never retries/replays an I/O request.
export function requestTcpStop(input,guard) {
  const failed=error=>{guard.revoke();return {ok:false,error};};
  try {
    // Install rejection handling immediately, even while issued I/O is pending.
    return Promise.resolve(input.terminateRead()).then(
      ()=>({ok:true}),failed);
  } catch(error) {return Promise.resolve(failed(error));}
}

// Supervisor owns this error and its retained resources. No guest ABI change.
export class TcpStopFailure extends Error {
  constructor(owner,cause,primary) {
    super('TCP close acknowledgement failed; resources quarantined',{cause});
    this.name='TcpStopFailure';this.quarantined=true;
    Object.defineProperty(this,'owner',{value:Object.freeze({...owner}),enumerable:true});this.primary=primary;
    owner.guard.revoke();
  }
}

export async function requireTcpStop(acknowledgement,owner,primary) {
  const result=await acknowledgement;
  if(!result.ok) throw new TcpStopFailure(owner,result.error,primary);
}
