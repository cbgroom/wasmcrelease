// Browser-compatible ESM: no Node globals, I/O, ambient capability or clock.
export class MemoryHost {
  constructor() { this.windows = new Map(); this.ops = new Map(); this.next = 100; this.bytes = []; }
  step([name, a = 0, b = 0]) {
    // Physical prototype results: negative error, zero success, positive token.
    switch (name) {
      case 'describe': return a === 1 ? 3 : a === 2 ? 1 : -1;
      case 'window_acquire':
        if (!Number.isInteger(a) || a < 0 || a > 16 || this.windows.size >= 8) return -3;
        this.windows.set(this.next, { data: Array(a).fill(42), length: 0, busy: false });
        return this.next++;
      case 'window_commit': {
        const w = this.windows.get(a); if (!w) return -1;
        if (w.busy) return -4;
        if (!Number.isInteger(b) || b < 0 || b > w.data.length) return -5;
        w.length = b; return 0;
      }
      case 'invoke': {
        if (a !== 1 && a !== 2) return -1;
        if (a === 2) return -2;
        const w = this.windows.get(b); if (!w) return -1;
        if (w.busy) return -4;
        if (this.ops.size >= 8) return -3;
        w.busy = true;
        this.ops.set(this.next, { window: b, data: w.data.slice(0, w.length), state: 'pending' });
        return this.next++;
      }
      case 'wait': {
        const op = this.ops.get(a); if (!op) return -1;
        if (op.state === 'cancelled') return -6;
        if (op.state === 'done') return op.data.length;
        this.bytes = op.data.slice(); op.state = 'done';
        this.windows.get(op.window).busy = false;
        return op.data.length;
      }
      case 'cancel': {
        const op = this.ops.get(a); if (!op) return -1;
        if (op.state !== 'pending') return -4;
        op.state = 'cancelled'; this.windows.get(op.window).busy = false; return 0;
      }
      case 'release': {
        const w = this.windows.get(a); const op = this.ops.get(a);
        if (!w && !op) return -1;
        if (w?.busy || op?.state === 'pending') return -4;
        this.windows.delete(a); this.ops.delete(a); return 0;
      }
      default: return -7;
    }
  }
  trace(steps) {
    return steps.map(step => {
      const result = this.step(step);
      return [result, this.windows.size, this.ops.size, ...this.bytes];
    });
  }
}
