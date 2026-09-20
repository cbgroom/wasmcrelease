import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

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

const libs = {
  data: {
    manifest: 'libsrc/wasmc-data-core/Cargo.toml',
    artifact: 'libsrc/wasmc-data-core/target/wasm32-unknown-unknown/release/wasmc_data_core_public.wasm',
  },
  csv: {
    manifest: 'libsrc/wasmc-csv/Cargo.toml',
    artifact: 'libsrc/wasmc-csv/target/wasm32-unknown-unknown/release/wasmc_csv_public.wasm',
  },
  expr: {
    manifest: 'libsrc/wasmc-data-expr/Cargo.toml',
    artifact: 'libsrc/wasmc-data-expr/target/wasm32-unknown-unknown/release/wasmc_data_expr_public.wasm',
  },
  compute: {
    manifest: 'libsrc/wasmc-data-compute/Cargo.toml',
    artifact: 'libsrc/wasmc-data-compute/target/wasm32-unknown-unknown/release/wasmc_data_compute_public.wasm',
  },
  relational: {
    manifest: 'libsrc/wasmc-data-relational/Cargo.toml',
    artifact: 'libsrc/wasmc-data-relational/target/wasm32-unknown-unknown/release/wasmc_data_relational_public.wasm',
  },
  profile: {
    manifest: 'libsrc/wasmc-data-profile/Cargo.toml',
    artifact: 'libsrc/wasmc-data-profile/target/wasm32-unknown-unknown/release/wasmc_data_profile_public.wasm',
  },
};

for (const lib of Object.values(libs)) {
  run('cargo', [
    '+1.96.0', 'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
    '--manifest-path', lib.manifest,
  ]);
  const bytes = await readFile(resolve(root, lib.artifact));
  assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(bytes)), []);
}

const work = await mkdtemp(join(tmpdir(), 'wasmc-data-pipeline-'));
try {
  for (const [name, lib] of Object.entries(libs)) {
    lib.component = join(work, name + '.component.wasm');
    run('wasm-tools', ['component', 'new', resolve(root, lib.artifact), '-o', lib.component]);
  }

  const input = [...new TextEncoder().encode('id,name\n1,A\n2,B\n3,C\n')].join(',');
  const fields = '[{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: false}]';
  const csv = run('wasmtime', [
    'run', '--invoke',
    'parse([' + input + '], ' + fields + ', {has-header: true, validate-header: true, delimiter: 44, batch-rows: 16})',
    libs.csv.component,
  ]);
  assert.match(csv, /^ok\(\[\{rows: 3,/);
  assert.ok(csv.startsWith('ok([') && csv.endsWith('])'));
  const batch = csv.slice(4, -2);

  const expression = '{nodes: [column(0), literal(int64(1)), greater({left: 0, right: 1})], root: 2}';
  const expr = run('wasmtime', [
    'run', '--invoke',
    'evaluate(' + batch + ', ' + expression + ')',
    libs.expr.component,
  ]);
  assert.equal(expr, 'ok(boolean-column([some(false), some(true), some(true)]))');
  const mask = expr.slice(3, -1);

  const filtered = run('wasmtime', [
    'run', '--invoke',
    'filter(' + batch + ', ' + mask + ')',
    libs.compute.component,
  ]);
  const expected = 'ok({rows: 2, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: false}], columns: [int64-column([some(2), some(3)]), utf8-column([some("B"), some("C")])]})';
  assert.equal(filtered, expected);
  const filteredBatch = filtered.slice(3, -1);

  const unioned = run('wasmtime', [
    'run', '--invoke',
    'union-all([' + filteredBatch + ', {rows: 0, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: false}], columns: [int64-column([]), utf8-column([])]}])',
    libs.relational.component,
  ]);
  assert.equal(unioned, expected);
  const unionedBatch = unioned.slice(3, -1);

  const joined = run('wasmtime', [
    'run', '--invoke',
    'equi-join(' + unionedBatch + ', {rows: 2, fields: [{name: "id", data-type: int64, nullable: false}, {name: "score", data-type: int64, nullable: false}], columns: [int64-column([some(2), some(3)]), int64-column([some(20), some(30)])]}, [{left-column: 0, right-column: 0}], {kind: inner, right-prefix: "lookup_", max-output-rows: 4})',
    libs.relational.component,
  ]);
  const expectedJoin = 'ok({rows: 2, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: false}, {name: "lookup_id", data-type: int64, nullable: false}, {name: "lookup_score", data-type: int64, nullable: false}], columns: [int64-column([some(2), some(3)]), utf8-column([some("B"), some("C")]), int64-column([some(2), some(3)]), int64-column([some(20), some(30)])]})';
  assert.equal(joined, expectedJoin);
  const joinedBatch = joined.slice(3, -1);

  const profiled = run('wasmtime', [
    'run', '--invoke',
    'describe(' + joinedBatch + ', [0, 3])',
    libs.profile.component,
  ]);
  const expectedProfile = 'ok([{column: 0, name: "id", data-type: int64, summary: int64({non-null: 2, nulls: 0, min: some(2), max: some(3), mean: some(2.5)})}, {column: 3, name: "lookup_score", data-type: int64, summary: int64({non-null: 2, nulls: 0, min: some(20), max: some(30), mean: some(25)})}])';
  assert.equal(profiled, expectedProfile);

  const validated = run('wasmtime', [
    'run', '--invoke',
    'validate(' + joinedBatch + ')',
    libs.data.component,
  ]);
  assert.equal(validated, 'ok(2)');

  const aggregated = run('wasmtime', [
    'run', '--invoke',
    'group-aggregate(' + joinedBatch + ', [], [count-all("rows"), sum({column: 0, alias: "sum_id"}), mean({column: 0, alias: "mean_id"})])',
    libs.relational.component,
  ]);
  const expectedAggregate = 'ok({rows: 1, fields: [{name: "rows", data-type: uint64, nullable: false}, {name: "sum_id", data-type: int64, nullable: true}, {name: "mean_id", data-type: float64, nullable: true}], columns: [uint64-column([some(2)]), int64-column([some(5)]), float64-column([some(2.5)])]})';
  assert.equal(aggregated, expectedAggregate);
  const aggregateBatch = aggregated.slice(3, -1);
  const aggregateValidated = run('wasmtime', [
    'run', '--invoke',
    'validate(' + aggregateBatch + ')',
    libs.data.component,
  ]);
  assert.equal(aggregateValidated, 'ok(1)');

  console.log(JSON.stringify({
    accepted: true,
    schema: 'wasmc.data-pipeline/v1',
    path: ['csv','data-core/types','data-expr','data-compute','data-relational/union-all','data-relational/equi-join','data-profile','data-relational/group-aggregate','data-core/validate'],
    input_rows: 3,
    predicate: 'id > 1',
    output_rows: 2,
    output_ids: [2, 3],
    profile_columns: 2,
    union_inputs: 2,
    join_kind: 'inner',
    join_max_output_rows: 4,
    aggregate_rows: 1,
    aggregate: { count: 2, sum_id: 5, mean_id: 2.5 },
    core_imports: 0,
    validated,
    aggregate_validated: aggregateValidated,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
