import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

const work = await mkdtemp(join(tmpdir(), 'wasmc-json-graduation-'));
try {
  const oracleComponent = join(work, 'oracle.component.wasm');
  const candidateComponent = join(work, 'candidate.component.wasm');
  run('wasm-tools', ['component', 'new', oraclePath, '-o', oracleComponent]);
  run('wasm-tools', ['component', 'new', candidatePath, '-o', candidateComponent]);

  const cases = [
    'compact("{}")',
    'compact("{\\\"a\\\":1}")',
    'compact(" { \\\"b\\\" : 2, \\\"a\\\" : [1, true, null] } ")',
    'compact("[1,2,3]")',
    'compact("\\\"x\\\"")',
    'compact("bad")',
    'validate("{}")',
    'validate("null")',
    'validate("bad")',
    'select("{\\\"a\\\":{\\\"b\\\":2},\\\"arr\\\":[10,20]}", ["/a","/a/b","/arr/1","/missing"])',
    'select("{\\\"a/b\\\":1,\\\"m~n\\\":2}", ["/a~1b","/m~0n","/missing"])',
    'select("{\\\"a\\\":1}", ["a"])',
    'select("{\\\"a\\\":1}", ["/bad~2"])',
    'select("[10,20]", ["/0","/1","/2"])',
  ];

  const receipts = [];
  for (const invocation of cases) {
    const oracle = run('wasmtime', ['run', '--invoke', invocation, oracleComponent], { timeout: 30000 });
    const candidate = run('wasmtime', ['run', '--invoke', invocation, candidateComponent], { timeout: 30000 });
    assert.equal(candidate, oracle, invocation);
    receipts.push({ invocation, result: candidate });
  }

  const quote = value => JSON.stringify(value);
  const boundaryCases = [];
  const exactInput = JSON.stringify('a'.repeat(65534));
  const overInput = JSON.stringify('a'.repeat(65535));
  boundaryCases.push(
    ['input-65536', 'validate(' + quote(exactInput) + ')'],
    ['input-65537', 'validate(' + quote(overInput) + ')'],
  );
  const pointer1024 = '/' + 'a'.repeat(1023);
  const pointer1025 = '/' + 'a'.repeat(1024);
  boundaryCases.push(
    ['pointer-1024', 'select("{\\\"a\\\":1}", [' + quote(pointer1024) + '])'],
    ['pointer-1025', 'select("{\\\"a\\\":1}", [' + quote(pointer1025) + '])'],
  );
  boundaryCases.push(
    ['pointers-64', 'select("{\\\"a\\\":1}", [' + Array(64).fill('"/missing"').join(',') + '])'],
    ['pointers-65', 'select("{\\\"a\\\":1}", [' + Array(65).fill('"/missing"').join(',') + '])'],
  );
  for (const depth of [64, 65]) {
    const document = '['.repeat(depth) + '0' + ']'.repeat(depth);
    boundaryCases.push(['depth-' + depth, 'validate(' + quote(document) + ')']);
  }
  const outputDocument = '{"x":' + JSON.stringify('z'.repeat(2000)) + '}';
  boundaryCases.push(
    ['output-under-65536', 'select(' + quote(outputDocument) + ', [' + Array(32).fill('"/x"').join(',') + '])'],
    ['output-over-65536', 'select(' + quote(outputDocument) + ', [' + Array(33).fill('"/x"').join(',') + '])'],
  );

  const boundaryReceipts = [];
  for (const [name, invocation] of boundaryCases) {
    const oracle = run('wasmtime', ['run', '--invoke', invocation, oracleComponent], { timeout: 30000 });
    const candidate = run('wasmtime', ['run', '--invoke', invocation, candidateComponent], { timeout: 30000 });
    assert.equal(candidate, oracle, name);
    boundaryReceipts.push({
      name,
      result: candidate.length > 120 ? candidate.slice(0, 120) + '…' : candidate,
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
} finally {
  await rm(work, { recursive: true, force: true });
}
