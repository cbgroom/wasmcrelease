import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CoreCaller, string, list, u8, u64, i64, f64, bool, record, result, enumeration } from '../../../../scripts/current-core-value-codec-v3.mjs';

const [root, expected] = process.argv.slice(2);
assert.ok(root && /^[a-f0-9]{64}$/.test(expected ?? ''));
const artifact = readFileSync(`${root}/artifact.wasm`);
const abi = JSON.parse(readFileSync(`${root}/core-abi.json`));
assert.equal(createHash('sha256').update(artifact).digest('hex'), expected);
assert.equal(abi.artifact_sha256, expected);
const c = new CoreCaller(new WebAssembly.Module(artifact), abi);
const errors = ['invalid-json', 'invalid-pointer', 'missing-target', 'type-mismatch', 'invalid-index', 'out-of-range', 'invalid-operation', 'allocation-failed'];
const bytes = s => Array.from(Buffer.from(s));
const edit = record({kind: enumeration(['set', 'remove']), path: string, 'value-json': string});
const definitions = [
  ['read-u64', u64, '0', 0n], ['read-u64', u64, '18446744073709551615', 18446744073709551615n],
  ['read-i64', i64, '-9223372036854775808', -9223372036854775808n], ['read-i64', i64, '9223372036854775807', 9223372036854775807n],
  ['read-f64', f64, '1.5', 1.5], ['read-bool', bool, 'true', true], ['read-bool', bool, 'false', false],
];
for (const [name, type, value, expectedValue] of definitions) {
  const answer = c.call(name, [list(u8), string], [bytes(`{"x":${value}}`), '/x'], result(record({present: bool, value: type}), errors));
  assert.deepEqual(answer, {tag: 'ok', value: {present: true, value: expectedValue}}, `${name}: ${value}`);
}
for (const [name, type, fallback] of [['read-u64', u64, 0n], ['read-i64', i64, 0n], ['read-f64', f64, 0], ['read-bool', bool, false]]) {
  const output = result(record({present: bool, value: type}), errors);
  assert.deepEqual(c.call(name, [list(u8), string], [bytes('{}'), '/x'], output), {tag: 'ok', value: {present: false, value: fallback}}, `${name}: missing`);
  assert.deepEqual(c.call(name, [list(u8), string], [bytes('{"x":null}'), '/x'], output), {tag: 'err', value: 'type-mismatch'}, `${name}: null`);
  assert.deepEqual(c.call(name, [list(u8), string], [bytes('{"x":"wrong"}'), '/x'], output), {tag: 'err', value: 'type-mismatch'}, `${name}: wrong type`);
  assert.deepEqual(c.call(name, [list(u8), string], [bytes('{'), '/x'], output), {tag: 'err', value: 'invalid-json'}, `${name}: malformed JSON`);
}
const input = bytes('{"value":1}');
const failed = c.call('edit-bytes', [list(u8), list(edit)], [input, [
  {kind: 'set', path: '/value', 'value-json': '2'},
  {kind: 'set', path: '/absent/child', 'value-json': '3'},
]], result(list(u8), errors));
assert.deepEqual(failed, {tag: 'err', value: 'missing-target'});
const recovered = c.call('edit-bytes', [list(u8), list(edit)], [input, [
  {kind: 'set', path: '/value', 'value-json': '4'},
]], result(list(u8), errors));
assert.equal(recovered.tag, 'ok');
assert.deepEqual(JSON.parse(Buffer.from(recovered.value).toString()), {value: 4});
console.log(JSON.stringify({result: 'PASS', artifact_sha256: expected, extrema_and_types: definitions.length, missing_null_wrong_type_and_invalid_json: 16, failed_batch_returns_error_and_same_instance_recovery: true}));
