import {spawn} from 'node:child_process';

// A serial client for the Linux executor's explicit-capacity direct protocol.
// Each request is sent once: an adapter may have effects and must not be replayed.
export class NativeLinuxCapacitySession {
  #child; #iterator; #chunks=[]; #offset=0; #available=0; #tail=Promise.resolve(); #ended=false; #exit; #stderr='';
  constructor(executor, descriptor) {
    this.#child=spawn(executor,['--capacity-session',descriptor],{stdio:['pipe','pipe','pipe']});
    this.#iterator=this.#child.stdout[Symbol.asyncIterator]();
    this.#child.stderr.on('data',chunk=>{this.#stderr+=chunk.toString();});
    this.#exit=new Promise(resolve=>{
      this.#child.once('error',error=>resolve({error}));
      this.#child.once('close',(code,signal)=>resolve({code,signal}));
    });
    // EPIPE is reported by the write callback and exit result.
    this.#child.stdin.on('error',()=>{});
  }
  async #read(n) {
    while(this.#available<n){const next=await this.#iterator.next();if(next.done)throw new Error('native session closed before complete response');this.#chunks.push(next.value);this.#available+=next.value.length;}
    const result=Buffer.allocUnsafe(n);let written=0;
    while(written<n){const chunk=this.#chunks[0],count=Math.min(n-written,chunk.length-this.#offset);chunk.copy(result,written,this.#offset,this.#offset+count);written+=count;this.#offset+=count;this.#available-=count;if(this.#offset===chunk.length){this.#chunks.shift();this.#offset=0;}}
    return result;
  }
  invoke(input, outputCapacity) {
    if(this.#ended)return Promise.reject(new Error('native session is closed'));
    if(!(input instanceof Uint8Array))return Promise.reject(new TypeError('input must be Uint8Array'));
    if(!Number.isInteger(outputCapacity)||outputCapacity<0||outputCapacity>0xffffffff||input.byteLength>0xffffffff)return Promise.reject(new RangeError('native session framing requires u32 lengths'));
    // Capture the caller's bytes now, before a queued invocation can run.
    const payload=Buffer.from(input), frame=Buffer.allocUnsafe(8+payload.length);
    frame.writeUInt32LE(payload.length,0);frame.writeUInt32LE(outputCapacity,4);payload.copy(frame,8);
    const task=this.#tail.then(async()=>{
      await new Promise((resolve,reject)=>this.#child.stdin.write(frame,error=>error?reject(error):resolve()));
      const header=await this.#read(8),status=header.readInt32LE(0),length=header.readUInt32LE(4);
      if(length>outputCapacity)throw new Error('native session returned output beyond requested capacity');
      return {status,bytes:await this.#read(length)};
    });
    // A broken session cannot safely process later queued calls.
    this.#tail=task.then(()=>{},error=>{this.#ended=true;throw error;});
    this.#tail.catch(()=>{});
    return task;
  }
  async close() {
    let pendingError;
    if(!this.#ended){this.#ended=true;try{await this.#tail;this.#child.stdin.end();}catch(error){pendingError=error;this.#child.stdin.destroy();}}
    else this.#child.stdin.destroy();
    const result=await this.#exit;
    if(pendingError)throw pendingError;
    if(result.error)throw result.error;
    if(result.code!==0)throw new Error(`native session exited ${result.code}/${result.signal}: ${this.#stderr}`);
  }
}
