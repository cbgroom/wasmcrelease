import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-data-relational');
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
  '--manifest-path', 'libsrc/wasmc-data-relational/Cargo.toml',
]);

const artifact = resolve(root, manifest.build.artifact);
const bytes = await readFile(artifact);
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);

const wit = run('wasm-tools', ['component', 'wit', artifact]);
assert.match(wit, /import wasmc:data-core\/types@0\.0\.1;/);
assert.match(wit, /export wasmc:data-relational\/relational@0\.0\.1;/);
assert.doesNotMatch(wit, /import .*host/i);

const work = await mkdtemp(join(tmpdir(), 'wasmc-data-relational-'));
try {
  const component = join(work, 'relational.component.wasm');
  run('wasm-tools', ['component', 'new', artifact, '-o', component]);

  const batch = '{rows: 5, fields: [{name: "g", data-type: utf8, nullable: true}, {name: "v", data-type: int64, nullable: true}], columns: [utf8-column([some("b"), some("a"), some("b"), none, some("a")]), int64-column([some(1), some(2), none, some(4), some(6)])]}';
  const aggs = '[count-all("rows"), count({column: 1, alias: "count_v"}), sum({column: 1, alias: "sum_v"}), min({column: 1, alias: "min_v"}), max({column: 1, alias: "max_v"}), mean({column: 1, alias: "mean_v"})]';
  const cases = [
    [
      'grouped',
      'group-aggregate(' + batch + ', [0], ' + aggs + ')',
      'ok({rows: 3, fields: [{name: "g", data-type: utf8, nullable: true}, {name: "rows", data-type: uint64, nullable: false}, {name: "count_v", data-type: uint64, nullable: false}, {name: "sum_v", data-type: int64, nullable: true}, {name: "min_v", data-type: int64, nullable: true}, {name: "max_v", data-type: int64, nullable: true}, {name: "mean_v", data-type: float64, nullable: true}], columns: [utf8-column([none, some("a"), some("b")]), uint64-column([some(1), some(2), some(2)]), uint64-column([some(1), some(2), some(1)]), int64-column([some(4), some(8), some(1)]), int64-column([some(4), some(2), some(1)]), int64-column([some(4), some(6), some(1)]), float64-column([some(4), some(4), some(1)])]})',
    ],
    [
      'global',
      'group-aggregate(' + batch + ', [], ' + aggs + ')',
      'ok({rows: 1, fields: [{name: "rows", data-type: uint64, nullable: false}, {name: "count_v", data-type: uint64, nullable: false}, {name: "sum_v", data-type: int64, nullable: true}, {name: "min_v", data-type: int64, nullable: true}, {name: "max_v", data-type: int64, nullable: true}, {name: "mean_v", data-type: float64, nullable: true}], columns: [uint64-column([some(5)]), uint64-column([some(4)]), int64-column([some(13)]), int64-column([some(1)]), int64-column([some(6)]), float64-column([some(3.25)])]})',
    ],
    [
      'global-empty',
      'group-aggregate({rows: 0, fields: [{name: "g", data-type: utf8, nullable: true}, {name: "v", data-type: int64, nullable: true}], columns: [utf8-column([]), int64-column([])]}, [], [count-all("rows"), sum({column: 1, alias: "sum_v"}), mean({column: 1, alias: "mean_v"})])',
      'ok({rows: 1, fields: [{name: "rows", data-type: uint64, nullable: false}, {name: "sum_v", data-type: int64, nullable: true}, {name: "mean_v", data-type: float64, nullable: true}], columns: [uint64-column([some(0)]), int64-column([none]), float64-column([none])]})',
    ],
    [
      'keyed-empty',
      'group-aggregate({rows: 0, fields: [{name: "g", data-type: utf8, nullable: true}, {name: "v", data-type: int64, nullable: true}], columns: [utf8-column([]), int64-column([])]}, [0], [count-all("rows")])',
      'ok({rows: 0, fields: [{name: "g", data-type: utf8, nullable: true}, {name: "rows", data-type: uint64, nullable: false}], columns: [utf8-column([]), uint64-column([])]})',
    ],
    [
      'duplicate-key',
      'group-aggregate(' + batch + ', [0,0], [count-all("rows")])',
      'err(duplicate-key)',
    ],
    [
      'alias-conflict',
      'group-aggregate(' + batch + ', [0], [count-all("g")])',
      'err(duplicate-output-name)',
    ],
    [
      'unsupported-sum',
      'group-aggregate(' + batch + ', [0], [sum({column: 0, alias: "sum_g"})])',
      'err(unsupported-type)',
    ],
    [
      'overflow',
      'group-aggregate({rows: 2, fields: [{name: "v", data-type: int64, nullable: false}], columns: [int64-column([some(9223372036854775807), some(1)])]}, [], [sum({column: 0, alias: "sum_v"})])',
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
    deterministic_group_order: true,
    aggregate_null_semantics: 'ignore-input-null; nullable-empty-result',
    operations: ['group-aggregate'],
    aggregates: ['count-all','count','sum','min','max','mean'],
    cases: receipts.length,
    receipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
