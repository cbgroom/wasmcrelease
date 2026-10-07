import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { generatedLib, selectedRun } from './generated-lib-v2.mjs';
import { atomicJson, sha } from './lib-refresh-cache-v2.mjs';
import { CoreCaller, bool, u32, list, option, record, result, string } from './lib-refresh-test-abi-v2.mjs';

const argv = process.argv.slice(2), run = selectedRun(argv), position = argv.indexOf('--index');
assert.ok(position >= 0 && argv[position + 1], 'required --index <exact generated index>');
const text = await readFile(resolve(argv[position + 1]), 'utf8'), index = JSON.parse(text);
const subject = await generatedLib('wasmc-lib-search', run);
const module = new WebAssembly.Module(await readFile(subject.artifact));
assert.deepEqual(WebAssembly.Module.imports(module), []);
const abi = JSON.parse(await readFile(join(subject.root, 'core-abi.json')));
const errors = ['invalid-index', 'index-too-large', 'invalid-query', 'invalid-limit'];
const binding = record({ manifest_sha256: string, receipt_sha256: string, artifact_kind: string,
  artifact_path: option(string), artifact_sha256: option(string), component_sha256: option(string) });
const hit = record({ identity: string, package_id: string, version: string, profile: string, target: string,
  kind: string, wit_route: string, source_path: string, wit_sha256: string, description: string, delivery: option(binding) });
const summary = record({ entry_count: u32, package_count: u32, api_count: u32, bound_package_count: u32,
  registry_sha256: string, index_sha256: string });
const query = record({ text: string, package_id: option(string), profile: option(string), bound_only: bool });
const q = (text = '', values = {}) => ({ text, package_id: null, profile: null, bound_only: false, ...values });
const ok = value => ({ tag: 'ok', value }), err = value => ({ tag: 'err', value });
const caller = new CoreCaller(module, abi);
const snapshot = value => caller.call('snapshot', [string], [value], result(summary, errors));
const search = (request = q(), offset = 0, limit = 64, value = text) =>
  caller.call('search', [string, query, u32, u32], [value, request, offset, limit], result(list(hit), errors));
const lookup = (id, value = text) => caller.call('lookup', [string, string], [value, id], result(option(hit), errors));
const cases = []; let failed = false;
function check(name, fn) {
  try { fn(); cases.push({ name, pass: true }); }
  catch (e) { failed = true; cases.push({ name, pass: false, error: e.stack }); }
}
const packages = index.entries.filter(e => e.kind === 'package');
check('complete-current-registry-snapshot', () => assert.deepEqual(snapshot(text), ok({
  entry_count: index.entries.length, package_count: packages.length,
  api_count: index.entries.length - packages.length,
  bound_package_count: packages.filter(e => e.delivery).length,
  registry_sha256: index.registry_sha256, index_sha256: sha(Buffer.from(text)),
})));
check('all-exact-lookups', () => { for (const entry of index.entries) assert.deepEqual(lookup(entry.identity), ok(entry)); });
check('missing-lookup', () => assert.deepEqual(lookup('not-present@0.0.0'), ok(null)));
check('pagination-complete-stable-no-duplicates', () => {
  const actual = []; for (let offset = 0; offset < index.entries.length; offset += 17) {
    const page = search(q(), offset, 17); assert.equal(page.tag, 'ok'); actual.push(...page.value);
  } assert.deepEqual(actual, index.entries);
});
check('implementation-filter', () => assert.deepEqual(search(q('', {package_id:'wasmc-json'})), ok(index.entries.filter(e => e.package_id === 'wasmc-json'))));
check('native-profile-filter', () => assert.deepEqual(search(q('', {profile:'native'})), ok(index.entries.filter(e => e.profile === 'native').slice(0,64))));
check('bound-filter-never-promotes-source-only', () => assert.deepEqual(search(q('', {bound_only:true})), ok(index.entries.filter(e => e.delivery).slice(0,64))));
check('shared-WIT-platforms-not-collapsed', () => {
  const rows = index.entries.filter(e => e.kind === 'package' && e.wit_route === 'wasmc:system-display@0.0.1');
  assert.equal(rows.length, 2); assert.notEqual(rows[0].package_id, rows[1].package_id);
  assert.deepEqual(new Set(rows.map(e => e.target)), new Set(['android','ios']));
});
check('AND-case-insensitive-terms', () => assert.deepEqual(search(q('JSON COMPACT')), ok(index.entries.filter(e =>
  [e.identity,e.wit_route,e.description,e.profile,e.target].join(' ').toLowerCase().includes('json') &&
  [e.identity,e.wit_route,e.description,e.profile,e.target].join(' ').toLowerCase().includes('compact')).slice(0,64))));
check('unicode-input', () => { const fixture = structuredClone(index);fixture.entries[0].description = '你好🌍';
  assert.deepEqual(search(q('你好🌍'),0,1,JSON.stringify(fixture)),ok([fixture.entries[0]])); });
check('large-offset', () => assert.deepEqual(search(q(),0xffffffff),ok([])));
check('zero-limit', () => assert.deepEqual(search(q(),0,0),err('invalid-limit')));
check('large-limit', () => assert.deepEqual(search(q(),0,65),err('invalid-limit')));
check('invalid-query-control', () => assert.deepEqual(search(q('\0')),err('invalid-query')));
check('invalid-profile', () => assert.deepEqual(search(q('',{profile:'fake'})),err('invalid-query')));
check('long-query', () => assert.deepEqual(search(q('x'.repeat(513))),err('invalid-query')));
check('too-many-tokens', () => assert.deepEqual(search(q('a '.repeat(17))),err('invalid-query')));
check('invalid-JSON', () => assert.deepEqual(snapshot('no'),err('invalid-index')));
check('oversized-index', () => assert.deepEqual(snapshot(' '.repeat(2*1024*1024+1)),err('index-too-large')));
check('wrong-schema', () => assert.deepEqual(snapshot(JSON.stringify({...index,schema:'LSI1'})),err('invalid-index')));
check('duplicate-identity', () => assert.deepEqual(snapshot(JSON.stringify({...index,entries:[index.entries[0],index.entries[0]]})),err('invalid-index')));
check('API-without-parent', () => assert.deepEqual(snapshot(JSON.stringify({...index,entries:[index.entries.find(e=>e.kind==='api')]})),err('invalid-index')));
check('wrong-source-path', () => {const f=structuredClone(index);f.entries[0].source_path='../secret';assert.deepEqual(snapshot(JSON.stringify(f)),err('invalid-index'));});
check('undeclared-extra-field', () => assert.deepEqual(snapshot(JSON.stringify({...index,admitted:true})),err('invalid-index')));
check('persistent-direct-Lib-error-recovery', () => {
  for(let i=0;i<16;i++){assert.equal(snapshot('bad').tag,'err');assert.equal(snapshot(text).tag,'ok');}
  const bytes = caller.exports.memory.buffer.byteLength;
  for(let i=0;i<32;i++){assert.deepEqual(lookup('absent@0.0.0'),ok(null));assert.equal(snapshot(text).tag,'ok');}
  assert.equal(caller.exports.memory.buffer.byteLength,bytes);
});
const attempt = await mkdtemp(join(run,'current-search-q1-'));
const report = { schema:'wasmc.current-lib-search-q1/v1', accepted:!failed,
  manifest_sha256:subject.row.manifest_sha256,artifact_sha256:subject.row.artifact_sha256,
  index_sha256:sha(Buffer.from(text)), package_count:packages.length,api_count:index.entries.length-packages.length,
  entries:index.entries.length,cases,scope:'Generated Core artifact; direct persistent Lib instance, not persistent WAsmC App Store',public_admission:false };
await atomicJson(join(attempt,'receipt.json'),report);
console.log(JSON.stringify({...report,attempt}));if(failed)process.exitCode=1;
