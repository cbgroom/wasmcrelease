import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-data-interchange');
const manifest = JSON.parse(await readFile(join(candidateRoot, 'candidate.json'), 'utf8'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    timeout: options.timeout ?? 300000,
    maxBuffer: 128 << 20,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + ' failed (' + result.status + '):\n' + result.stderr + '\n' + result.stdout);
  }
  return result.stdout.trim();
}

run('cargo', [
  '+1.96.0', 'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
  '--manifest-path', 'libsrc/wasmc-data-interchange/Cargo.toml',
]);

const artifact = resolve(root, manifest.build.artifact);
const bytes = await readFile(artifact);
assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(bytes)), []);
const wit = run('wasm-tools', ['component', 'wit', artifact]);
assert.match(wit, /import wasmc:data-core\/types@0\.0\.1;/);
assert.match(wit, /export wasmc:data-interchange\/adapter@0\.0\.1;/);
assert.doesNotMatch(wit, /import .*host/i);

const work = await mkdtemp(join(tmpdir(), 'wasmc-data-interchange-'));
try {
  const component = join(work, 'interchange.component.wasm');
  run('wasm-tools', ['component', 'new', artifact, '-o', component]);
  const fields = '[{name: "b", data-type: boolean, nullable: true}, {name: "i", data-type: int64, nullable: true}, {name: "u", data-type: uint64, nullable: true}, {name: "f", data-type: float64, nullable: true}, {name: "s", data-type: utf8, nullable: true}, {name: "x", data-type: binary, nullable: true}]';
  const first = '{rows: 2, fields: ' + fields + ', columns: [boolean-column([some(true), none]), int64-column([some(-1), some(2)]), uint64-column([some(1), none]), float64-column([some(1.5), some(2.5)]), utf8-column([some("a"), none]), binary-column([some([1, 2]), some([3])])]}';
  const second = '{rows: 1, fields: ' + fields + ', columns: [boolean-column([some(false)]), int64-column([some(3)]), uint64-column([some(4)]), float64-column([none]), utf8-column([some("b")]), binary-column([none])]}';
  const values = '[' + first + ', ' + second + ']';
  const encodeOptions = '{max-batches: 2, max-rows: 3, max-output-bytes: 1048576}';
  const decodeOptions = '{max-input-bytes: 1048576, max-batches: 2, max-rows: 3, batch-rows: 2}';
  const expected = 'ok(' + values + ')';

  const ipcEncoded = run('wasmtime', ['run', '--invoke', 'ipc-file-encode(' + values + ', ' + encodeOptions + ')', component]);
  assert.match(ipcEncoded, /^ok\(\[/);
  const ipcBytes = ipcEncoded.slice(3, -1);
  assert.equal(run('wasmtime', ['run', '--invoke', 'ipc-file-decode(' + ipcBytes + ', ' + decodeOptions + ')', component]), expected);

  const parquetEncoded = run('wasmtime', ['run', '--invoke', 'parquet-encode(' + values + ', ' + encodeOptions + ')', component]);
  assert.match(parquetEncoded, /^ok\(\[/);
  const parquetBytes = parquetEncoded.slice(3, -1);
  assert.equal(run('wasmtime', ['run', '--invoke', 'parquet-decode(' + parquetBytes + ', ' + decodeOptions + ')', component]), expected);

  const cases = [
    ['empty-encode', 'ipc-file-encode([], ' + encodeOptions + ')', 'err(empty-input)'],
    ['invalid-options', 'ipc-file-encode([' + first + '], {max-batches: 0, max-rows: 3, max-output-bytes: 100})', 'err(invalid-options)'],
    ['encode-batch-limit', 'ipc-file-encode(' + values + ', {max-batches: 1, max-rows: 3, max-output-bytes: 1048576})', 'err(batch-limit-exceeded)'],
    ['encode-row-limit', 'ipc-file-encode(' + values + ', {max-batches: 2, max-rows: 2, max-output-bytes: 1048576})', 'err(row-limit-exceeded)'],
    ['encode-output-limit', 'ipc-file-encode([' + first + '], {max-batches: 1, max-rows: 2, max-output-bytes: 8})', 'err(output-limit-exceeded)'],
    ['schema-mismatch', 'ipc-file-encode([' + first + ', {rows: 0, fields: [{name: "i", data-type: int64, nullable: true}], columns: [int64-column([])]}], ' + encodeOptions + ')', 'err(schema-mismatch)'],
    ['decode-input-limit', 'ipc-file-decode(' + ipcBytes + ', {max-input-bytes: 8, max-batches: 2, max-rows: 3, batch-rows: 2})', 'err(input-limit-exceeded)'],
    ['decode-batch-limit', 'ipc-file-decode(' + ipcBytes + ', {max-input-bytes: 1048576, max-batches: 1, max-rows: 3, batch-rows: 2})', 'err(batch-limit-exceeded)'],
    ['decode-row-limit', 'ipc-file-decode(' + ipcBytes + ', {max-input-bytes: 1048576, max-batches: 2, max-rows: 2, batch-rows: 2})', 'err(row-limit-exceeded)'],
    ['invalid-ipc', 'ipc-file-decode([1, 2, 3], ' + decodeOptions + ')', 'err(invalid-data)'],
    ['invalid-parquet', 'parquet-decode([1, 2, 3], ' + decodeOptions + ')', 'err(invalid-data)'],
  ];
  const receipts = [];
  for (const [name, invocation, expectedResult] of cases) {
    const actual = run('wasmtime', ['run', '--invoke', invocation, component], { timeout: 30000 });
    assert.equal(actual, expectedResult, name);
    receipts.push({ name, result: actual });
  }
  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    candidate_bytes: bytes.length,
    candidate_sha256: createHash('sha256').update(bytes).digest('hex'),
    core_imports: 0,
    formats: ['arrow-ipc-file', 'parquet-uncompressed'],
    supported_types: ['boolean', 'int64', 'uint64', 'float64', 'utf8', 'binary'],
    bounded: ['input-bytes', 'output-bytes', 'batches', 'rows', 'parquet-batch-rows'],
    roundtrips: 2,
    negative_cases: receipts.length,
    receipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
