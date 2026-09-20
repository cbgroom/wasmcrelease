import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-compression');
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
  'libsrc/wasmc-compression/Cargo.toml',
]);

const candidatePath = resolve(
  root,
  'libsrc/wasmc-compression/target/wasm32-unknown-unknown/release/wasmc_compression_public.wasm',
);
const candidateBytes = await readFile(candidatePath);
assert.ok(candidateBytes.length <= 256 * 1024, 'candidate unexpectedly large');

const candidateModule = new WebAssembly.Module(candidateBytes);
const oracleModule = new WebAssembly.Module(oracleBytes);
assert.deepEqual(WebAssembly.Module.imports(candidateModule), []);
assert.deepEqual(WebAssembly.Module.imports(oracleModule), []);

const compressionErrors = [
  'input-too-large',
  'output-too-large',
  'invalid-stream',
  'internal-failure',
];

const rawCall = async (bytes, exportName, input) => {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const { memory, cabi_realloc: realloc } = instance.exports;
  const ptr = input.length === 0 ? 0 : realloc(0, 0, 1, input.length);
  if (input.length !== 0) {
    new Uint8Array(memory.buffer, ptr, input.length).set(input);
  }
  const resultPtr = instance.exports[exportName](ptr, input.length);
  const view = new DataView(memory.buffer);
  const tag = view.getUint8(resultPtr);
  if (tag === 1) {
    return { error: compressionErrors[view.getUint8(resultPtr + 4)] };
  }
  assert.equal(tag, 0);
  const outputPtr = view.getUint32(resultPtr + 4, true);
  const outputLength = view.getUint32(resultPtr + 8, true);
  return {
    output_length: outputLength,
    prefix: [...new Uint8Array(memory.buffer, outputPtr, Math.min(4, outputLength))],
  };
};

const oracleWit = run('wasm-tools', ['component', 'wit', oraclePath]);
const candidateWit = run('wasm-tools', ['component', 'wit', candidatePath]);
assert.equal(candidateWit, oracleWit, 'candidate WIT differs from frozen oracle contract');

const work = await mkdtemp(join(tmpdir(), 'wasmc-compression-graduation-'));
try {
  const oracleComponent = join(work, 'oracle.component.wasm');
  const candidateComponent = join(work, 'candidate.component.wasm');
  run('wasm-tools', ['component', 'new', oraclePath, '-o', oracleComponent]);
  run('wasm-tools', ['component', 'new', candidatePath, '-o', candidateComponent]);

  const cases = [
    'compress([])',
    'compress([104,101,108,108,111])',
    'compress([97,97,97,97,97,97,97,97,97,97])',
    'compress([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])',
    'decompress([31,139,8,0,0,0,0,0,0,255,3,0,0,0,0,0,0,0,0,0])',
    'decompress([31,139,8,0,0,0,0,0,0,255,203,72,205,201,201,7,0,134,166,16,54,5,0,0,0])',
    'decompress([1,2,3])',
  ];

  const receipts = [];
  for (const invocation of cases) {
    const oracle = run('wasmtime', ['run', '--invoke', invocation, oracleComponent], { timeout: 30000 });
    const candidate = run('wasmtime', ['run', '--invoke', invocation, candidateComponent], { timeout: 30000 });
    assert.equal(candidate, oracle, invocation);
    receipts.push({ invocation, result: candidate });
  }

  const boundaryCases = [
    ['input-1MiB', 'wasmc:compression/gzip@0.0.1#compress', Buffer.alloc(1 << 20, 1)],
    ['input-1MiB+1', 'wasmc:compression/gzip@0.0.1#compress', Buffer.alloc((1 << 20) + 1, 1)],
    [
      'output-4MiB',
      'wasmc:compression/gzip@0.0.1#decompress',
      zlib.gzipSync(Buffer.alloc(4 << 20, 97), { level: 9, mtime: 0 }),
    ],
    [
      'output-4MiB+1',
      'wasmc:compression/gzip@0.0.1#decompress',
      zlib.gzipSync(Buffer.alloc((4 << 20) + 1, 97), { level: 9, mtime: 0 }),
    ],
  ];
  const boundaryReceipts = [];
  for (const [name, exportName, input] of boundaryCases) {
    const oracle = await rawCall(oracleBytes, exportName, input);
    const candidate = await rawCall(candidateBytes, exportName, input);
    assert.deepEqual(candidate, oracle, name);
    boundaryReceipts.push({ name, result: candidate });
  }

  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    cases: cases.length + boundaryCases.length,
    host_imports: 0,
    wit_equivalent: true,
    deterministic_gzip_byte_equivalent: true,
    oracle_sha256: manifest.oracle.sha256,
    candidate_sha256: createHash('sha256').update(candidateBytes).digest('hex'),
    candidate_bytes: candidateBytes.length,
    representative_behavior_equivalent: true,
    resource_boundary_calibration: {
      input_bytes: 1 << 20,
      output_bytes: 4 << 20,
      equivalent: true,
    },
    receipts,
    boundary_receipts: boundaryReceipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
