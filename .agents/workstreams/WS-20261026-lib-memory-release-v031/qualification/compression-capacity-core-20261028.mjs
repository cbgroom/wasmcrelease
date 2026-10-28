import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gzipSync, gunzipSync} from 'node:zlib';

const [path, expected, version, mode] = process.argv.slice(2);
assert.ok(path && /^[a-f0-9]{64}$/.test(expected ?? '') && version && ['legacy', 'candidate'].includes(mode));
const bytes = readFileSync(path);
assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, 'artifact identity');
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);
const instance = new WebAssembly.Instance(module, {});
const {memory, cabi_realloc: realloc} = instance.exports;
const call = (operation, input) => {
  const name = `wasmc:compression/gzip@${version}#${operation}`;
  const ptr = input.length ? realloc(0, 0, 1, input.length) : 0;
  if (input.length) new Uint8Array(memory.buffer, ptr, input.length).set(input);
  const result = instance.exports[name](ptr, input.length);
  const view = new DataView(memory.buffer);
  const tag = view.getUint8(result);
  let value;
  if (tag === 0) {
    const p = view.getUint32(result + 4, true), n = view.getUint32(result + 8, true);
    value = {bytes: Buffer.from(new Uint8Array(memory.buffer, p, n))};
  } else {
    assert.equal(tag, 1);
    value = {error: view.getUint8(result + 4)};
  }
  instance.exports[`cabi_post_${name}`](result);
  return value;
};
let seed = 0x12345678;
const large = Buffer.alloc(5 * 1024 * 1024 + 17);
for (let i = 0; i < large.length; i++) {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; large[i] = seed & 255;
}
const packed = gzipSync(large, {level: 6});
assert.ok(packed.length > 4 * 1024 * 1024);
if (mode === 'legacy') {
  assert.deepEqual(call('compress', large), {error: 0});
  assert.deepEqual(call('decompress', gzipSync(Buffer.alloc(5 * 1024 * 1024, 97))), {error: 1});
} else {
  const compressed = call('compress', large).bytes;
  assert.deepEqual(gunzipSync(compressed), large);
  assert.deepEqual(call('decompress', packed).bytes, large);
  assert.deepEqual(call('decompress', gzipSync(Buffer.alloc(5 * 1024 * 1024, 97))).bytes, Buffer.alloc(5 * 1024 * 1024, 97));
  assert.deepEqual(call('decompress', Buffer.from('invalid gzip')), {error: 2});
  const fresh = Buffer.from('fresh input after error');
  assert.deepEqual(call('decompress', call('compress', fresh).bytes).bytes, fresh);
}
console.log(JSON.stringify({mode, artifact_sha256: expected, input_bytes: large.length, independently_compressed_bytes: packed.length,
  same_instance: true, invalid_stream_and_recovery: mode === 'candidate', result: 'PASS'}));
