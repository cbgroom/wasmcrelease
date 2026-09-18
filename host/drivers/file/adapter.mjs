// Host receives a trusted, preopened FileHandle. Guest paths are not accepted.
export class PreopenedFile {
  #busy = false; #stopped = false;
  constructor(file, writable) { this.file = file; this.writable = writable; }
  check(offset, length) {
    if (!this.file) throw -1;
    if (this.#busy) throw -4;
    if (this.#stopped) throw -1;
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || length > 16 || offset + length > 64) throw -5;
  }
  async read(offset, length) {
    this.check(offset, length);
    const bytes = new Uint8Array(length);
    this.#busy = true;
    try {
      const { bytesRead } = await this.file.read(bytes, 0, length, offset);
      if(!Number.isInteger(bytesRead)||bytesRead<0||bytesRead>length) throw -8;
      return [...bytes.slice(0, bytesRead)];
    } catch { throw -8; } finally { this.#busy = false; }
  }
  async write(offset, data) {
    if (!Array.isArray(data)) throw -5;
    const length=data.length;
    if (!Number.isInteger(length) || length<0 || length>16) throw -5;
    const snapshot=new Uint8Array(length);
    for(let i=0;i<length;i++) {
      const value=data[i];
      if(!Number.isInteger(value)||value<0||value>255) throw -5;
      snapshot[i]=value;
    }
    this.check(offset, length);
    if (!this.writable) throw -2;
    let count = 0;
    this.#busy = true;
    try {
      while (count < length) {
        const remaining=length-count;
        const { bytesWritten } = await this.file.write(snapshot.slice(count), 0, remaining, offset + count);
        if (!Number.isInteger(bytesWritten)||bytesWritten<=0||bytesWritten>remaining) throw new Error('invalid progress');
        count += bytesWritten;
      }
      return count;
    } catch { throw -9; } finally { this.#busy = false; } // No rollback/retry after potentially partial effects.
  }
  async invokeSync() {
    if (!this.file) throw -1;
    if (this.#busy) throw -4;
    if (this.#stopped) throw -1;
    if (!this.writable) throw -2;
    this.#busy = true;
    try { await this.file.sync(); return 0; } catch { throw -8; } finally { this.#busy = false; }
  }
  async release() {
    if (!this.file) throw -1;
    if (this.#busy) throw -4;
    const file = this.file; this.#busy=true; this.#stopped=true;
    // Keep ownership on failure. Only an explicit later release may retry close;
    // no subsequent business I/O, even if the backend reports still open.
    try { await file.close(); this.file=null; return 0; } catch { throw -8; }
    finally { this.#busy=false; }
  }
}
