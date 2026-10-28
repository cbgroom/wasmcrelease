import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CoreCaller, string, list, u8, u64, bool, record, result, enumeration } from '../../../../scripts/current-core-value-codec-v3.mjs';

const [artifactPath, watPath, expectedSha = 'dc9a46d2de97f5a3ec13b5e338d1b40ea5bbf7f533b7788d2189e3300c8657ca'] = process.argv.slice(2);
assert(artifactPath && watPath, 'usage: test-json021-edition2024-core.mjs ARTIFACT WAT');
const artifact = fs.readFileSync(artifactPath), wat = fs.readFileSync(watPath, 'utf8');
assert.equal(createHash('sha256').update(artifact).digest('hex'), expectedSha);
const functions = new Map();
for (const line of wat.split('\n')) {
  const m = line.match(/^  \(func (\S+) .*\(type \d+\)(.*)$/); if (!m) continue;
  const lanes = kind => (m[2].match(new RegExp('\\(' + kind + ' ([^)]*)\\)'))?.[1] ?? '').split(' ').filter(Boolean);
  functions.set(m[1].startsWith('(;') ? m[1].slice(2, -2) : m[1], { params: lanes('param'), results: lanes('result') });
}
const exports = [];
for (const m of wat.matchAll(/^  \(export "([^"]+)" \(func (\S+)\)\)$/gm)) {
  const f = functions.get(m[2]); assert(f); exports.push({ kind: 'function', name: m[1], ...f });
}
const c = new CoreCaller(new WebAssembly.Module(artifact), { exports });
const errors = ['invalid-json', 'invalid-pointer', 'missing-target', 'type-mismatch', 'invalid-index', 'out-of-range', 'invalid-operation', 'allocation-failed'];
const field = record({name: string, 'value-json': string});
const edit = record({kind: enumeration(['set', 'remove']), path: string, 'value-json': string});
const bytes = text => Array.from(Buffer.from(text));
const array = c.call('array-from-values', [list(string)], [['1', '"雪"', 'true']], result(string, errors));
assert.deepEqual(array, {tag:'ok', value:'[1,"雪",true]'});
const obj = c.call('object-from-fields', [list(field)], [[{name:'a','value-json':'1'}, {name:'b','value-json':array.value}]], result(string, errors));
assert.deepEqual(obj, {tag:'ok', value:'{"a":1,"b":[1,"雪",true]}'});
const edited = c.call('edit-bytes', [list(u8), list(edit)], [bytes(obj.value), [{kind:'set',path:'/a','value-json':'18446744073709551615'},{kind:'remove',path:'/b/0','value-json':''}]], result(list(u8), errors));
assert.equal(edited.tag, 'ok');
const json = Buffer.from(edited.value).toString();
assert.equal(json, '{"a":18446744073709551615,"b":["雪",true]}');
assert.deepEqual(c.call('read-u64', [list(u8),string], [bytes(json),'/a'], result(record({present:bool,value:u64}), errors)), {tag:'ok',value:{present:true,value:18446744073709551615n}});
assert.equal(c.call('array-from-values-or', [list(string),string], [['bad'],'fallback'], string), 'fallback');
assert.deepEqual(c.call('array-from-values', [list(string)], [['true']], result(string, errors)), {tag:'ok',value:'[true]'});
console.log(JSON.stringify({accepted:true,engine:globalThis.Deno?'deno':globalThis.Bun?'bun':'node',artifact_sha256:createHash('sha256').update(artifact).digest('hex'),checks:['construction','ordered-edits','u64-max','invalid-fallback','same-instance-recovery'],scope:'selected exact Core artifact; installation and release require separate evidence'}));
