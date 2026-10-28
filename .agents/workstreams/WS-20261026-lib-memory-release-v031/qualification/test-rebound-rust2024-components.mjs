import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const [interchange, interchangeSha, relational, relationalSha] = process.argv.slice(2);
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
assert.equal(sha(interchange), interchangeSha); assert.equal(sha(relational), relationalSha);
const invoke = (path, text) => {
  const result = spawnSync('wasmtime', ['run', '--invoke', text, path], {encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const batch = '{rows: 2, fields: [{name: "n", data-type: int64, nullable: false}], columns: [int64-column([some(1), some(2)])]}';
const expected = `ok([${batch}])`;
const checks = [];
for (const prefix of ['ipc-file', 'parquet']) {
  const encoded = invoke(interchange, `${prefix}-encode([${batch}])`);
  assert.ok(encoded.startsWith('ok([') && encoded.endsWith('])'), `${prefix} encode`);
  const decoded = invoke(interchange, `${prefix}-decode(${encoded.slice(3, -1)}, {batch-rows: 4})`);
  assert.equal(decoded, expected, `${prefix} independent Component roundtrip`);
  checks.push(`${prefix} encode/decode`);
}
assert.equal(invoke(interchange, 'ipc-file-decode([], {batch-rows: 4})'), 'err(empty-input)');
const union = invoke(relational, `union-all([${batch}, ${batch}])`);
assert.equal(union, 'ok({rows: 4, fields: [{name: "n", data-type: int64, nullable: false}], columns: [int64-column([some(1), some(2), some(1), some(2)])]})');
const join = invoke(relational, `equi-join(${batch}, ${batch}, [{left-column: 0, right-column: 0}], {kind: inner, right-prefix: "r_"})`);
assert.equal(join, 'ok({rows: 2, fields: [{name: "n", data-type: int64, nullable: false}, {name: "r_n", data-type: int64, nullable: false}], columns: [int64-column([some(1), some(2)]), int64-column([some(1), some(2)])]})');
checks.push('empty IPC rejection', 'union-all', 'equi-join');
console.log(JSON.stringify({accepted: true, components: {interchange: interchangeSha, relational: relationalSha},
  checks, runner: 'wasmtime CLI, fresh process per invocation', installed_product: false, formal_release: false}));
