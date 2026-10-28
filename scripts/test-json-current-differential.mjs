import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {CoreCaller, string, list, option, u8, u64, bool, record, result, enumeration} from './current-core-value-codec-v3.mjs';

const [root, expected] = process.argv.slice(2);
assert.ok(root && /^[a-f0-9]{64}$/.test(expected ?? ''));
const artifact = readFileSync(`${root}/artifact.wasm`), abi = JSON.parse(readFileSync(`${root}/core-abi.json`));
assert.equal(createHash('sha256').update(artifact).digest('hex'), expected);
assert.equal(abi.artifact_sha256, expected);
const c = new CoreCaller(new WebAssembly.Module(artifact), abi);
const errors = ['invalid-json', 'invalid-pointer', 'missing-target', 'type-mismatch', 'invalid-index', 'out-of-range', 'invalid-operation', 'allocation-failed'];
const field = record({name: string, 'value-json': string});
const edit = record({kind: enumeration(['set', 'remove']), path: string, 'value-json': string});
const bytes = text => Array.from(Buffer.from(text));
const decode = value => Buffer.from(value).toString('utf8');
const encodePointer = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
let seed = 0x9e3779b9;
const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
const keys = ['a/b', '~', '', '雪', 'x~1/y', 'with space'];
for (let i = 0; i < 300; i++) {
  const key = keys[i % keys.length], n = random() % 1000000, m = random() % 1000000;
  const input = {[key]: {amount: n, items: [n, m], flag: (i & 1) === 0}, keep: '🦀'};
  const inputText = JSON.stringify(input), base = `/${encodePointer(key)}`;
  const values = ['null', JSON.stringify(key), String(n), JSON.stringify([n, m])];
  const array = c.call('array-from-values', [list(string)], [values], result(string, errors));
  assert.equal(array.tag, 'ok'); assert.deepEqual(JSON.parse(array.value), values.map(JSON.parse));
  const obj = c.call('object-from-fields', [list(field)], [[{name: key, 'value-json': String(n)},
    {name: 'keep', 'value-json': JSON.stringify('🦀')}]], result(string, errors));
  assert.equal(obj.tag, 'ok'); assert.deepEqual(JSON.parse(obj.value), {[key]: n, keep: '🦀'});
  const edits = [{kind: 'set', path: `${base}/amount`, 'value-json': String(m)},
    {kind: 'set', path: `${base}/items/-`, 'value-json': String(n + m)},
    {kind: 'remove', path: `${base}/items/0`, 'value-json': ''}];
  const edited = c.call('edit-bytes', [list(u8), list(edit)], [bytes(inputText), edits], result(list(u8), errors));
  assert.equal(edited.tag, 'ok');
  const expectedObject = structuredClone(input);
  expectedObject[key].amount = m; expectedObject[key].items.push(n + m); expectedObject[key].items.shift();
  const outputText = decode(edited.value);
  assert.deepEqual(JSON.parse(outputText), expectedObject);
  const selected = c.call('select-bytes', [list(u8), list(string)], [bytes(outputText),
    [`${base}/amount`, `${base}/items/0`, '/missing']], result(list(option(string)), errors));
  assert.equal(selected.tag, 'ok');
  assert.deepEqual(selected.value.map(x => x === null ? null : JSON.parse(x)), [m, m, null]);
  const typed = c.call('read-u64', [list(u8), string], [bytes(outputText), `${base}/amount`],
    result(record({present: bool, value: u64}), errors));
  assert.deepEqual(typed, {tag: 'ok', value: {present: true, value: BigInt(m)}});
}
const invalid = c.call('edit-bytes', [list(u8), list(edit)], [bytes('{"x":1}'),
  [{kind: 'set', path: '/bad~2', 'value-json': '2'}]], result(list(u8), errors));
assert.deepEqual(invalid, {tag: 'err', value: 'invalid-pointer'});
const after = c.call('read-u64', [list(u8), string], [bytes('{"x":7}'), '/x'],
  result(record({present: bool, value: u64}), errors));
assert.deepEqual(after, {tag: 'ok', value: {present: true, value: 7n}});
console.log(JSON.stringify({result: 'PASS', artifact_sha256: expected, cases: 300,
  operations_per_case: 5, deterministic_seed: '9e3779b9', same_instance: true,
  escaped_pointers: true, invalid_pointer_and_recovery: true, oracle: 'independent JavaScript values and sequential edits'}));
