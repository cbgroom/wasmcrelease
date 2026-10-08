// Bounded JavaScript value consumer for independently pinned import-free Core packages.
// Every invocation checks its lowered signature against the exact core-abi.json.
import assert from 'node:assert/strict';
const align = (n, a) => Math.ceil(n / a) * a;
const scalar = (kind, size, lane) => ({ kind, size, align: size, flat: [lane] });
export const u8 = scalar('u8', 1, 'i32'), u16 = scalar('u16', 2, 'i32'), u32 = scalar('u32', 4, 'i32');
export const s32 = scalar('s32', 4, 'i32');
export const i64 = scalar('i64', 8, 'i64'), u64 = scalar('u64', 8, 'i64'), f64 = scalar('f64', 8, 'f64');
export const bool = scalar('bool', 1, 'i32');
export const string = { kind: 'string', size: 8, align: 4, flat: ['i32', 'i32'] };
export const list = element => ({ kind: 'list', element, size: 8, align: 4, flat: ['i32', 'i32'] });
export function record(fields) {
  let size = 0, alignment = 1;
  const entries = Object.entries(fields).map(([name, type]) => {
    size = align(size, type.align); const offset = size; size += type.size;
    alignment = Math.max(alignment, type.align); return { name, type, offset };
  });
  return { kind: 'record', fields: entries, align: alignment, size: align(size, alignment), flat: entries.flatMap(e => e.type.flat) };
}
export const unit = record({});
const joinLane = (a, b) => a === b ? a : !a ? b : !b ? a : (a === 'i64' || b === 'i64' || a === 'f64' || b === 'f64') ? 'i64' : 'i32';
export function variant(cases) {
  const entries = Object.entries(cases); assert.ok(entries.length <= 256);
  const alignment = Math.max(1, ...entries.map(([, t]) => t.align));
  const payload = align(1, alignment), maximum = Math.max(0, ...entries.map(([, t]) => t.size));
  const lanes = [];
  for (const [, t] of entries) t.flat.forEach((lane, i) => { lanes[i] = joinLane(lanes[i], lane); });
  return { kind: 'variant', cases: entries, payload, align: alignment, size: align(payload + maximum, alignment), flat: ['i32', ...lanes] };
}
export const option = type => ({ ...variant({ none: unit, some: type }), option: true });
export const enumeration = names => ({ kind: 'enum', names, size: 1, align: 1, flat: ['i32'] });
export const result = (ok, errors) => variant({ ok, err: enumeration(errors) });
const utf8 = new TextEncoder(), text = new TextDecoder('utf-8', { fatal: true });

export class CoreCaller {
  constructor(module, abi) {
    assert.deepEqual(WebAssembly.Module.imports(module), [], 'Core consumer requires import-free artifact');
    this.instance = new WebAssembly.Instance(module, {});
    this.exports = this.instance.exports;
    this.abi = abi;
    this.readNodes=0; this.readBytes=0;
  }
  get view() { assert.ok(this.exports.memory.buffer.byteLength <= 67108864, "Core memory budget"); return new DataView(this.exports.memory.buffer); }
  alloc(size, alignment = 1) { assert.ok(Number.isSafeInteger(size) && size>=0 && size<=2097152, "Core allocation budget"); const p=size ? this.exports.cabi_realloc(0, 0, alignment, size) >>> 0 : 0; assert.ok(p+size<=this.view.byteLength); return p; }
  write(type, pointer, value) {
    const view = this.view;
    switch (type.kind) {
      case 'bool': view.setUint8(pointer, value ? 1 : 0); return;
      case 'u8': view.setUint8(pointer, value); return;
      case 'u16': view.setUint16(pointer, value, true); return;
      case 'u32': view.setUint32(pointer, value, true); return;
      case 's32': view.setInt32(pointer, value, true); return;
      case 'i64': view.setBigInt64(pointer, BigInt(value), true); return;
      case 'u64': view.setBigUint64(pointer, BigInt(value), true); return;
      case 'f64': view.setFloat64(pointer, value, true); return;
      case 'enum': { const index = type.names.indexOf(value); assert.ok(index >= 0, 'unknown enum ' + value); view.setUint8(pointer, index); return; }
      case 'record': for (const field of type.fields) this.write(field.type, pointer + field.offset, value[field.name]); return;
      case 'string': {
        assert.equal(typeof value,"string"); const bytes = utf8.encode(value), data = this.alloc(bytes.length);
        new Uint8Array(this.exports.memory.buffer, data, bytes.length).set(bytes);
        this.view.setUint32(pointer, data, true); this.view.setUint32(pointer + 4, bytes.length, true); return;
      }
      case 'list': {
        assert.ok(Array.isArray(value)&&value.length<=65536,"Core input list budget"); const stride = type.element.size, data = this.alloc(stride * value.length, type.element.align);
        for (let i = 0; i < value.length; i++) this.write(type.element, data + stride * i, value[i]);
        this.view.setUint32(pointer, data, true); this.view.setUint32(pointer + 4, value.length, true); return;
      }
      case 'variant': {
        const v = type.option ? (value === null ? { tag: 'none', value: {} } : { tag: 'some', value }) : value;
        const index = type.cases.findIndex(([name]) => name === v.tag); assert.ok(index >= 0, 'unknown variant ' + v.tag);
        view.setUint8(pointer, index); this.write(type.cases[index][1], pointer + type.payload, v.value ?? {}); return;
      }
      default: throw new Error('unsupported Core value type ' + type.kind);
    }
  }
  read(type, pointer) {
    assert.ok(++this.readNodes<=65536,"Core output node budget");
    const view = this.view; assert.ok(Number.isSafeInteger(pointer)&&pointer>=0&&pointer+type.size<=view.byteLength,"Core output range");
    switch (type.kind) {
      case 'bool': {const value=view.getUint8(pointer);assert.ok(value<=1,'Core bool discriminant');return value===1;}
      case 'u8': return view.getUint8(pointer);
      case 'u16': return view.getUint16(pointer, true);
      case 'u32': return view.getUint32(pointer, true);
      case 's32': return view.getInt32(pointer, true);
      case 'i64': return view.getBigInt64(pointer, true);
      case 'u64': return view.getBigUint64(pointer, true);
      case 'f64': return view.getFloat64(pointer, true);
      case 'enum': { const name = type.names[view.getUint8(pointer)]; assert.notEqual(name, undefined); return name; }
      case 'record': return Object.fromEntries(type.fields.map(f => [f.name, this.read(f.type, pointer + f.offset)]));
      case 'string': {const p=view.getUint32(pointer,true),n=view.getUint32(pointer+4,true);assert.ok(p+n<=view.byteLength&&(this.readBytes+=n)<=1048576,'Core output text budget');return text.decode(new Uint8Array(this.exports.memory.buffer,p,n));}
      case 'list': {
        const data = view.getUint32(pointer, true), length = view.getUint32(pointer + 4, true);
        assert.ok(length<=65536 && data+type.element.size*length<=view.byteLength,'Core output list bound');
        return Array.from({ length }, (_, i) => this.read(type.element, data + type.element.size * i));
      }
      case 'variant': {
        const index = view.getUint8(pointer); assert.ok(index < type.cases.length);
        const [tag, child] = type.cases[index];
        if (type.option) return tag === 'none' ? null : this.read(child, pointer + type.payload);
        return { tag, value: this.read(child, pointer + type.payload) };
      }
      default: throw new Error('unsupported Core value type ' + type.kind);
    }
  }
  flatten(type, pointer) {
    if (type.kind === 'record') return type.fields.flatMap(f => this.flatten(f.type, pointer + f.offset));
    if (type.kind === 'string' || type.kind === 'list') return [this.view.getUint32(pointer, true), this.view.getUint32(pointer + 4, true)];
    if (type.kind === 'variant') {
      const tag = this.view.getUint8(pointer), child = type.cases[tag][1];
      const values = this.flatten(child, pointer + type.payload);
      const joined = type.flat.slice(1).map((lane, i) => {
        if (i >= values.length) return lane === 'i64' ? 0n : 0;
        if (lane === child.flat[i]) return values[i];
        if (child.flat[i] === 'f64') {
          const scratch = new DataView(new ArrayBuffer(8)); scratch.setFloat64(0, values[i], true); return scratch.getBigInt64(0, true);
        }
        return lane === 'i64' ? BigInt(values[i]) : Number(values[i]);
      });
      return [tag, ...joined];
    }
    if (type.kind === 'enum') return [this.view.getUint8(pointer)];
    if (type.kind === 'bool') return [this.view.getUint8(pointer)];
    return [this.read(type, pointer)];
  }
  call(name, parameterTypes, values, returnType) {
    assert.equal(parameterTypes.length,values.length); this.readNodes=0;this.readBytes=0;
    const names = this.abi.exports.filter(e => e.kind === 'function' && e.name.endsWith('#' + name) && !e.name.startsWith('cabi_post_'));
    assert.equal(names.length, 1, 'ambiguous/missing public API ' + name);
    const entry = names[0];
    const tuple = record(Object.fromEntries(parameterTypes.map((t, i) => [String(i), t])));
    const input = this.alloc(tuple.size, tuple.align);
    this.write(tuple, input, values);
    const signature = tuple.flat.length > 16 ? ['i32'] : tuple.flat;
    assert.deepEqual(entry.params, signature, name + ': canonical input signature mismatch');
    const parameters = tuple.flat.length > 16 ? [input] : this.flatten(tuple, input);
    assert.deepEqual(entry.results,returnType.flat.length>1?['i32']:returnType.flat,name+': canonical result signature mismatch');
    const answer = this.exports[entry.name](...parameters);
    let resultValue;
    try {
      if (returnType.flat.length > 1) resultValue = this.read(returnType, answer >>> 0);
      else if (returnType.kind === 'enum') resultValue = returnType.names[answer];
      else resultValue = answer;
    } finally {
      const post = this.exports['cabi_post_' + entry.name];
      if (post) post(answer);
      if (tuple.size) this.exports.cabi_realloc(input, tuple.size, tuple.align, 0);
    }
    return resultValue;
  }
}
