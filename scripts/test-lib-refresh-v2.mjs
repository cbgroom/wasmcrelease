#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--run-root') {
  throw new Error('usage: node scripts/test-lib-refresh-v2.mjs --run-root /absolute/refresh/run/root');
}
const runRoot = resolve(args[1]);
const receipt = JSON.parse(await readFile(join(runRoot, 'refresh-receipt.json'), 'utf8'));
assert.equal(receipt.schema, 'wasmc.lib-refresh-receipt/v2');
assert.equal(receipt.accepted, true);

const root = process.cwd();
const packages = new Map(receipt.rows.map(row => [row.id, row]));

async function loadPackage(id) {
  const row = packages.get(id);
  assert.ok(row, 'refresh receipt missing ' + id);
  const packageRoot = row.package_root;
  const artifactBytes = await readFile(join(packageRoot, 'artifact.wasm'));
  const module = new WebAssembly.Module(artifactBytes);
  assert.deepEqual(WebAssembly.Module.imports(module), [], id + ': Core artifact must be import-free');
  const sourceWit = await readFile(join(root, 'libspec', id, 'lib.wit'));
  const generatedWit = await readFile(join(packageRoot, 'lib.wit'));
  assert.deepEqual(generatedWit, sourceWit, id + ': generated WIT drift');
  return { row, packageRoot, artifactBytes, module };
}

const jsonErrors = [
  'input-too-large',
  'depth-limit',
  'invalid-json',
  'too-many-pointers',
  'pointer-too-long',
  'invalid-pointer',
  'output-too-large',
];

function jsonInvoke(module, operation, input, pointers = []) {
  const instance = new WebAssembly.Instance(module, {});
  const api = instance.exports;
  const allocateString = value => {
    const bytes = encoder.encode(value);
    const pointer = bytes.length === 0 ? 0 : api.cabi_realloc(0, 0, 1, bytes.length);
    if (bytes.length) new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
    return [pointer, bytes.length];
  };
  const [inputPointer, inputLength] = allocateString(input);
  let resultPointer;
  if (operation === 'select') {
    const encoded = pointers.map(allocateString);
    const listPointer = encoded.length === 0 ? 0 : api.cabi_realloc(0, 0, 4, encoded.length * 8);
    const view = new DataView(api.memory.buffer);
    encoded.forEach(([pointer, length], index) => {
      view.setUint32(listPointer + index * 8, pointer, true);
      view.setUint32(listPointer + index * 8 + 4, length, true);
    });
    resultPointer = api['wasmc:json/document@0.0.1#select'](
      inputPointer,
      inputLength,
      listPointer,
      encoded.length,
    );
  } else {
    resultPointer = api['wasmc:json/document@0.0.1#' + operation](inputPointer, inputLength);
  }
  const view = new DataView(api.memory.buffer);
  const tag = view.getUint8(resultPointer);
  let result;
  if (tag !== 0) {
    const errorOffset = operation === 'validate' ? 1 : 4;
    result = { ok: false, error: jsonErrors[view.getUint8(resultPointer + errorOffset)] };
  } else if (operation === 'validate') {
    result = { ok: true, value: null };
  } else if (operation === 'compact') {
    const pointer = view.getUint32(resultPointer + 4, true);
    const length = view.getUint32(resultPointer + 8, true);
    result = { ok: true, value: decoder.decode(new Uint8Array(api.memory.buffer, pointer, length)) };
  } else {
    const listPointer = view.getUint32(resultPointer + 4, true);
    const listLength = view.getUint32(resultPointer + 8, true);
    const values = [];
    for (let index = 0; index < listLength; index += 1) {
      const item = listPointer + index * 12;
      if (view.getUint8(item) === 0) values.push(null);
      else {
        const pointer = view.getUint32(item + 4, true);
        const length = view.getUint32(item + 8, true);
        values.push(decoder.decode(new Uint8Array(api.memory.buffer, pointer, length)));
      }
    }
    result = { ok: true, value: values };
  }
  const post = api['cabi_post_wasmc:json/document@0.0.1#' + operation];
  if (typeof post === 'function') post(resultPointer);
  return result;
}

const compressionErrors = [
  'input-too-large',
  'output-too-large',
  'invalid-stream',
  'internal-failure',
];

function compressionInvoke(module, operation, input) {
  const instance = new WebAssembly.Instance(module, {});
  const api = instance.exports;
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const pointer = bytes.length === 0 ? 0 : api.cabi_realloc(0, 0, 1, bytes.length);
  if (bytes.length) new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
  const name = 'wasmc:compression/gzip@0.0.1#' + operation;
  const resultPointer = api[name](pointer, bytes.length);
  const view = new DataView(api.memory.buffer);
  const tag = view.getUint8(resultPointer);
  let result;
  if (tag === 1) {
    result = { ok: false, error: compressionErrors[view.getUint8(resultPointer + 4)] };
  } else {
    assert.equal(tag, 0);
    const outputPointer = view.getUint32(resultPointer + 4, true);
    const outputLength = view.getUint32(resultPointer + 8, true);
    result = {
      ok: true,
      value: new Uint8Array(api.memory.buffer, outputPointer, outputLength).slice(),
    };
  }
  const post = api['cabi_post_' + name];
  if (typeof post === 'function') post(resultPointer);
  return result;
}

const httpErrors = [
  'input-too-large',
  'too-many-headers',
  'invalid-syntax',
  'incomplete',
  'invalid-version',
  'invalid-status',
  'invalid-header-name',
  'invalid-header-value',
  'output-too-large',
  'invalid-content-length',
  'unsupported-framing',
  'body-too-large',
];

function allocBytes(instance, bytes) {
  if (bytes.length === 0) return 0;
  const pointer = instance.exports.cabi_realloc(0, 0, 1, bytes.length);
  new Uint8Array(instance.exports.memory.buffer, pointer, bytes.length).set(bytes);
  return pointer;
}

function httpParse(module, bytes) {
  const instance = new WebAssembly.Instance(module, {});
  const pointer = allocBytes(instance, bytes);
  const resultPointer = instance.exports['wasmc:http1-server/wire@0.0.1#parse-request'](
    pointer,
    bytes.length,
  );
  const view = new DataView(instance.exports.memory.buffer);
  const tag = view.getUint8(resultPointer);
  const result = tag === 1
    ? { ok: false, error: httpErrors[view.getUint8(resultPointer + 4)] }
    : { ok: true };
  const post = instance.exports['cabi_post_wasmc:http1-server/wire@0.0.1#parse-request'];
  if (typeof post === 'function') post(resultPointer);
  return result;
}

function httpFrameLength(module, bytes) {
  const instance = new WebAssembly.Instance(module, {});
  const pointer = allocBytes(instance, bytes);
  const resultPointer = instance.exports['wasmc:http1-server/wire@0.0.1#request-frame-length'](
    pointer,
    bytes.length,
  );
  const view = new DataView(instance.exports.memory.buffer);
  if (view.getUint8(resultPointer) === 1) {
    return { ok: false, error: httpErrors[view.getUint8(resultPointer + 4)] };
  }
  const optionTag = view.getUint8(resultPointer + 4);
  return {
    ok: true,
    frame_length: optionTag === 0 ? null : view.getUint32(resultPointer + 8, true),
  };
}

function httpSerialize(module, minor, status, headers = []) {
  const instance = new WebAssembly.Instance(module, {});
  const api = instance.exports;
  const encoded = headers.map(([name, value]) => {
    const nameBytes = encoder.encode(name);
    const valueBytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    return {
      nameBytes,
      valueBytes,
      namePointer: allocBytes(instance, nameBytes),
      valuePointer: allocBytes(instance, valueBytes),
    };
  });
  const listPointer = encoded.length === 0 ? 0 : api.cabi_realloc(0, 0, 4, encoded.length * 16);
  const view = new DataView(api.memory.buffer);
  encoded.forEach((row, index) => {
    const offset = listPointer + index * 16;
    view.setUint32(offset, row.namePointer, true);
    view.setUint32(offset + 4, row.nameBytes.length, true);
    view.setUint32(offset + 8, row.valuePointer, true);
    view.setUint32(offset + 12, row.valueBytes.length, true);
  });
  const resultPointer = api['wasmc:http1-server/wire@0.0.1#serialize-response-head'](
    minor,
    status,
    listPointer,
    encoded.length,
  );
  const resultView = new DataView(api.memory.buffer);
  const tag = resultView.getUint8(resultPointer);
  let result;
  if (tag === 1) {
    result = { ok: false, error: httpErrors[resultView.getUint8(resultPointer + 4)] };
  } else {
    const outputPointer = resultView.getUint32(resultPointer + 4, true);
    const outputLength = resultView.getUint32(resultPointer + 8, true);
    result = {
      ok: true,
      value: new Uint8Array(api.memory.buffer, outputPointer, outputLength).slice(),
    };
  }
  const post = api['cabi_post_wasmc:http1-server/wire@0.0.1#serialize-response-head'];
  if (typeof post === 'function') post(resultPointer);
  return result;
}

const json = await loadPackage('wasmc-json');
const jsonCases = [
  ['compact', jsonInvoke(json.module, 'compact', ' { "a" : 1 } '), { ok: true, value: '{"a":1}' }],
  ['validate-invalid', jsonInvoke(json.module, 'validate', 'bad'), { ok: false, error: 'invalid-json' }],
  [
    'select',
    jsonInvoke(json.module, 'select', '{"a":{"b":2},"arr":[10,20]}', ['/a/b', '/arr/1', '/missing']),
    { ok: true, value: ['2', '20', null] },
  ],
  [
    'input-too-large',
    jsonInvoke(json.module, 'validate', JSON.stringify('a'.repeat(65535))),
    { ok: false, error: 'input-too-large' },
  ],
];
for (const [name, actual, expected] of jsonCases) assert.deepEqual(actual, expected, 'JSON ' + name);

const compression = await loadPackage('wasmc-compression');
const hello = encoder.encode('hello refresh v2');
const compressed = compressionInvoke(compression.module, 'compress', hello);
assert.equal(compressed.ok, true);
assert.ok(compressed.value.length > 0);
const decompressed = compressionInvoke(compression.module, 'decompress', compressed.value);
assert.equal(decompressed.ok, true);
assert.equal(decoder.decode(decompressed.value), 'hello refresh v2');
assert.deepEqual(
  compressionInvoke(compression.module, 'decompress', Uint8Array.of(1, 2, 3)),
  { ok: false, error: 'invalid-stream' },
);
assert.deepEqual(
  compressionInvoke(compression.module, 'compress', new Uint8Array((1 << 20) + 1)),
  { ok: false, error: 'input-too-large' },
);

const http1 = await loadPackage('wasmc-http1');
const get = encoder.encode('GET / HTTP/1.1\r\n\r\n');
assert.deepEqual(httpParse(http1.module, get), { ok: true });
assert.deepEqual(httpFrameLength(http1.module, get), { ok: true, frame_length: get.length });
const serialized = httpSerialize(http1.module, 1, 200, []);
assert.equal(serialized.ok, true);
assert.equal(decoder.decode(serialized.value), 'HTTP/1.1 200 OK\r\n\r\n');
assert.deepEqual(httpSerialize(http1.module, 1, 99, []), { ok: false, error: 'invalid-status' });
assert.deepEqual(
  httpParse(http1.module, new Uint8Array((64 << 10) + 1)),
  { ok: false, error: 'input-too-large' },
);

const q1 = {
  accepted: true,
  schema: 'wasmc.lib-refresh-q1/v2',
  fingerprint: receipt.fingerprint,
  producer_sha256: receipt.producer.sha256,
  cargo_lock_sha256: receipt.cargo_lock_sha256,
  packages: [
    {
      id: 'wasmc-json',
      artifact_sha256: sha(json.artifactBytes),
      cases: jsonCases.length,
      semantics: ['compact', 'validate-invalid', 'select', 'input-too-large'],
    },
    {
      id: 'wasmc-compression',
      artifact_sha256: sha(compression.artifactBytes),
      cases: 4,
      semantics: ['round-trip', 'invalid-stream', 'input-too-large'],
    },
    {
      id: 'wasmc-http1',
      artifact_sha256: sha(http1.artifactBytes),
      cases: 5,
      semantics: ['parse', 'frame-length', 'serialize', 'invalid-status', 'input-too-large'],
    },
  ],
};
await writeFile(join(runRoot, 'q1-receipt.json'), JSON.stringify(q1, null, 2) + '\n');
console.log(JSON.stringify(q1));
