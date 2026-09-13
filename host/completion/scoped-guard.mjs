import { CompletionGuard } from './guard.mjs';
// Trusted synchronous CSPRNG adapter; never supplied by guest code.
export function issueBindingIdentity(fill = bytes => globalThis.crypto.getRandomValues(bytes)) {
  const bytes=new Uint8Array(32);
  try {
    const result=fill(bytes);
    if(result && typeof result.then==='function') {result.catch?.(()=>{});throw -8;}
  } catch { throw -8; }
  if(bytes.every(byte=>byte===0)) throw -5;
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
}
// Trusted Host binding identity. Do not inject guest-selected or repeated seeds.
export class ScopedCompletionGuard {
  #identity;#guard;
  static fresh() {return new ScopedCompletionGuard(issueBindingIdentity());}
  constructor(identity) {
    if(typeof identity!=='string'||! /^[0-9a-f]{64}$/.test(identity)||/^0+$/.test(identity)) throw -5;
    this.#identity=identity;this.#guard=new CompletionGuard();
  }
  #wrap(local) { return `${this.#identity}:${local}`; }
  #unwrap(ticket) {
    if(typeof ticket!=='string'||ticket.length>75) throw -1;
    const [identity,local,...extra]=ticket.split(':');
    if(extra.length||identity!==this.#identity||! /^[1-9][0-9]{0,9}$/.test(local)||Number(local)>2147483647) throw -1;
    return Number(local);
  }
  acquire(size) {return this.#wrap(this.#guard.acquire(size));}
  submit(window) {return this.#wrap(this.#guard.submit(this.#unwrap(window)));}
  cancel(operation) {return this.#guard.cancel(this.#unwrap(operation));}
  complete(operation,bytes,error=0) {return this.#guard.complete(this.#unwrap(operation),bytes,error);}
  poll(operation) {return this.#guard.poll(this.#unwrap(operation));}
  read(window) {return this.#guard.read(this.#unwrap(window));}
  release(resource) {return this.#guard.release(this.#unwrap(resource));}
  revoke() {return this.#guard.revoke();}
  counts() {return this.#guard.counts();}
}
