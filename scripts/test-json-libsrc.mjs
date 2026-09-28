import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-json');
const manifest = JSON.parse(await readFile(join(candidateRoot, 'candidate.json'), 'utf8'));
const oraclePath = resolve(root, manifest.oracle.path);
const oracleBytes = await readFile(oraclePath);
assert.equal(
  createHash('sha256').update(oracleBytes).digest('hex'),
  manifest.oracle.sha256,
  'oracle digest drift',
);

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    timeout: options.timeout ?? 180000,
    maxBuffer: 32 << 20,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + ' failed (' + result.status + '):\n' + result.stderr + '\n' + result.stdout);
  }
  return result.stdout.trim();
};

run('cargo', [
  '+1.96.0',
  'build',
  '--release',
  '--locked',
  '--target',
  'wasm32-unknown-unknown',
  '--manifest-path',
  'libsrc/wasmc-json/Cargo.toml',
]);

const candidatePath = resolve(
  root,
  'libsrc/wasmc-json/target/wasm32-unknown-unknown/release/wasmc_json_public.wasm',
);
const candidateBytes = await readFile(candidatePath);
assert.ok(candidateBytes.length <= 256 * 1024, 'candidate unexpectedly large');

const candidateModule = new WebAssembly.Module(candidateBytes);
const oracleModule = new WebAssembly.Module(oracleBytes);
assert.deepEqual(WebAssembly.Module.imports(candidateModule), []);
assert.deepEqual(WebAssembly.Module.imports(oracleModule), []);

const oracleWit = run('wasm-tools', ['component', 'wit', oraclePath]);
const candidateWit = run('wasm-tools', ['component', 'wit', candidatePath]);
assert.equal(candidateWit, oracleWit, 'candidate WIT differs from frozen oracle contract');

const errors = [
  'input-too-large',
  'depth-limit',
  'invalid-json',
  'too-many-pointers',
  'pointer-too-long',
  'invalid-pointer',
  'output-too-large',
];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function invoke(module, operation, input, pointers = []) {
  const instance = new WebAssembly.Instance(module, {});
  const exports = instance.exports;
  const allocateString = value => {
    const bytes = encoder.encode(value);
    const pointer = exports.cabi_realloc(0, 0, 1, bytes.length);
    new Uint8Array(exports.memory.buffer, pointer, bytes.length).set(bytes);
    return [pointer, bytes.length];
  };
  const [inputPointer, inputLength] = allocateString(input);
  let resultPointer;
  if (operation === 'select') {
    const encodedPointers = pointers.map(allocateString);
    const listPointer = exports.cabi_realloc(0, 0, 4, encodedPointers.length * 8);
    const view = new DataView(exports.memory.buffer);
    for (const [index, [pointer, length]] of encodedPointers.entries()) {
      view.setUint32(listPointer + index * 8, pointer, true);
      view.setUint32(listPointer + index * 8 + 4, length, true);
    }
    resultPointer = exports['wasmc:json/document@0.0.1#select'](
      inputPointer,
      inputLength,
      listPointer,
      encodedPointers.length,
    );
  } else {
    resultPointer = exports[`wasmc:json/document@0.0.1#${operation}`](
      inputPointer,
      inputLength,
    );
  }

  const view = new DataView(exports.memory.buffer);
  const discriminant = view.getUint8(resultPointer);
  let result;
  if (discriminant !== 0) {
    const errorOffset = operation === 'validate' ? 1 : 4;
    result = { ok: false, error: errors[view.getUint8(resultPointer + errorOffset)] };
  } else if (operation === 'validate') {
    result = { ok: true, value: null };
  } else if (operation === 'compact') {
    const pointer = view.getUint32(resultPointer + 4, true);
    const length = view.getUint32(resultPointer + 8, true);
    result = {
      ok: true,
      value: decoder.decode(new Uint8Array(exports.memory.buffer, pointer, length)),
    };
  } else {
    const listPointer = view.getUint32(resultPointer + 4, true);
    const listLength = view.getUint32(resultPointer + 8, true);
    const values = [];
    for (let index = 0; index < listLength; index += 1) {
      const itemPointer = listPointer + index * 12;
      if (view.getUint8(itemPointer) === 0) {
        values.push(null);
      } else {
        const pointer = view.getUint32(itemPointer + 4, true);
        const length = view.getUint32(itemPointer + 8, true);
        values.push(decoder.decode(new Uint8Array(exports.memory.buffer, pointer, length)));
      }
    }
    result = { ok: true, value: values };
  }

  const postReturn = exports[`cabi_post_wasmc:json/document@0.0.1#${operation}`];
  if (postReturn) postReturn(resultPointer);
  return result;
}

const cases = [
  ['compact-empty', 'compact', '{}'],
  ['compact-object', 'compact', '{"a":1}'],
  ['compact-whitespace', 'compact', ' { "b" : 2, "a" : [1, true, null] } '],
  ['compact-array', 'compact', '[1,2,3]'],
  ['compact-string', 'compact', '"x"'],
  ['compact-invalid', 'compact', 'bad'],
  ['validate-object', 'validate', '{}'],
  ['validate-null', 'validate', 'null'],
  ['validate-invalid', 'validate', 'bad'],
  ['select-nested', 'select', '{"a":{"b":2},"arr":[10,20]}', ['/a', '/a/b', '/arr/1', '/missing']],
  ['select-escaped', 'select', '{"a/b":1,"m~n":2}', ['/a~1b', '/m~0n', '/missing']],
  ['select-relative', 'select', '{"a":1}', ['a']],
  ['select-bad-escape', 'select', '{"a":1}', ['/bad~2']],
  ['select-array', 'select', '[10,20]', ['/0', '/1', '/2']],
];

const receipts = [];
for (const [name, operation, input, pointers] of cases) {
  const oracle = invoke(oracleModule, operation, input, pointers);
  const candidate = invoke(candidateModule, operation, input, pointers);
  assert.deepEqual(candidate, oracle, name);
  receipts.push({ name, result: candidate });
}

  const boundaryCases = [];
  const exactInput = JSON.stringify('a'.repeat(65534));
  const overInput = JSON.stringify('a'.repeat(65535));
  boundaryCases.push(
    ['input-65536', 'validate', exactInput],
    ['input-65537', 'validate', overInput],
  );
  const pointer1024 = '/' + 'a'.repeat(1023);
  const pointer1025 = '/' + 'a'.repeat(1024);
  boundaryCases.push(
    ['pointer-1024', 'select', '{"a":1}', [pointer1024]],
    ['pointer-1025', 'select', '{"a":1}', [pointer1025]],
  );
  boundaryCases.push(
    ['pointers-64', 'select', '{"a":1}', Array(64).fill('/missing')],
    ['pointers-65', 'select', '{"a":1}', Array(65).fill('/missing')],
  );
  for (const depth of [64, 65]) {
    const document = '['.repeat(depth) + '0' + ']'.repeat(depth);
    boundaryCases.push(['depth-' + depth, 'validate', document]);
  }
  const outputDocument = '{"x":' + JSON.stringify('z'.repeat(2000)) + '}';
  boundaryCases.push(
    ['output-under-65536', 'select', outputDocument, Array(32).fill('/x')],
    ['output-over-65536', 'select', outputDocument, Array(33).fill('/x')],
  );

  const boundaryReceipts = [];
  for (const [name, operation, input, pointers] of boundaryCases) {
    const oracle = invoke(oracleModule, operation, input, pointers);
    const candidate = invoke(candidateModule, operation, input, pointers);
    assert.deepEqual(candidate, oracle, name);
    const rendered = JSON.stringify(candidate);
    boundaryReceipts.push({
      name,
      result: rendered.length > 120 ? rendered.slice(0, 120) + '…' : rendered,
    });
  }

  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    cases: cases.length + boundaryCases.length,
    host_imports: 0,
    wit_equivalent: true,
    oracle_sha256: manifest.oracle.sha256,
    candidate_sha256: createHash('sha256').update(candidateBytes).digest('hex'),
    candidate_bytes: candidateBytes.length,
    representative_behavior_equivalent: true,
    resource_boundary_calibration: {
      input_bytes: 65536,
      output_bytes: 65536,
      pointers: 64,
      pointer_bytes: 1024,
      depth: 64,
      equivalent: true,
    },
    receipts,
    boundary_receipts: boundaryReceipts,
  }));
