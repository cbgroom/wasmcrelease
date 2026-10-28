// Prepare a separately named three-source candidate for the unmodified normal
// Lib refresh runner. The stage is not the current 43-package release.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, join, resolve} from 'node:path';

const [out, dataReceipt, reexportReceipt, receiptPin, reexportPin] = process.argv.slice(2);
assert.ok([out, dataReceipt, reexportReceipt].every(p => isAbsolute(p ?? '')));
assert.ok([receiptPin, reexportPin].every(x => /^[a-f0-9]{64}$/.test(x ?? '')));
assert.ok(!existsSync(out), 'fresh stage required');
const sha = b => createHash('sha256').update(b).digest('hex');
const a = readFileSync(dataReceipt), b = readFileSync(reexportReceipt);
assert.equal(sha(a), receiptPin); assert.equal(sha(b), reexportPin);
const data = JSON.parse(a), base = JSON.parse(b);
assert.equal(data.schema, 'wasmc.rebound-authoring-and-json-differential/v1');
assert.equal(base.schema, 'wasmc.reexport-source-recovery/v1');
const selected = [base.sources.find(x => x.id === 'wasmc-data-core'),
  ...data.rebound_sources.filter(x => ['wasmc-data-interchange', 'wasmc-data-relational'].includes(x.id))];
assert.deepEqual(selected.map(x => x.id).sort(), ['wasmc-data-core', 'wasmc-data-interchange', 'wasmc-data-relational']);
const files = new Map();
for (const row of selected) for (const name of ['lib.json', 'lib.wit', 'adapter.rs', 'delta.rs']) {
  const bytes = readFileSync(join(row.output, name)); assert.equal(sha(bytes), row.files[name]);
  files.set(`libspec/${row.id}/${name}`, bytes);
}
const repo = resolve(import.meta.dirname, '../../../..');
const policyBytes = readFileSync(join(repo, '.agents/workstreams/WS-20261026-lib-memory-release-v031/producer/inputs/cohort-rust-policy.json'));
assert.equal(sha(policyBytes), 'a4d6c4ab47e2926e9eea81de33901b8383f1216c5af3457b99df83bed3ef2616');
const policy = JSON.parse(policyBytes);
assert.equal(policy.edition, '2021'); policy.edition = '2024'; policy.toolchain = 'stable';
policy.shared_modules = {'data-arrow': policy.shared_modules['data-arrow']};
const shared = readFileSync(join(repo, '.agents/workstreams/WS-20261026-lib-memory-release-v031/producer/inputs/shared/data-arrow.rs'));
assert.equal(sha(shared), '856d077a9a727a8230b0d4475cd48cbbeee71d7eda53e8650dc4034afc3f1107');
files.set('libspec/shared/data-arrow.rs', shared);
files.set('libspec/rust-policy.json', Buffer.from(JSON.stringify(policy, null, 2) + '\n'));
files.set('libspec/registry.json', Buffer.from(JSON.stringify({schema:'wasmc.lib-refresh-registry/v2',authority:'libspec',
  libs:selected.map(x => ({id:x.id,source:`libspec/${x.id}`}))}, null, 2) + '\n'));
const lock = readFileSync(join(repo, '.agents/workstreams/WS-20261026-lib-memory-release-v031/producer/inputs/eight.Cargo.lock'));
files.set('libspec/Cargo.lock', lock);
const scripts = ['lib-refresh-v2.mjs', 'lib-refresh-runner-v2.mjs', 'lib-refresh-cache-v2.mjs',
  'lib-refresh-native-v2.mjs', 'lib-refresh-resource-core-v2.mjs', 'lib-refresh-upstream-source-v2.mjs'];
for (const script of scripts) files.set(`scripts/${script}`, readFileSync(join(repo, 'scripts', script)));
mkdirSync(out);
for (const [path, bytes] of files) { const full = join(out, path); mkdirSync(resolve(full, '..'), {recursive: true}); writeFileSync(full, bytes, {flag:'wx'}); }
console.log(JSON.stringify({schema:'wasmc.rebound-refresh-stage/v1', input_receipts:[receiptPin,reexportPin],
  files:Object.fromEntries([...files].map(([path, bytes]) => [path, sha(bytes)])),
  edition:'2024', ids:selected.map(x => x.id), output:out, complete_cohort:false, formal_release:false}));
