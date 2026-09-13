import { PreconnectedTcp } from './adapter.mjs';
// Trusted Host supplies an already listening Server, never a guest bind address.
export class PreauthorizedTcpListener {
  #server;#queue=[];#active=new Set();#waiter;#retired=false;#closed;#rejected=0;#failed=false;
  constructor(server) {
    if(!server.listening) throw -1;
    this.#server=server;
    this.#closed=new Promise(resolve=>server.once('close',resolve));
    server.on('connection',socket=>{
      // Some Node-compatible runtimes fail to inherit the trusted server policy.
      // Apply it before readable EOF; do not grant half-open behavior by default.
      socket.allowHalfOpen=server.allowHalfOpen===true;
      socket.on('error',()=>{});socket.pause();
      socket.once('close',()=>{this.#queue=this.#queue.filter(queued=>queued!==socket);});
      if(this.#retired||this.#queue.length>=2) {this.#rejected++;socket.destroy();return;}
      if(this.#waiter) {const waiter=this.#waiter;this.#waiter=null;waiter.resolve(this.#wrap(socket));}
      else this.#queue.push(socket);
    });
    const fail=()=>{this.#failed=true;if(this.#waiter) {this.#waiter.reject(-8);this.#waiter=null;}};
    server.on('error',fail);server.on('close',()=>{if(!this.#retired) fail();});
  }
  #wrap(socket) {
    this.#active.add(socket);socket.once('close',()=>this.#active.delete(socket));
    return new PreconnectedTcp(socket);
  }
  async accept() {
    if(this.#retired) throw -1;
    if(this.#failed) throw -8;
    if(this.#active.size>=2) throw -3;
    if(this.#waiter) throw -4;
    while(this.#queue.length) {
      const socket=this.#queue.shift();
      if(!socket.destroyed) return this.#wrap(socket);
    }
    return new Promise((resolve,reject)=>{this.#waiter={resolve,reject};});
  }
  counts() {return {queued:this.#queue.length,active:this.#active.size,rejected:this.#rejected};}
  async release() {
    if(this.#retired) throw -1;
    if(this.#active.size) throw -4;
    this.#retired=true;
    if(this.#waiter) {this.#waiter.reject(-6);this.#waiter=null;}
    for(const socket of this.#queue) socket.destroy();this.#queue=[];
    this.#server.close();await this.#closed;
    return 0;
  }
}
