import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildAgentGuidance, loadAgentRoutes, loadAgentRoute, readPublishedLifecycle } from './agent-routes.mjs';
import { publishedLifecycle } from './release-lifecycle.mjs';
import { executeSource, inspectPure } from './wasmc-agent-execute.mjs';
const root = new URL('../', import.meta.url).pathname;
const read = p => JSON.parse(readFileSync(join(root, p)));
const release = read('release.json'), prod = read('channels/prod.json'), candidate = read(release.staged_product_manifest);
const model = buildAgentGuidance(), loaded = loadAgentRoutes(); assert.deepEqual(loaded.routes, model.routes);
assert.deepEqual(loadAgentRoute('library-discovery'), model.routes['library-discovery']);
assert.equal(readPublishedLifecycle().states.installable, true);
assert.deepEqual(model.routes['release-state-separation'].related_product.routes, read('release-surfaces.json').package_profiles['wasmc-system-telemetry@0.0.1'].supported_surfaces);
assert.ok(Object.values(model.routes['release-state-separation'].states).every(x => x === false));
for (const mutate of [p => p.version = '0.0.20', p => p.tag = 'v0.0.20', p => p.stage = 'dev', p => p.product_set_sha256 = '0'.repeat(64), p => p.product_candidate_commit = '0'.repeat(40), p => p.qualification.accepted = false, p => p.qualification.tested_product_set_sha256 = '0'.repeat(64)]) {
  const bad = structuredClone(prod); mutate(bad);
  const states = publishedLifecycle(release, bad, candidate, release.version);
  assert.equal(states.released, false); assert.equal(states.admitted, false); assert.equal(states.installable, false);
  const projected = buildAgentGuidance(root, { 'channels/prod.json': bad });
  assert.deepEqual(projected.routes['library-first-selection'].states, states);
  for (const [key, value] of Object.entries(states)) assert.equal(projected.routes['release-state-separation'].related_product[key], value);
}
const temp = mkdtempSync(join(tmpdir(), 'agent-route-mutation-'));
try {
  mkdirSync(join(temp, 'agent-routes')); writeFileSync(join(temp, 'agent-quickstart.json'), JSON.stringify(model.index));
  for (const [path, bytes] of Object.entries(model.files)) writeFileSync(join(temp, path), bytes);
  const p = join(temp, 'agent-routes/release-state-separation.json'), altered = JSON.parse(readFileSync(p)); altered.related_product.released = false; writeFileSync(p, JSON.stringify(altered));
  assert.throws(() => loadAgentRoutes(temp), /route digest drift/);
  assert.deepEqual(loadAgentRoute('library-discovery', temp), model.routes['library-discovery'], 'selected route read does not scan other routes');
  assert.throws(() => loadAgentRoute('release-state-separation', temp), /route digest drift/);
  mkdirSync(join(temp, 'channels/candidates'), { recursive: true });
  writeFileSync(join(temp, 'release.json'), JSON.stringify(release)); writeFileSync(join(temp, 'channels/prod.json'), JSON.stringify(prod));
  writeFileSync(join(temp, release.staged_product_manifest), readFileSync(join(root, release.staged_product_manifest)));
  assert.equal(readPublishedLifecycle(temp).states.installable, true);
  writeFileSync(join(temp, release.staged_product_manifest), JSON.stringify({ ...candidate, product_set_sha256: '0'.repeat(64) }));
  assert.throws(() => readPublishedLifecycle(temp), /lifecycle candidate digest drift/);
  const index = structuredClone(model.index); index.routes['release-orientation'].path = '../release.json'; writeFileSync(join(temp, 'agent-quickstart.json'), JSON.stringify(index));
  assert.throws(() => loadAgentRoutes(temp));
} finally { rmSync(temp, { recursive: true }); }
const source = 'package local:calc; interface api { calc: func(x: s32) -> s32 { return x * 2 + 1; } } world app { export api; }';
const proof = await executeSource(source, 'calc', [[0], [9], [-3]]); assert.deepEqual(proof.calls.map(r => r.result), [1, 19, -5]); assert.deepEqual(proof.imports, []);
await assert.rejects(executeSource(source, 'calc', [[0]], '0'.repeat(64)), /independent compiler digest mismatch/);
const probeTemp = mkdtempSync(join(tmpdir(), 'agent-digest-probe-'));
try {
  const path = join(probeTemp, 'calc.wasmc'); writeFileSync(path, source);
  const args = ['--source', path, '--export', 'calc', '--calls', '[[0]]', '--expected-compiler-sha256', '0'.repeat(64)];
  const result = JSON.parse(execFileSync(process.execPath, ['scripts/wasmc-agent-probe.mjs', ...args], { cwd: root, encoding: 'utf8' }));
  assert.equal(result.verifier_exit_code, 1); assert.equal(result.execution_accepted, false);
  assert.throws(() => execFileSync(process.execPath, ['scripts/wasmc-agent-probe.mjs', ...args.slice(0, -1), proof.compiler_sha256], { cwd: root, stdio: 'pipe' }), 'a healthy execution cannot pass the negative probe');
} finally { rmSync(probeTemp, { recursive: true }); }
const hostModule = Uint8Array.from([0,97,115,109,1,0,0,0,1,5,1,96,0,1,127,2,18,1,3,101,110,118,10,114,101,97,100,95,99,108,111,99,107,0,0,7,7,1,3,114,117,110,0,0]);
assert.ok(WebAssembly.validate(hostModule)); assert.throws(() => inspectPure(hostModule), /Host imports require/);
for (const codec of ['base64', 'hex']) {
  const result = JSON.parse(execFileSync(process.execPath, ['examples/lib-bytes/run.mjs', '--codec', codec, '--text', '你好 Pi'], { cwd: root, encoding: 'utf8' }));
  assert.equal(result.encoded_utf8, Buffer.from('你好 Pi').toString(codec)); assert.equal(result.explicit_drops, 1024); assert.equal(result.selected_Root_verified, true);
}
console.log(JSON.stringify({ accepted: true, routes: 12, lifecycle_negative_cases: 7, mutated_route_rejected: true, escaping_path_rejected: true, independent_digest_rejected: true, unapproved_Host_refused_before_instantiation: true, codecs: 2, byte_codec_rounds: 512, explicit_drops: 2048 }));
