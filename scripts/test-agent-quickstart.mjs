import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const quickstart = JSON.parse(readFileSync(new URL('../agent-quickstart.json', import.meta.url), 'utf8'));
assert.equal(quickstart.schema, 'wasmc.agent-quickstart/v1');
assert.deepEqual(Object.keys(quickstart.routes), [
  'release-orientation',
  'position-aware-capability-negative',
  'producer-release-u64-delta',
  'ordinary-source-positive',
  'release-state-separation',
  'library-first-selection',
  'host-authority-boundary'
]);
const hash = path => createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex');
assert.equal(hash('current/wasmc_compiler.wasm'), quickstart.routes['release-orientation'].compiler.sha256);
assert.equal(hash('standard/wasmc-std/1.4.0/artifact.wasm'), quickstart.routes['library-first-selection'].artifact_sha256);
const run = script => {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.accepted, true);
  return report;
};
const pair = run('examples/agent-quickstart/run-pair.mjs');
assert.equal(pair.core_sha256, quickstart.routes['ordinary-source-positive'].result.core_sha256);
assert.deepEqual(pair.result, [1, 1]);
const base64 = run('examples/base64/run.mjs');
assert.equal(base64.artifact_sha256, quickstart.routes['library-first-selection'].artifact_sha256);
assert.equal(base64.encoded_utf8, 'YWJj');
assert.equal(base64.decoded_utf8, 'abc');
const delta = quickstart.routes['producer-release-u64-delta'];
assert.equal(delta.producer.commit, '94328ed760f93bf24b595a71facdcc773d43b762');
assert.equal(delta.producer.implemented, true);
assert.deepEqual(delta.release.states, { qualified:false, admitted:false, released:false, discoverable:false, installable:false });
assert.match(delta.char, /not implemented/);
console.log(JSON.stringify({ accepted: true, schema: quickstart.schema, routes: 7, pair, base64 }));
