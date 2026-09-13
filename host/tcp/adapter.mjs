// Trusted Host supplies an already connected, paused Node-compatible socket.
// No guest address, DNS, listener or implicit reconnect authority.
export class PreconnectedTcp {
  #socket; #busy=false; #error=false; #ended=false; #stopped=false; #closed; #pending=null;
  constructor(socket, writable=true) {
    if(socket.destroyed||socket.closed) throw -1;
    this.#socket=socket; this.writable=writable; socket.pause();
    this.#closed=socket.closed?Promise.resolve():new Promise(resolve=>socket.once('close',resolve));
    socket.on('error',()=>{this.#error=true;});
    socket.on('end',()=>{this.#ended=true;});
    // Keep a data owner attached even between read requests.
    socket.on('data',bytes=>{
      const owned=Uint8Array.from(bytes);
      if(this.#pending){const joined=new Uint8Array(this.#pending.length+owned.length);joined.set(this.#pending);joined.set(owned,this.#pending.length);this.#pending=joined;}
      else this.#pending=owned;
      socket.pause();socket.emit('wasmc-data-ready');
    });socket.pause();
  }
  #check(length) {
    if(!this.#socket) throw -1;
    if(this.#busy) throw -4;
    if(this.#stopped) throw -1;
    if(!Number.isInteger(length)||length<0||length>16) throw -5;
    if(this.#error) throw -8;
  }
  async read(length) {
    this.#check(length); if(!length) return [];
    if(this.#pending) {
      const bytes=this.#pending,delivered=Array.from(bytes.subarray(0,length));
      this.#pending=bytes.length>length?bytes.slice(length):null;
      return delivered;
    }
    const socket=this.#socket; this.#busy=true;
    try {
      return await new Promise((resolve,reject)=>{
        const clean=()=>{socket.pause();socket.off('wasmc-data-ready',readable);socket.off('end',end);socket.off('close',close);socket.off('error',fail);};
        const fail=()=>{clean();reject(-8);};
        const end=()=>{clean();resolve([]);};
        const close=()=>{if(this.#ended||socket.readableEnded) end();else fail();};
        const readable=()=>{
          if(this.#stopped) return fail();
          const bytes=this.#pending;if(bytes===null)return;
          const delivered=Array.from(bytes.subarray(0,length));
          this.#pending=bytes.length>length?Uint8Array.from(bytes.subarray(length)):null;
          clean();
          resolve(delivered);
        };
        socket.on('wasmc-data-ready',readable);socket.on('end',end);socket.on('close',close);socket.on('error',fail);
        if(this.#error) fail();
        else if(this.#ended||socket.readableEnded)end();else if(socket.destroyed)fail();else socket.resume();
      });
    } finally {this.#busy=false;}
  }
  async write(bytes) {
    if(!Array.isArray(bytes)) throw -5;
    const count=bytes.length;if(!Number.isInteger(count)||count<0||count>16)throw -5;
    const snapshot=new Uint8Array(count);
    for(let i=0;i<count;i++){const byte=bytes[i];if(!Number.isInteger(byte)||byte<0||byte>255)throw -5;snapshot[i]=byte;}
    this.#check(count); if(!this.writable) throw -2;
    this.#busy=true;
    try {
      // Callback retains the owned view until local acknowledgement, not caller
      // array length/mutation or a transient temporary's lifetime.
      await new Promise((resolve,reject)=>this.#socket.write(snapshot,error=>error||snapshot.byteLength!==count?reject(-9):resolve()));
      return count;
    } catch {throw -9;} finally {this.#busy=false;}
  }
  async release() {
    if(!this.#socket) throw -1; if(this.#busy) throw -4;
    const socket=this.#socket;this.#busy=true;this.#stopped=true;
    // Resource retirement awaits close acknowledgement, not destroyed=true alone.
    try {
      if(!socket.destroyed) socket.destroy();
      await this.#closed;
      this.#socket=null;this.#pending=null;return 0;
    } finally {this.#busy=false;}
  }
  terminateRead() {
    if(!this.#socket) throw -1;
    this.#stopped=true;
    this.#socket.destroy();
    return this.#closed;
  }
}
