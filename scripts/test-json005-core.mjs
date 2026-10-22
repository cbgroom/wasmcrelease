import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read = p => readFileSync(new URL('../' + p, import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal:true});
function caller(bytes, version) {
  const module = new WebAssembly.Module(bytes);
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  const api = new WebAssembly.Instance(module, {}).exports;
  const view = () => new DataView(api.memory.buffer);
  const alloc = (bytes, alignment = 1) => {
    const p = api.cabi_realloc(0, 0, alignment, bytes.length) >>> 0;
    new Uint8Array(api.memory.buffer, p, bytes.length).set(bytes); return p;
  };
  const input = x => {
    const b = typeof x === 'string' ? encoder.encode(x) : x;
    return [alloc(b), b.length];
  };
  const pointers = values => {
    const strings = values.map(input);
    const p = alloc(new Uint8Array(values.length * 8), 4);
    strings.forEach(([at, length], i) => {
      view().setUint32(p + i * 8, at, true); view().setUint32(p + i * 8 + 4, length, true);
    });
    return [p, values.length];
  };
  const text = p => {
    const at = view().getUint32(p, true), length = view().getUint32(p + 4, true);
    return decoder.decode(new Uint8Array(api.memory.buffer, at, length));
  };
  const values = (p, records) => {
    const at = view().getUint32(p, true), length = view().getUint32(p + 4, true), out = [];
    for(let i=0;i<length;i++) {
      const entry = at + i * 12, present = view().getUint8(entry) === 1;
      out.push(records ? {present, json:text(entry + 4)} : present ? text(entry + 4) : null);
    }
    return out;
  };
  let calls = 0;
  const invoke = (name, data, kind) => {
    const exportName = 'wasmc:json/document@' + version + '#' + name;
    const args = data.flatMap(([type, value]) => type === 'pointers' ? pointers(value) : input(value));
    const p = api[exportName](...args) >>> 0;
    try {
      calls++;
      if(kind === 'text') return text(p);
      if(kind === 'view') return {valid:view().getUint8(p) === 1, values:values(p+4, true),
        error:view().getUint8(p+12) ? view().getUint8(p+13) : null};
      const tag = view().getUint8(p);
      if(tag) return {error:view().getUint8(p + (kind === 'unit' ? 1 : 4))};
      return {ok:kind === 'unit' ? null : kind === 'string' ? text(p+4) : values(p+4, kind === 'records')};
    } finally {
      api['cabi_post_' + exportName]?.(p);
    }
  };
  return {invoke, count:()=>calls, pages:()=>api.memory.buffer.byteLength / 65536};
}
const root = 'standard/wasmc-json/0.0.5/';
const bytes = read(root+'artifact.wasm');
assert.equal(sha(bytes), '8965648084a384e5ce26b4c20e587455d6fda82c03680688ada014f873c0239c');
const old = caller(read('current-libs/wasmc-json/0.0.1/artifact.wasm'), '0.0.1');
const next = caller(bytes, '0.0.5');
let parity = 0;
for(const document of ['null','true','42','-17','1.25','[1,2,3]',
  '{"z":null,"a":"hello"}','{"a":1,"a":2}','"Unicode: 你好"']) {
  for(const [name, args, kind] of [
    ['compact', [['input',document]], 'string'],
    ['validate', [['input',document]], 'unit'],
    ['select', [['input',document],['pointers',['','/a','/missing']]], 'options']
  ]) {assert.deepEqual(next.invoke(name,args,kind), old.invoke(name,args,kind));parity++;}
}
const seen = new Set();
const call = (name, data, kind) => {seen.add(name);return next.invoke(name,data,kind);};
const doc = '{"a":null,"b":"hi","items":[1,2]}';
const selected = [{present:true,json:'null'},{present:true,json:'"hi"'},{present:false,json:''}];
const list = ['', '/a', '/b', '/missing'];
assert.deepEqual(call('compact',[['input','{ "b": 2, "a": 1 }']],'string'),{ok:'{"a":1,"b":2}'});
assert.deepEqual(call('compact-bytes',[['input',encoder.encode('{ "b": 2, "a": 1 }')]],'string'),{ok:'{"a":1,"b":2}'});
for(const name of ['select','select-bytes']) assert.deepEqual(call(name,[['input',doc],['pointers',['/a','/b','/missing']]],'options'),{ok:['null','"hi"',null]});
for(const name of ['select-values','select-values-bytes']) assert.deepEqual(call(name,[['input',doc],['pointers',['/a','/b','/missing']]],'records'),{ok:selected});
for(const name of ['validate','validate-bytes']) assert.deepEqual(call(name,[['input',doc]],'unit'),{ok:null});
for(const name of ['compact-or','compact-or-bytes']) {
  assert.equal(call(name,[['input','{ "a": 1 }'],['input','fallback']],'text'),'{"a":1}');
  assert.equal(call(name,[['input','invalid'],['input','fallback']],'text'),'fallback');
}
assert.equal(call('decode-string-or',[['input','"hello \\u4f60"'],['input','fallback']],'text'),'hello 你');
assert.equal(call('decode-string-or',[['input','null'],['input','fallback']],'text'),'fallback');
assert.equal(call('select-string-or-bytes',[['input',doc],['input','/b'],['input','fallback']],'text'),'hi');
assert.equal(call('select-string-or-bytes',[['input',doc],['input','/a'],['input','fallback']],'text'),'fallback');
assert.deepEqual(call('inspect-values-bytes',[['input',doc],['pointers',['/a','/b','/missing']]],'view'),{valid:true,values:selected,error:null});
assert.deepEqual(call('inspect-values-bytes',[['input','invalid'],['pointers',list]],'view'),{valid:false,values:[],error:2});
assert.deepEqual(call('compact-bytes',[['input',new Uint8Array([255])]],'string'),{error:2});
assert.deepEqual(call('select-bytes',[['input',doc],['pointers',['bad~pointer']]],'options'),{error:5});
const before = next.pages();
for(let i=0;i<256;i++) {
  assert.deepEqual(call('select-values-bytes',[['input',doc],['pointers',['/a','/b','/missing']]],'records'),{ok:selected});
  assert.deepEqual(call('inspect-values-bytes',[['input','invalid'],['pointers',[]]],'view'),{valid:false,values:[],error:2});
}
assert.ok(next.pages() <= before + 1, 'post-return cleanup must stabilize repeated calls');
assert.equal(seen.size,13);
console.log(JSON.stringify({accepted:true,runtime:globalThis.Deno?'deno':globalThis.Bun?'bun':'node',
  package:'wasmc-json@0.0.5',artifact_sha256:sha(bytes),public_apis:seen.size,
  prior_version_normal_case_comparisons:parity,old_calls:old.count(),new_calls:next.count(),
  repeated_success_failure_pairs:256,heap_pages_before:before,heap_pages_after:next.pages(),
  no_Rust_build:true,real_Host_calls:0,scope:'Actual raw Core public API behavior; Component/installation/publication are separate'}));
