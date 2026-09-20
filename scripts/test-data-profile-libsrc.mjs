import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-data-profile');
const manifest = JSON.parse(await readFile(join(candidateRoot, 'candidate.json'), 'utf8'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    timeout: options.timeout ?? 300000,
    maxBuffer: 64 << 20,
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
  '--manifest-path', 'libsrc/wasmc-data-profile/Cargo.toml',
]);

const artifact = resolve(root, manifest.build.artifact);
const bytes = await readFile(artifact);
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);

const wit = run('wasm-tools', ['component', 'wit', artifact]);
assert.match(wit, /import wasmc:data-core\/types@0\.0\.1;/);
assert.match(wit, /export wasmc:data-profile\/profile@0\.0\.1;/);
assert.doesNotMatch(wit, /import .*host/i);

const work = await mkdtemp(join(tmpdir(), 'wasmc-data-profile-'));
try {
  const component = join(work, 'profile.component.wasm');
  run('wasm-tools', ['component', 'new', artifact, '-o', component]);

  const batch = '{rows: 4, fields: [{name: "ok", data-type: boolean, nullable: true}, {name: "signed", data-type: int64, nullable: true}, {name: "unsigned", data-type: uint64, nullable: true}, {name: "ratio", data-type: float64, nullable: true}, {name: "text", data-type: utf8, nullable: true}, {name: "bytes", data-type: binary, nullable: true}], columns: [boolean-column([some(true), some(false), none, some(true)]), int64-column([some(1), none, some(5), some(-2)]), uint64-column([some(1), some(3), none, some(8)]), float64-column([some(1.5), none, some(2.5), some(-1)]), utf8-column([some("a"), none, some("中文"), some("")]), binary-column([some([1,2]), some([]), none, some([3,4,5])])]}';
  const cases = [
    [
      'all-columns',
      'describe(' + batch + ', [])',
      'ok([{column: 0, name: "ok", data-type: boolean, summary: boolean({non-null: 3, nulls: 1, true-count: 2, false-count: 1})}, {column: 1, name: "signed", data-type: int64, summary: int64({non-null: 3, nulls: 1, min: some(-2), max: some(5), mean: some(1.3333333333333333)})}, {column: 2, name: "unsigned", data-type: uint64, summary: uint64({non-null: 3, nulls: 1, min: some(1), max: some(8), mean: some(4)})}, {column: 3, name: "ratio", data-type: float64, summary: float64({non-null: 3, nulls: 1, min: some(-1), max: some(2.5), mean: some(1)})}, {column: 4, name: "text", data-type: utf8, summary: utf8({non-null: 3, nulls: 1, min-length: some(0), max-length: some(6), mean-length: some(2.3333333333333335)})}, {column: 5, name: "bytes", data-type: binary, summary: binary({non-null: 3, nulls: 1, min-length: some(0), max-length: some(3), mean-length: some(1.6666666666666667)})}])',
    ],
    [
      'caller-order',
      'describe(' + batch + ', [5,0])',
      'ok([{column: 5, name: "bytes", data-type: binary, summary: binary({non-null: 3, nulls: 1, min-length: some(0), max-length: some(3), mean-length: some(1.6666666666666667)})}, {column: 0, name: "ok", data-type: boolean, summary: boolean({non-null: 3, nulls: 1, true-count: 2, false-count: 1})}])',
    ],
    [
      'all-null',
      'describe({rows: 2, fields: [{name: "v", data-type: int64, nullable: true}], columns: [int64-column([none, none])]}, [])',
      'ok([{column: 0, name: "v", data-type: int64, summary: int64({non-null: 0, nulls: 2})}])',
    ],
    ['duplicate-column', 'describe(' + batch + ', [1,1])', 'err(duplicate-column)'],
    ['column-out-of-bounds', 'describe(' + batch + ', [6])', 'err(column-out-of-bounds)'],
    [
      'invalid-batch',
      'describe({rows: 1, fields: [{name: "v", data-type: int64, nullable: false}], columns: [int64-column([none])]}, [])',
      'err(invalid-batch)',
    ],
    [
      'integer-overflow',
      'describe({rows: 2, fields: [{name: "v", data-type: int64, nullable: false}], columns: [int64-column([some(9223372036854775807), some(1)])]}, [])',
      'err(overflow)',
    ],
  ];

  const receipts = [];
  for (const [name, invocation, expected] of cases) {
    const actual = run('wasmtime', ['run', '--invoke', invocation, component], { timeout: 30000 });
    assert.equal(actual, expected, name);
    receipts.push({ name, result: actual });
  }

  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    candidate_bytes: bytes.length,
    candidate_sha256: createHash('sha256').update(bytes).digest('hex'),
    core_imports: 0,
    selection: 'empty-all; explicit-preserves-order; duplicates-rejected',
    summaries: ['boolean','int64','uint64','float64','utf8-byte-length','binary-length'],
    cases: receipts.length,
    receipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
