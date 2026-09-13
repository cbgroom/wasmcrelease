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

// A settled malformed completion must not lose its still-pinned owner.
export class TcpCompletionFailure extends TcpStopFailure {
  constructor(owner,cause) {
    super(owner,cause,-5);this.name='TcpCompletionFailure';
    this.message='TCP completion rejected; resources quarantined';
    this.reason='malformed-completion';
  }
}

// Internal guard release may have failed before or after retirement. Retain
// ownership even with zero records; do not guess/retry an unknown mutation.
export class TcpGuardRetirementFailure extends TcpStopFailure {
  constructor(owner,cause,primary) {
    super({...owner,endpointRetired:true},cause,primary);
    this.name='TcpGuardRetirementFailure';this.reason='guard-retirement';
    this.message='TCP guard retirement outcome unknown; isolate retained owner';
  }
}

export async function requireTcpStop(acknowledgement,owner,primary) {
  const result=await acknowledgement;
  if(!result.ok) throw new TcpStopFailure(owner,result.error,primary);
}
