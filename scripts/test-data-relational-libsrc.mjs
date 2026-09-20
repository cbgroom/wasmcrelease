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
  const unionLeft = '{rows: 2, fields: [{name: "id", data-type: int64, nullable: true}, {name: "name", data-type: utf8, nullable: false}], columns: [int64-column([some(1), none]), utf8-column([some("a"), some("b")])]}';
  const unionRight = '{rows: 1, fields: [{name: "id", data-type: int64, nullable: true}, {name: "name", data-type: utf8, nullable: false}], columns: [int64-column([some(3)]), utf8-column([some("c")])]}';
  const unionEmpty = '{rows: 0, fields: [{name: "id", data-type: int64, nullable: true}, {name: "name", data-type: utf8, nullable: false}], columns: [int64-column([]), utf8-column([])]}';
  const joinLeft = '{rows: 5, fields: [{name: "id", data-type: int64, nullable: true}, {name: "label", data-type: utf8, nullable: false}], columns: [int64-column([some(2), some(1), some(2), none, some(9)]), utf8-column([some("l2a"), some("l1"), some("l2b"), some("ln"), some("l9")])]}';
  const joinRight = '{rows: 4, fields: [{name: "id", data-type: int64, nullable: true}, {name: "tag", data-type: utf8, nullable: false}], columns: [int64-column([some(2), some(2), some(1), none]), utf8-column([some("r2a"), some("r2b"), some("r1"), some("rn")])]}';
  const joinKeys = '[{left-column: 0, right-column: 0}]';
  const cases = [
    [
      'join-inner-stable',
      'equi-join(' + joinLeft + ', ' + joinRight + ', ' + joinKeys + ', {kind: inner, right-prefix: "r_", max-output-rows: 8})',
      'ok({rows: 5, fields: [{name: "id", data-type: int64, nullable: true}, {name: "label", data-type: utf8, nullable: false}, {name: "r_id", data-type: int64, nullable: true}, {name: "r_tag", data-type: utf8, nullable: false}], columns: [int64-column([some(2), some(2), some(1), some(2), some(2)]), utf8-column([some("l2a"), some("l2a"), some("l1"), some("l2b"), some("l2b")]), int64-column([some(2), some(2), some(1), some(2), some(2)]), utf8-column([some("r2a"), some("r2b"), some("r1"), some("r2a"), some("r2b")])]})',
    ],
    [
      'join-left-null-unmatched',
      'equi-join(' + joinLeft + ', ' + joinRight + ', ' + joinKeys + ', {kind: left, right-prefix: "r_", max-output-rows: 8})',
      'ok({rows: 7, fields: [{name: "id", data-type: int64, nullable: true}, {name: "label", data-type: utf8, nullable: false}, {name: "r_id", data-type: int64, nullable: true}, {name: "r_tag", data-type: utf8, nullable: true}], columns: [int64-column([some(2), some(2), some(1), some(2), some(2), none, some(9)]), utf8-column([some("l2a"), some("l2a"), some("l1"), some("l2b"), some("l2b"), some("ln"), some("l9")]), int64-column([some(2), some(2), some(1), some(2), some(2), none, none]), utf8-column([some("r2a"), some("r2b"), some("r1"), some("r2a"), some("r2b"), none, none])]})',
    ],
    [
      'join-composite-key',
      'equi-join({rows: 3, fields: [{name: "a", data-type: int64, nullable: false}, {name: "b", data-type: utf8, nullable: false}], columns: [int64-column([some(1), some(1), some(2)]), utf8-column([some("x"), some("y"), some("x")])]}, {rows: 2, fields: [{name: "a2", data-type: int64, nullable: false}, {name: "b2", data-type: utf8, nullable: false}], columns: [int64-column([some(1), some(2)]), utf8-column([some("y"), some("x")])]}, [{left-column: 0, right-column: 0}, {left-column: 1, right-column: 1}], {kind: inner, right-prefix: "r_", max-output-rows: 4})',
      'ok({rows: 2, fields: [{name: "a", data-type: int64, nullable: false}, {name: "b", data-type: utf8, nullable: false}, {name: "r_a2", data-type: int64, nullable: false}, {name: "r_b2", data-type: utf8, nullable: false}], columns: [int64-column([some(1), some(2)]), utf8-column([some("y"), some("x")]), int64-column([some(1), some(2)]), utf8-column([some("y"), some("x")])]})',
    ],
    [
      'join-all-key-types',
      'equi-join({rows: 1, fields: [{name: "lb", data-type: boolean, nullable: false}, {name: "li", data-type: int64, nullable: false}, {name: "lu", data-type: uint64, nullable: false}, {name: "lf", data-type: float64, nullable: false}, {name: "ls", data-type: utf8, nullable: false}, {name: "lx", data-type: binary, nullable: false}], columns: [boolean-column([some(true)]), int64-column([some(-1)]), uint64-column([some(2)]), float64-column([some(1.5)]), utf8-column([some("x")]), binary-column([some([1, 2])])]}, {rows: 1, fields: [{name: "rb", data-type: boolean, nullable: false}, {name: "ri", data-type: int64, nullable: false}, {name: "ru", data-type: uint64, nullable: false}, {name: "rf", data-type: float64, nullable: false}, {name: "rs", data-type: utf8, nullable: false}, {name: "rx", data-type: binary, nullable: false}], columns: [boolean-column([some(true)]), int64-column([some(-1)]), uint64-column([some(2)]), float64-column([some(1.5)]), utf8-column([some("x")]), binary-column([some([1, 2])])]}, [{left-column: 0, right-column: 0}, {left-column: 1, right-column: 1}, {left-column: 2, right-column: 2}, {left-column: 3, right-column: 3}, {left-column: 4, right-column: 4}, {left-column: 5, right-column: 5}], {kind: inner, right-prefix: "r_", max-output-rows: 1})',
      'ok({rows: 1, fields: [{name: "lb", data-type: boolean, nullable: false}, {name: "li", data-type: int64, nullable: false}, {name: "lu", data-type: uint64, nullable: false}, {name: "lf", data-type: float64, nullable: false}, {name: "ls", data-type: utf8, nullable: false}, {name: "lx", data-type: binary, nullable: false}, {name: "r_rb", data-type: boolean, nullable: false}, {name: "r_ri", data-type: int64, nullable: false}, {name: "r_ru", data-type: uint64, nullable: false}, {name: "r_rf", data-type: float64, nullable: false}, {name: "r_rs", data-type: utf8, nullable: false}, {name: "r_rx", data-type: binary, nullable: false}], columns: [boolean-column([some(true)]), int64-column([some(-1)]), uint64-column([some(2)]), float64-column([some(1.5)]), utf8-column([some("x")]), binary-column([some([1, 2])]), boolean-column([some(true)]), int64-column([some(-1)]), uint64-column([some(2)]), float64-column([some(1.5)]), utf8-column([some("x")]), binary-column([some([1, 2])])]})',
    ],
    [
      'join-empty-keys',
      'equi-join(' + joinLeft + ', ' + joinRight + ', [], {kind: inner, right-prefix: "r_", max-output-rows: 8})',
      'err(empty-keys)',
    ],
    [
      'join-duplicate-key',
      'equi-join(' + joinLeft + ', ' + joinRight + ', [{left-column: 0, right-column: 0}, {left-column: 0, right-column: 1}], {kind: inner, right-prefix: "r_", max-output-rows: 8})',
      'err(duplicate-key)',
    ],
    [
      'join-key-type-mismatch',
      'equi-join(' + joinLeft + ', ' + joinRight + ', [{left-column: 0, right-column: 1}], {kind: inner, right-prefix: "r_", max-output-rows: 8})',
      'err(key-type-mismatch)',
    ],
    [
      'join-output-name-conflict',
      'equi-join(' + joinLeft + ', ' + joinRight + ', ' + joinKeys + ', {kind: inner, right-prefix: "", max-output-rows: 8})',
      'err(duplicate-output-name)',
    ],
    [
      'join-invalid-limit',
      'equi-join(' + joinLeft + ', ' + joinRight + ', ' + joinKeys + ', {kind: inner, right-prefix: "r_", max-output-rows: 0})',
      'err(invalid-limit)',
    ],
    [
      'join-output-limit',
      'equi-join(' + joinLeft + ', ' + joinRight + ', ' + joinKeys + ', {kind: inner, right-prefix: "r_", max-output-rows: 4})',
      'err(output-limit-exceeded)',
    ],
    [
      'join-invalid-batch',
      'equi-join({rows: 1, fields: [{name: "id", data-type: int64, nullable: false}], columns: [int64-column([])]}, ' + joinRight + ', ' + joinKeys + ', {kind: inner, right-prefix: "r_", max-output-rows: 8})',
      'err(invalid-batch)',
    ],
    [
      'union-order',
      'union-all([' + unionLeft + ', ' + unionRight + '])',
      'ok({rows: 3, fields: [{name: "id", data-type: int64, nullable: true}, {name: "name", data-type: utf8, nullable: false}], columns: [int64-column([some(1), none, some(3)]), utf8-column([some("a"), some("b"), some("c")])]})',
    ],
    [
      'union-all-types',
      'union-all([{rows: 1, fields: [{name: "b", data-type: boolean, nullable: false}, {name: "i", data-type: int64, nullable: false}, {name: "u", data-type: uint64, nullable: false}, {name: "f", data-type: float64, nullable: false}, {name: "s", data-type: utf8, nullable: false}, {name: "x", data-type: binary, nullable: false}], columns: [boolean-column([some(true)]), int64-column([some(-1)]), uint64-column([some(1)]), float64-column([some(1.5)]), utf8-column([some("a")]), binary-column([some([1, 2])])]}, {rows: 1, fields: [{name: "b", data-type: boolean, nullable: false}, {name: "i", data-type: int64, nullable: false}, {name: "u", data-type: uint64, nullable: false}, {name: "f", data-type: float64, nullable: false}, {name: "s", data-type: utf8, nullable: false}, {name: "x", data-type: binary, nullable: false}], columns: [boolean-column([some(false)]), int64-column([some(2)]), uint64-column([some(3)]), float64-column([some(2.5)]), utf8-column([some("b")]), binary-column([some([3])])]}])',
      'ok({rows: 2, fields: [{name: "b", data-type: boolean, nullable: false}, {name: "i", data-type: int64, nullable: false}, {name: "u", data-type: uint64, nullable: false}, {name: "f", data-type: float64, nullable: false}, {name: "s", data-type: utf8, nullable: false}, {name: "x", data-type: binary, nullable: false}], columns: [boolean-column([some(true), some(false)]), int64-column([some(-1), some(2)]), uint64-column([some(1), some(3)]), float64-column([some(1.5), some(2.5)]), utf8-column([some("a"), some("b")]), binary-column([some([1, 2]), some([3])])]})',
    ],
    [
      'union-empty-batch',
      'union-all([' + unionEmpty + ', ' + unionRight + ', ' + unionEmpty + '])',
      'ok(' + unionRight + ')',
    ],
    [
      'union-empty-input',
      'union-all([])',
      'err(empty-input)',
    ],
    [
      'union-schema-mismatch',
      'union-all([' + unionRight + ', {rows: 1, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: false}], columns: [int64-column([some(4)]), utf8-column([some("d")])]}])',
      'err(schema-mismatch)',
    ],
    [
      'union-invalid-batch',
      'union-all([{rows: 1, fields: [{name: "id", data-type: int64, nullable: false}], columns: [int64-column([])]}])',
      'err(invalid-batch)',
    ],
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
    operations: ['union-all','equi-join','group-aggregate'],
    union_semantics: 'stable-input-order; exact-schema; no-coercion',
    join_semantics: 'bounded; typed; stable-left-then-right-order; null-keys-never-match',
    aggregates: ['count-all','count','sum','min','max','mean'],
    cases: receipts.length,
    receipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
