import {ScopedCompletionGuard,issueBindingIdentity} from '../../runtime/completion/scoped-guard.mjs';
import {readTcpWindow} from './read-window.mjs';
import {writeTcpWindow} from './write-window.mjs';
import {TcpStopFailure,TcpGuardRetirementFailure,requestTcpStop} from './stop-fence.mjs';

// Trusted per-Host owner admission; not a guest API or global process registry.
export class TcpOwnerSupervisor {
  #owners=new Map();#endpoints=new WeakSet();#identity;#next=1;#limit;#idle=[];
  constructor(maxOwners=4){
    if(!Number.isInteger(maxOwners)||maxOwners<1||maxOwners>16)throw -5;
    this.#limit=maxOwners;this.#identity=issueBindingIdentity();
  }
  status(){return {active:[...this.#owners.values()].filter(o=>!o.failure).length,quarantined:[...this.#owners.values()].filter(o=>o.failure).length,limit:this.#limit};}
  async #run(input,task){
    if(!input||typeof input!=='object')throw -5;
    if(this.#endpoints.has(input))throw -4;
    if(this.#owners.size>=this.#limit)throw -3;
    if(this.#next>32767){
      if(this.#owners.size)throw -3;
      // Fresh identity only after all previous owners/pins are retired.
      const identity=issueBindingIdentity();this.#identity=identity;this.#next=1;
    }
    const cached=this.#idle.pop();
    const guard=cached?.reusable()?cached:ScopedCompletionGuard.fresh(),ticket=`${this.#identity}:${this.#next++}`;
    const owner={input,guard,failure:null,retiring:false};
    this.#owners.set(ticket,owner);this.#endpoints.add(input);
    try{return await task(guard);}
    catch(error){
      if(error instanceof TcpStopFailure){owner.failure=error;error.quarantineTicket=ticket;}
      throw error;
    }finally{
      if(!owner.failure){
        // Successful cleanup only: pending/revoked/exhausted guards never enter
        // this private bounded pool; local IDs and scoped identity are not reset.
        if(guard.reusable())this.#idle.push(guard);
        this.#owners.delete(ticket);this.#endpoints.delete(input);
      }
    }
  }
  read(input,policy){return this.#run(input,guard=>readTcpWindow(input,guard,policy));}
  write(input,data,policy){return this.#run(input,guard=>writeTcpWindow(input,guard,data,policy));}
  async retireQuarantine(ticket){
    const owner=this.#owners.get(ticket);if(!owner)throw -1;
    if(!owner.failure||owner.retiring)throw -4;
    // Unknown internal registry mutation cannot be repaired by network close
    // or blind release retries, even if current diagnostic counts are zero.
    if(owner.failure.reason==='guard-retirement')throw -7;
    owner.retiring=true;
    try{
      // Explicit supervisor close, never another read/write or fabricated ack.
      const ack=await requestTcpStop(owner.input,owner.guard);if(!ack.ok)throw ack.error;
      // Keep pins if endpoint retirement itself fails, even after close ack.
      await owner.input.release();
      let {operation,window}=owner.failure.owner;
      try {
        if(operation!==undefined){
          if(!owner.guard.poll(operation).drained)owner.guard.complete(operation,[],-8);
          if(owner.guard.release(operation)!==0)throw -8;operation=undefined;
        }
        if(window!==undefined){if(owner.guard.release(window)!==0)throw -8;window=undefined;}
      }catch(cause){
        // Even an explicit cleanup must not retry an unknown guard mutation.
        // Endpoint retirement is acknowledged, but zero counts are not an ack.
        const failure=new TcpGuardRetirementFailure({input:owner.input,guard:owner.guard,operation,window},cause,owner.failure.primary);
        failure.quarantineTicket=ticket;owner.failure=failure;throw failure;
      }
      this.#owners.delete(ticket);this.#endpoints.delete(owner.input);
    }finally{owner.retiring=false;}
  }
}
