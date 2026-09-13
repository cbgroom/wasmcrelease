// Bounded external-I/O copy window for the trusted file adapter, not a guest
// allocator or accepted Core resource ABI. No exposed pointer or local token.
export class CommittedWriteWindow {
  #bytes; #valid=0; #busy=false; #released=false; #committed=false;
  constructor(capacity) {
    if(!Number.isInteger(capacity)||capacity<0||capacity>16) throw -5;
    this.#bytes=new Uint8Array(capacity);
  }
  #idle() {if(this.#released)throw -1;if(this.#busy)throw -4;}
  commit(bytes,validBytes) {
    this.#idle();
    if(!Array.isArray(bytes)||bytes.length>this.#bytes.length||!Number.isInteger(validBytes)
      ||validBytes<0||validBytes>bytes.length) throw -5;
    const snapshot=new Uint8Array(bytes.length);
    for(let i=0;i<bytes.length;i++) {
      const b=bytes[i];if(!Number.isInteger(b)||b<0||b>255)throw -5;snapshot[i]=b;
    }
    this.#idle(); // Trusted JS getters can reenter; never mutate a newly pinned window.
    this.#bytes.fill(0);this.#bytes.set(snapshot);this.#valid=validBytes;this.#committed=true;
    return 0;
  }
  async writeTo(file,offset) {
    this.#idle();if(!this.#committed)throw -5;
    const snapshot=Array.from(this.#bytes.slice(0,this.#valid));
    this.#busy=true;
    // Only real backend settlement unpins; a timeout/cancel wrapper cannot
    // bypass awaiting the issued adapter write. No retry/rollback is added.
    try {return await file.write(offset,snapshot);}
    finally {this.#busy=false;}
  }
  release() {
    this.#idle();this.#bytes.fill(0);this.#valid=0;this.#released=true;return 0;
  }
}
