// Host receives a trusted, preopened FileHandle. Guest paths are not accepted.
export class PreopenedFile {
  constructor(file, writable) { this.file = file; this.writable = writable; }
  check(offset, length) {
    if (!this.file) throw -1;
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || length > 16 || offset + length > 64) throw -5;
  }
  async read(offset, length) {
    this.check(offset, length);
    const bytes = new Uint8Array(length);
    try {
      const { bytesRead } = await this.file.read(bytes, 0, length, offset);
      return [...bytes.slice(0, bytesRead)];
    } catch { throw -8; }
  }
  async write(offset, data) {
    if (!Array.isArray(data) || !data.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) throw -5;
    this.check(offset, data.length);
    if (!this.writable) throw -2;
    let count = 0;
    try {
      while (count < data.length) {
        const { bytesWritten } = await this.file.write(Uint8Array.from(data.slice(count)), 0, data.length - count, offset + count);
        if (!bytesWritten) throw new Error('zero progress');
        count += bytesWritten;
      }
      return count;
    } catch { throw -9; } // No rollback/retry after potentially partial effects.
  }
  async invokeSync() {
    if (!this.file) throw -1;
    if (!this.writable) throw -2;
    try { await this.file.sync(); return 0; } catch { throw -8; }
  }
  async release() {
    if (!this.file) throw -1;
    const file = this.file; this.file = null;
    try { await file.close(); return 0; } catch { throw -8; }
  }
}
