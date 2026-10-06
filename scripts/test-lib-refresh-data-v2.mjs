#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { atomicJson, sha, verifyRoot } from './lib-refresh-cache-v2.mjs';
import { CoreCaller, bool, enumeration, f64, i64, u64, u8, u32, list, option, record, result, string, variant } from './lib-refresh-test-abi-v2.mjs';

assert.equal(process.argv[2], '--run-root');
const runRoot = resolve(process.argv[3]);
const receipt = JSON.parse(await readFile(join(runRoot, 'refresh-receipt.json')));
assert.equal(receipt.accepted, true);
const packages = new Map(receipt.rows.map(r => [r.id, r]));
const subjects = new Map(), cases = [], failures = [];
const dtype = enumeration(['boolean', 'int64', 'uint64', 'float64', 'utf8', 'binary']);
const field = record({ name: string, data_type: dtype, nullable: bool });
const column = variant(Object.fromEntries([['boolean', bool], ['int64', i64], ['uint64', u64], ['float64', f64], ['utf8', string], ['binary', list(u8)]].map(([name, t]) => [name, list(option(t))])));
const batch = record({ rows: u32, fields: list(field), columns: list(column) });
const C = (tag, value) => ({ tag, value });
const ok = value => C('ok', value), err = value => C('err', value);
const F = (name, data_type = 'int64', nullable = false) => ({ name, data_type, nullable });
const base = { rows: 3, fields: [F('id'), F('value')], columns: [C('int64', [2n, 1n, 2n]), C('int64', [10n, 20n, 30n])] };
const clone = value => structuredClone(value);

async function load(id) {
  if (subjects.has(id)) return subjects.get(id);
  const row = packages.get(id); assert.ok(row, 'receipt missing Data/CSV subject ' + id);
  const verified = await verifyRoot(row.package_root, id, row.version);
  assert.equal(verified.manifest_sha256, row.manifest_sha256, 'Q0 receipt identity mismatch');
  const bytes = await readFile(join(row.package_root, 'artifact.wasm'));
  assert.equal(sha(bytes), row.artifact_sha256);
  const module = new WebAssembly.Module(bytes);
  const abi = JSON.parse(await readFile(join(row.package_root, 'core-abi.json')));
  const subject = { module, abi, row, covered: new Set() }; subjects.set(id, subject); return subject;
}
async function invoke(id, api, types, values, returns) {
  const subject = await load(id); subject.covered.add(api);
  return new CoreCaller(subject.module, subject.abi).call(api, types, values, returns);
}
async function check(id, name, fn) {
  try { await fn(); cases.push({ id, name, pass: true }); }
  catch (e) { cases.push({ id, name, pass: false, error: e.message }); failures.push({ id, name, message: e.stack }); }
}

const core = 'wasmc-data-core';
const coreErrors = ['column-count-mismatch', 'row-count-mismatch', 'type-mismatch', 'nullability-violation', 'empty-field-name', 'duplicate-field-name', 'index-out-of-bounds', 'invalid-layout'];
const validate = value => invoke(core, 'validate', [batch], [value], result(u32, coreErrors));
const take = (value, indices) => invoke(core, 'take', [batch, list(u32)], [value, indices], result(batch, coreErrors));
await check(core, 'validate-nonempty', async () => assert.deepEqual(await validate(base), ok(3)));
await check(core, 'take-order', async () => assert.deepEqual(await take(base, [2, 0]), ok({ ...base, rows: 2, columns: [C('int64', [2n, 2n]), C('int64', [30n, 10n])] })));
await check(core, 'six-types-null-and-extremes', async () => assert.deepEqual(await validate({ rows: 3,
  fields: ['boolean', 'int64', 'uint64', 'float64', 'utf8', 'binary'].map(t => F(t, t, true)),
  columns: [C('boolean', [true, null, false]), C('int64', [-(1n << 63n), null, (1n << 63n) - 1n]),
    C('uint64', [(1n << 64n) - 1n, null, 0n]), C('float64', [1.25, null, -2.5]), C('utf8', ['中', null, '']), C('binary', [[0, 255], null, []])] }), ok(3)));
await check(core, 'row-mismatch', async () => assert.deepEqual(await validate({ ...base, rows: 2 }), err('row-count-mismatch')));
await check(core, 'nullability', async () => { const b = clone(base); b.columns[0].value[0] = null; assert.deepEqual(await validate(b), err('nullability-violation')); });
await check(core, 'duplicate-field', async () => { const b = clone(base); b.fields[1].name = 'id'; assert.deepEqual(await validate(b), err('duplicate-field-name')); });
await check(core, 'index-bound', async () => assert.deepEqual(await take(base, [3]), err('index-out-of-bounds')));
await check(core, 'empty-field', async () => { const b = clone(base); b.fields[0].name = ''; assert.deepEqual(await validate(b), err('empty-field-name')); });
await check(core, 'column-count', async () => assert.deepEqual(await validate({ ...base, columns: [base.columns[0]] }), err('column-count-mismatch')));
await check(core, 'type-mismatch', async () => { const b = clone(base); b.fields[0].data_type = 'utf8'; assert.deepEqual(await validate(b), err('type-mismatch')); });
await check(core, 'zero-column-row-count', async () => {
  const b = { rows: 3, fields: [], columns: [] };
  assert.deepEqual(await validate(b), ok(3)); assert.deepEqual(await take(b, [2, 0]), ok({ ...b, rows: 2 }));
  assert.deepEqual(await take(b, []), ok({ ...b, rows: 0 }));
  assert.deepEqual(await take({ ...b, rows: 0 }, []), ok({ ...b, rows: 0 }));
});
await check(core, 'persistent-instance-error-recovery-and-cleanup', async () => {
  const subject = await load(core), caller = new CoreCaller(subject.module, subject.abi);
  const cycle = () => {
    assert.deepEqual(caller.call('validate', [batch], [{ ...base, rows: 2 }], result(u32, coreErrors)), err('row-count-mismatch'));
    assert.deepEqual(caller.call('validate', [batch], [base], result(u32, coreErrors)), ok(3));
    const taken = caller.call('take', [batch, list(u32)], [base, [2, 0]], result(batch, coreErrors));
    assert.equal(taken.tag, 'ok'); assert.equal(taken.value.rows, 2);
  };
  for (let i = 0; i < 16; i++) cycle();
  const before = caller.exports.memory.buffer.byteLength;
  for (let i = 0; i < 256; i++) cycle();
  assert.equal(caller.exports.memory.buffer.byteLength, before, 'memory grew after warmup');
});

const compute = 'wasmc-data-compute', computeErrors = ['invalid-batch', 'mask-type-mismatch', 'mask-length-mismatch', 'column-out-of-bounds', 'duplicate-column', 'empty-sort', 'compute-failure'];
const sortKey = record({ column: u32, descending: bool, nulls_first: bool });
await check(compute, 'filter-null-false', async () => {
  const actual = await invoke(compute, 'filter', [batch, column], [base, C('boolean', [true, null, false])], result(batch, computeErrors));
  assert.deepEqual(actual, ok({ ...base, rows: 1, columns: [C('int64', [2n]), C('int64', [10n])] }));
});
await check(compute, 'project', async () => assert.deepEqual(await invoke(compute, 'project', [batch, list(u32)], [base, [1]], result(batch, computeErrors)), ok({ ...base, fields: [base.fields[1]], columns: [base.columns[1]] })));
await check(compute, 'project-zero-columns', async () => assert.deepEqual(await invoke(compute, 'project', [batch, list(u32)], [base, []], result(batch, computeErrors)), ok({ rows: 3, fields: [], columns: [] })));
await check(compute, 'sort-limit', async () => {
  const a = await invoke(compute, 'sort', [batch, list(sortKey), option(u32)], [base, [{ column: 1, descending: true, nulls_first: false }], 2], result(batch, computeErrors));
  assert.deepEqual(a, ok({ ...base, rows: 2, columns: [C('int64', [2n, 1n]), C('int64', [30n, 20n])] }));
});
await check(compute, 'duplicate-projection', async () => assert.deepEqual(await invoke(compute, 'project', [batch, list(u32)], [base, [0, 0]], result(batch, computeErrors)), err('duplicate-column')));

const expr = 'wasmc-data-expr', exprErrors = ['empty-program', 'root-out-of-bounds', 'forward-reference', 'column-out-of-bounds', 'type-mismatch', 'unsupported-type', 'compute-failure', 'invalid-program'];
const unary = record({ input: u32 }), binary = record({ left: u32, right: u32 });
const literal = variant({ boolean: bool, int64: i64, uint64: u64, float64: f64, utf8: string, typed_null: dtype });
const node = variant({ column: u32, literal, equal: binary, not_equal: binary, less: binary, less_equal: binary, greater: binary,
  greater_equal: binary, add: binary, subtract: binary, multiply: binary, divide: binary, logical_and: binary, logical_or: binary, logical_not: unary, is_null: unary });
const program = record({ nodes: list(node), root: u32 });
const expression = { nodes: [C('column', 1), C('literal', C('int64', 5n)), C('add', { left: 0, right: 1 })], root: 2 };
await check(expr, 'validate-program', async () => assert.deepEqual(await invoke(expr, 'validate', [batch, program], [base, expression], result(dtype, exprErrors)), ok('int64')));
await check(expr, 'evaluate-program', async () => assert.deepEqual(await invoke(expr, 'evaluate', [batch, program], [base, expression], result(column, exprErrors)), ok(C('int64', [15n, 25n, 35n]))));
await check(expr, 'empty-program', async () => assert.deepEqual(await invoke(expr, 'validate', [batch, program], [base, { nodes: [], root: 0 }], result(dtype, exprErrors)), err('empty-program')));

const profile = 'wasmc-data-profile', profileErrors = ['invalid-batch', 'column-out-of-bounds', 'duplicate-column', 'overflow', 'compute-failure'];
const numericSummary = t => record({ non_null: u64, nulls: u64, min: option(t), max: option(t), mean: option(f64) });
const lengthSummary = record({ non_null: u64, nulls: u64, min_length: option(u32), max_length: option(u32), mean_length: option(f64) });
const summary = variant({ boolean: record({ non_null: u64, nulls: u64, true_count: u64, false_count: u64 }), int64: numericSummary(i64), uint64: numericSummary(u64), float64: numericSummary(f64), utf8: lengthSummary, binary: lengthSummary });
const columnProfile = record({ column: u32, name: string, data_type: dtype, summary });
await check(profile, 'describe-values', async () => {
  const a = await invoke(profile, 'describe', [batch, list(u32)], [base, [1]], result(list(columnProfile), profileErrors));
  assert.deepEqual(a, ok([{ column: 1, name: 'value', data_type: 'int64', summary: C('int64', { non_null: 3n, nulls: 0n, min: 10n, max: 30n, mean: 20 }) }]));
});
await check(profile, 'describe-duplicate', async () => assert.deepEqual(await invoke(profile, 'describe', [batch, list(u32)], [base, [1, 1]], result(list(columnProfile), profileErrors)), err('duplicate-column')));
await check(profile, 'describe-10000-integers', async () => {
  const values = Array.from({ length: 10000 }, (_, i) => BigInt(i));
  const input = { rows: 10000, fields: [F('x')], columns: [C('int64', values)] };
  const a = await invoke(profile, 'describe', [batch, list(u32)], [input, []], result(list(columnProfile), profileErrors));
  assert.deepEqual(a, ok([{ column: 0, name: 'x', data_type: 'int64', summary: C('int64', {
    non_null: 10000n, nulls: 0n, min: 0n, max: 9999n, mean: 4999.5,
  }) }]));
});

const interchange = 'wasmc-data-interchange';
const interchangeErrors = ['invalid-options', 'invalid-batch', 'empty-input', 'schema-mismatch', 'unsupported-type', 'input-limit-exceeded', 'batch-limit-exceeded', 'row-limit-exceeded', 'output-limit-exceeded', 'invalid-data', 'encode-failure', 'overflow'];
const encodeOptions = record({ max_batches: u32, max_rows: u32, max_output_bytes: u32 });
const decodeOptions = record({ max_input_bytes: u32, max_batches: u32, max_rows: u32, batch_rows: u32 });
const enc = { max_batches: 4, max_rows: 20, max_output_bytes: 1000000 }, dec = { max_input_bytes: 1000000, max_batches: 4, max_rows: 20, batch_rows: 10 };
for (const format of ['ipc-file', 'parquet']) {
  await check(interchange, format + '-roundtrip', async () => {
    const a = await invoke(interchange, format + '-encode', [list(batch), encodeOptions], [[base], enc], result(list(u8), interchangeErrors));
    assert.equal(a.tag, 'ok'); assert.ok(a.value.length > 0);
    assert.deepEqual(await invoke(interchange, format + '-decode', [list(u8), decodeOptions], [a.value, dec], result(list(batch), interchangeErrors)), ok([base]));
  });
  await check(interchange, format + '-invalid', async () => assert.deepEqual(await invoke(interchange, format + '-decode', [list(u8), decodeOptions], [[1, 2, 3], dec], result(list(batch), interchangeErrors)), err('invalid-data')));
}

const relational = 'wasmc-data-relational';
const relationalErrors = ['invalid-batch', 'empty-input', 'empty-keys', 'empty-order', 'empty-functions', 'schema-mismatch', 'key-type-mismatch', 'column-out-of-bounds', 'duplicate-key', 'duplicate-function', 'empty-alias', 'duplicate-output-name', 'invalid-limit', 'row-limit-exceeded', 'output-limit-exceeded', 'unsupported-type', 'unsupported-function', 'invalid-frame', 'overflow', 'compute-failure'];
const columnAggregate = record({ column: u32, alias: string });
const aggregate = variant({ count_all: string, count: columnAggregate, sum: columnAggregate, min: columnAggregate, max: columnAggregate, mean: columnAggregate, first: columnAggregate, last: columnAggregate, variance_pop: columnAggregate, stddev_pop: columnAggregate });
const order = record({ column: u32, descending: bool, nulls_first: bool });
const windowOptions = record({ max_rows: u32 }), options = { max_rows: 100 };
const orderValues = [{ column: 1, descending: false, nulls_first: false }];
const relationalResult = result(batch, relationalErrors);
await check(relational, 'group-sum', async () => {
  const a = await invoke(relational, 'group-aggregate', [batch, list(u32), list(aggregate)], [base, [0], [C('sum', { column: 1, alias: 'sum' })]], relationalResult);
  assert.equal(a.tag, 'ok'); assert.equal(a.value.rows, 2);
  const pairs = a.value.columns[0].value.map((key, i) => [key, a.value.columns[1].value[i]]).sort((a, b) => Number(a[0] - b[0]));
  assert.deepEqual(pairs, [[1n, 20n], [2n, 40n]]);
});
await check(relational, 'union', async () => {
  const a = await invoke(relational, 'union-all', [list(batch)], [[base, base]], relationalResult);
  assert.deepEqual(a, ok({ ...base, rows: 6, columns: base.columns.map(c => C(c.tag, [...c.value, ...c.value])) }));
});
await check(relational, 'join', async () => {
  const right = { rows: 1, fields: [F('id'), F('r')], columns: [C('int64', [2n]), C('int64', [99n])] };
  const key = record({ left_column: u32, right_column: u32 }), opts = record({ kind: enumeration(['inner', 'left']), right_prefix: string, max_output_rows: u32 });
  const a = await invoke(relational, 'equi-join', [batch, batch, list(key), opts], [base, right, [{ left_column: 0, right_column: 0 }], { kind: 'inner', right_prefix: 'r_', max_output_rows: 20 }], relationalResult);
  assert.equal(a.tag, 'ok'); assert.equal(a.value.rows, 2); assert.deepEqual(a.value.columns[1].value, [10n, 30n]);
});
await check(relational, 'distinct', async () => {
  const a = await invoke(relational, 'distinct', [batch, list(u32), windowOptions], [base, [0], options], relationalResult);
  assert.equal(a.tag, 'ok'); assert.equal(a.value.rows, 2); assert.equal(new Set(a.value.columns[0].value).size, 2);
});
await check(relational, 'window-rank', async () => {
  const functions = variant({ row_number: string, rank: string, dense_rank: string });
  const a = await invoke(relational, 'window-rank', [batch, list(u32), list(order), list(functions), windowOptions], [base, [0], orderValues, [C('row_number', 'rn')], options], relationalResult);
  assert.equal(a.tag, 'ok'); assert.deepEqual(a.value.columns.at(-1), C('uint64', [1n, 1n, 2n]));
});
await check(relational, 'window-offset', async () => {
  const offset = record({ column: u32, offset: u32, alias: string });
  const functions = variant({ lag: offset, lead: offset });
  const a = await invoke(relational, 'window-offset', [batch, list(u32), list(order), list(functions), windowOptions], [base, [0], orderValues, [C('lag', { column: 1, offset: 1, alias: 'prev' })], options], relationalResult);
  assert.equal(a.tag, 'ok'); assert.deepEqual(a.value.columns.at(-1), C('int64', [null, null, 10n]));
});
await check(relational, 'window-aggregate', async () => {
  const empty = record({});
  const frame = record({ start: variant({ unbounded: empty, preceding: u32, current_row: empty, following: u32 }), end: variant({ preceding: u32, current_row: empty, following: u32, unbounded: empty }) });
  const a = await invoke(relational, 'window-aggregate', [batch, list(u32), list(order), frame, list(aggregate), windowOptions],
    [base, [0], orderValues, { start: C('preceding', 1), end: C('current_row', {}) }, [C('sum', { column: 1, alias: 'sum' })], options], relationalResult);
  assert.equal(a.tag, 'ok'); assert.deepEqual(a.value.columns.at(-1), C('int64', [10n, 20n, 40n]));
});
await check(relational, 'union-empty', async () => assert.deepEqual(await invoke(relational, 'union-all', [list(batch)], [[]], relationalResult), err('empty-input')));

const csv = 'wasmc-csv', csvErrors = ['invalid-options', 'invalid-data', 'unsupported-type'];
const csvOptions = record({ has_header: bool, validate_header: bool, delimiter: u8, batch_rows: u32 });
const csvInput = [...new TextEncoder().encode('id,value\n2,10\n1,20\n2,30\n')];
const csvOpts = { has_header: true, validate_header: true, delimiter: 44, batch_rows: 10 };
await check(csv, 'parse-typed', async () => assert.deepEqual(await invoke(csv, 'parse', [list(u8), list(field), csvOptions], [csvInput, base.fields, csvOpts], result(list(batch), csvErrors)), ok([base])));
await check(csv, 'invalid-options', async () => assert.deepEqual(await invoke(csv, 'parse', [list(u8), list(field), csvOptions], [csvInput, base.fields, { ...csvOpts, batch_rows: 0 }], result(list(batch), csvErrors)), err('invalid-options')));

const coverage = [...subjects].map(([id, s]) => {
  const expected = s.abi.exports.filter(e => e.kind === 'function' && !e.name.startsWith('cabi_') && e.name.includes('#')).map(e => e.name.split('#')[1]).sort();
  assert.deepEqual([...s.covered].sort(), expected, id + ': uncovered public API');
  return { id, artifact_sha256: s.row.artifact_sha256, apis: expected };
});
assert.equal(coverage.length, 7);
assert.equal(coverage.reduce((n, r) => n + r.apis.length, 0), 20);
const output = { schema: 'wasmc.lib-refresh-data-q1/v2', accepted: failures.length === 0, fingerprint: receipt.fingerprint,
  engine: process.version + ' Node Core WebAssembly', public_apis_exercised: 20, packages: coverage,
  cases, failures, scope: 'Generated import-free Core artifact semantics; not ordinary WAsmC/Component/multi-engine Q2 or release admission' };
await atomicJson(join(runRoot, 'data-q1-receipt.json'), output);
console.log(JSON.stringify({ accepted: output.accepted, cases: cases.length, public_apis_exercised: 20, failures, run_root: runRoot }));
if (!output.accepted) process.exitCode = 1;
