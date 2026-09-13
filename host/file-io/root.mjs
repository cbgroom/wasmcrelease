import {PreopenedFile} from './adapter.mjs';
// Trusted embedding transfers exclusive ownership of at most four preopened
// descriptors. A selector is a grant name, never a guest-controlled OS path.
export class PreopenedRoot {
  #slots = new Map(); #closing = false; #busy = false;
  constructor(grants) {
    if(!Array.isArray(grants)||grants.length>4) throw -3;
    for(const {name,file,writable} of grants) {
      if(typeof name!=='string'||! /^[a-z][a-z0-9-]{0,31}$/.test(name)
        ||this.#slots.has(name)||typeof writable!=='boolean'
        ||!file||typeof file.close!=='function') throw -5;
      this.#slots.set(name,{file,writable});
    }
    // Exclusive ownership is an embedding obligation; obvious duplicate aliases
    // are rejected before any transfer or close.
    if(new Set([...this.#slots.values()].map(s=>s.file)).size!==this.#slots.size) throw -5;
  }
  describe() {
    if(this.#closing) throw -1;
    return [...this.#slots].map(([name,s])=>({name,read:true,write:s.writable}));
  }
  open(name,{write=false}={}) {
    if(this.#closing) throw -1;
    if(typeof name!=='string'||typeof write!=='boolean') throw -5;
    const slot=this.#slots.get(name); if(!slot) throw -2;
    if(write&&!slot.writable) throw -2;
    const child=new PreopenedFile(slot.file,write);
    this.#slots.delete(name); // Exactly one child; failed admission retains slot.
    return child;
  }
  async release() {
    if(this.#busy) throw -4;
    this.#closing=true; this.#busy=true;
    let failure;
    try {
      for(const [name,slot] of this.#slots) {
        try { await slot.file.close(); this.#slots.delete(name); }
        catch { failure=-8; } // Keep failed descriptors; only release may retry.
      }
      if(failure) throw failure;
      return 0;
    } finally {this.#busy=false;}
  }
}
