let nextSession=1;
const bindingLocal=Symbol('fresh-binding-local');
// Internal scoped wrapper only: never export its raw integers across bindings.
export function createFreshBindingLocalGuard() {return new CompletionGuard(bindingLocal);}
// Trusted Host-side registry; opaque fixture integers are not public guest API.
export class CompletionGuard {
  #owner; #seq=1; #revoked=false; #windows=new Map(); #ops=new Map();
  constructor(mode) {
    if(mode===bindingLocal) {this.#owner=1;return;}
    if(nextSession>32767) throw -3;this.#owner=nextSession++;
  }
  #id() { if(this.#seq>32767) throw -3;return this.#owner*65536+this.#seq++; }
  #get(map,id) { if(!Number.isInteger(id)||Math.floor(id/65536)!==this.#owner||!map.has(id)) throw -1;return map.get(id); }
  acquire(size) {
    if(this.#revoked) throw -2;
    if(!Number.isInteger(size)||size<0||size>16) throw -5;
    if(this.#windows.size>=4) throw -3;
    const id=this.#id();this.#windows.set(id,{size,pins:0,bytes:[]});return id;
  }
  submit(window) {
    if(this.#revoked) throw -2;
    const w=this.#get(this.#windows,window);
    if(w.pins) throw -4;
    if(this.#ops.size>=4) throw -3;
    const id=this.#id();w.pins=1;w.bytes=[];
    this.#ops.set(id,{window,state:'pending',drained:false,error:0});return id;
  }
  cancel(id) {
    const op=this.#get(this.#ops,id);
    if(op.state!=='pending') throw -4;
    op.state='cancelled';return 0;
  }
  complete(id,bytes,error=0) {
    const op=this.#get(this.#ops,id);
    if(op.drained) throw -1;
    const w=this.#get(this.#windows,op.window);
    if(!Number.isInteger(error)||error>0||error< -2147483648) throw -5;
    if(!Array.isArray(bytes)||bytes.length>w.size||Array.from(bytes).some(b=>!Number.isInteger(b)||b<0||b>255)) throw -5;
    if(op.state!=='cancelled') {
      op.state=error?'failed':'done';op.error=error;w.bytes=error?[]:[...bytes];
    }
    op.drained=true;w.pins=0;return 0;
  }
  poll(id) { const o=this.#get(this.#ops,id);return {state:o.state,drained:o.drained,error:o.error}; }
  read(id) { if(this.#revoked) throw -2;const w=this.#get(this.#windows,id);if(w.pins) throw -4;return [...w.bytes]; }
  release(id) {
    if(this.#windows.has(id)) { const w=this.#get(this.#windows,id);if(w.pins) throw -4;this.#windows.delete(id); }
    else { const o=this.#get(this.#ops,id);if(!o.drained) throw -4;this.#ops.delete(id); }
    return 0;
  }
  revoke() { this.#revoked=true;for(const o of this.#ops.values()) if(o.state==='pending') o.state='cancelled';for(const w of this.#windows.values()) w.bytes=[];return 0; }
  counts() { return [this.#windows.size,this.#ops.size]; }
}
