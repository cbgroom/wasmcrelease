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
  'release-lib-route-readiness',
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
assert.match(delta.answer_opening, /Producer master: yes/);
assert.match(delta.answer_opening, /Immutable v0\.0\.13 release: no/);
assert.deepEqual(delta.release.states, { qualified:false, admitted:false, released:false, discoverable:false, installable:false });
assert.match(delta.char, /not implemented/);
const routeReadiness=quickstart.routes['release-lib-route-readiness'];
const routeReadinessAuthority=JSON.parse(readFileSync(new URL('../release-lib-route-readiness.json',import.meta.url),'utf8'));
assert.equal(routeReadinessAuthority.schema,'wasmc.release-lib-route-readiness/v1');
assert.equal(routeReadiness.authority_file,'release-lib-route-readiness.json');
assert.deepEqual(routeReadiness.immutable_release,routeReadinessAuthority.immutable_release);
assert.deepEqual(routeReadiness.future_candidate,routeReadinessAuthority.future_candidate);
assert.deepEqual(routeReadiness.active_search,routeReadinessAuthority.active_search);
assert.equal(routeReadiness.valid_resolution_count,routeReadinessAuthority.valid_resolution_count);
assert.equal(routeReadiness.only_valid_closure,routeReadinessAuthority.only_valid_closure);
assert.equal(routeReadiness.future_candidate.formal_release_ready,false);
assert.equal(routeReadiness.future_candidate.candidate_extras,1);
assert.deepEqual(routeReadiness.future_candidate.blocking_conditions,['active-lib-search-candidate-extra']);
assert.equal(routeReadiness.active_search.states.admitted,false);
assert.equal(routeReadiness.valid_resolution_count,1);
assert.match(routeReadiness.only_valid_closure,/candidate_extras=0/);
assert.match(routeReadiness.only_valid_closure,/no alternative route-set repair/);
assert(routeReadiness.forbidden_shortcuts.some(row=>row.includes('remove the active LibSearch identity')));
console.log(JSON.stringify({ accepted: true, schema: quickstart.schema, routes: 8, pair, base64, route_readiness:{formal_release_ready:false,blocker:'active-lib-search-candidate-extra'} }));
