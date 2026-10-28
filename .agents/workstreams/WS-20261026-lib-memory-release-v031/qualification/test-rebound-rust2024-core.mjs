import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {CoreCaller, bool, enumeration, f64, i64, u64, u8, u32, list, option, record, result, string, variant} from '../../../../scripts/current-core-value-codec-v3.mjs';

const [interchange, interchangeSha, interchangeWat, relational, relationalSha, relationalWat] = process.argv.slice(2);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function load(path, expected, watPath) {
  const data = readFileSync(path); assert.equal(sha(data), expected);
  const wat = readFileSync(watPath, 'utf8'), functions = new Map(), exports = [];
  for (const line of wat.split('\n')) {
    const m = line.match(/^  \(func (\S+) .*\(type \d+\)(.*)$/); if (!m) continue;
    const lanes = kind => (m[2].match(new RegExp('\\(' + kind + ' ([^)]*)\\)'))?.[1] ?? '').split(' ').filter(Boolean);
    functions.set(m[1].startsWith('(;') ? m[1].slice(2, -2) : m[1], {params: lanes('param'), results: lanes('result')});
  }
  for (const m of wat.matchAll(/^  \(export "([^"]+)" \(func (\S+)\)\)$/gm)) {
    const f = functions.get(m[2]); assert.ok(f); exports.push({kind: 'function', name: m[1], ...f});
  }
  return new CoreCaller(new WebAssembly.Module(data), {exports});
}
const a = load(interchange, interchangeSha, interchangeWat), b = load(relational, relationalSha, relationalWat);
const dtype = enumeration(['boolean', 'int64', 'uint64', 'float64', 'utf8', 'binary']);
const field = record({name: string, data_type: dtype, nullable: bool});
const column = variant(Object.fromEntries([['boolean', bool], ['int64', i64], ['uint64', u64],
  ['float64', f64], ['utf8', string], ['binary', list(u8)]].map(([name, type]) => [name, list(option(type))])));
const batch = record({rows: u32, fields: list(field), columns: list(column)});
const source = {rows: 2, fields: [{name: 'n', data_type: 'int64', nullable: false}],
  columns: [{tag: 'int64', value: [1n, 2n]}]};
const interchangeErrors = ['invalid-options', 'invalid-batch', 'empty-input', 'schema-mismatch', 'unsupported-type',
  'input-limit-exceeded', 'batch-limit-exceeded', 'row-limit-exceeded', 'output-limit-exceeded', 'invalid-data', 'encode-failure', 'overflow'];
const relationalErrors = ['invalid-batch', 'empty-input', 'empty-keys', 'empty-order', 'empty-functions', 'schema-mismatch',
  'key-type-mismatch', 'column-out-of-bounds', 'duplicate-key', 'duplicate-function', 'empty-alias', 'duplicate-output-name',
  'invalid-limit', 'row-limit-exceeded', 'output-limit-exceeded', 'unsupported-type', 'unsupported-function', 'invalid-frame', 'overflow', 'compute-failure'];
for (let i = 0; i < 16; i++) {
  for (const format of ['ipc-file', 'parquet']) {
    const encoded = a.call(`${format}-encode`, [list(batch)], [[source]], result(list(u8), interchangeErrors));
    assert.equal(encoded.tag, 'ok'); assert.ok(encoded.value.length);
    const decoded = a.call(`${format}-decode`, [list(u8), record({batch_rows: u32})], [encoded.value, {batch_rows: 4}], result(list(batch), interchangeErrors));
    assert.deepEqual(decoded, {tag: 'ok', value: [source]});
  }
  assert.deepEqual(a.call('ipc-file-decode', [list(u8), record({batch_rows: u32})], [[], {batch_rows: 4}], result(list(batch), interchangeErrors)),
    {tag: 'err', value: 'empty-input'});
  const combined = b.call('union-all', [list(batch)], [[source, source]], result(batch, relationalErrors));
  assert.deepEqual(combined, {tag: 'ok', value: {...source, rows: 4, columns: [{tag: 'int64', value: [1n, 2n, 1n, 2n]}]}});
}
console.log(JSON.stringify({accepted: true, artifacts: {interchange: interchangeSha, relational: relationalSha},
  rounds: 16, same_instances: true, checks: ['IPC roundtrip', 'Parquet roundtrip', 'empty input', 'union', 'recovery'], formal_release: false}));
