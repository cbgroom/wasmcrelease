// Offline evidence review; never upgrades restricted fixtures into v1 acceptance.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

const [directory, source] = process.argv.slice(2);
assert(directory && /^[0-9a-f]{40}$/.test(source ?? ''), 'receipt directory and exact Git source required');
execFileSync('git', ['cat-file', '-e', `${source}^{commit}`]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const gitHash = path => sha(execFileSync('git', ['show', `${source}:${path}`], {maxBuffer: 8 * 1024 * 1024}));
const baseline = JSON.parse(execFileSync('git', ['show', `${source}:host/core-api-v1-baseline.json`], {encoding:'utf8'}));
const families = baseline.inventory.map(row => row.name).sort();
const platforms = ['ubuntu-24.04', 'macos-15', 'windows-2025'];
const runtimes = ['node', 'bun', 'deno'];
const componentInputs = ['host/core-api-v1-baseline.json', 'host/scenarios/all-api-test.mjs',
  'host/file-io/root.mjs', 'host/file-io/write-window.mjs', 'host/file-io/adapter.mjs',
  'host/completion/guard.mjs', 'host/completion/scoped-guard.mjs',
  'host/scenarios/environment-probe.mjs'].sort();
const receipts = [];
let appPair;
async function load(path) {
  const bytes = await readFile(join(directory, path));
  const value = JSON.parse(bytes);
  assert.equal(value.accepted, true);
  assert.equal(value.exact_source, source);
  receipts.push({path, sha256:sha(bytes)});
  return value;
}
function callers(value) {
  assert.equal(value.uniform_v1_execution, false);
  assert.equal(value.entropy_quality_proven, false);
  assert.equal(value.lib_sha256, gitHash('libs/wasmc-owned-algorithms/artifact.wasm'));
  assert.equal(value.source_sha256, gitHash('host/scenarios/environment-app.wasmc'));
  assert.equal(value.rust_source_sha256, gitHash('host/scenarios/environment-app.rs'));
  assert.equal(value.app_sha256.length, 2);
  assert(value.app_sha256.every(hash => /^[0-9a-f]{64}$/.test(hash)));
  appPair ??= value.app_sha256;
  assert.deepEqual(value.app_sha256, appPair);
}
for (const platform of platforms) {
  for (const runtime of runtimes) {
    const component = await load(`all-api-components-${platform}/all-api-${runtime}.json`);
    assert.equal(component.scope, 'component-behavior-coverage-not-uniform-v1');
    assert.equal(component.uniform_v1_accepted, false);
    assert.equal(component.native_engine_execution, false);
    assert.equal(component.browser_execution, false);
    assert.equal(component.mobile_device_execution, false);
    assert.equal(component.negative_controls, 24);
    assert.deepEqual(component.families.map(row => row.family).sort(), families);
    assert(component.families.every(row => row.uniform_v1_accepted === false));
    assert.deepEqual(Object.keys(component.inputs).sort(), componentInputs);
    for (const [path, hash] of Object.entries(component.inputs)) assert.equal(hash, gitHash(path));
    const app = await load(`environment-app-${platform}/environment-${runtime}.json`);
    assert.equal(app.scope, 'restricted-synchronous-app-lib-host-profile');
    callers(app);
    assert.equal(app.compiler_sha256, gitHash('current/wasmc_compiler.wasm'));
    assert.equal(app.native_engine_execution, false);
    assert.equal(app.real_source_app_calls, 64);
    assert.equal(app.paired_replay_oracles, 1);
    assert.equal(app.negative_controls, 4);
  }
  const native = await load(`environment-native-${platform}/environment-native.json`);
  assert.equal(native.scope, 'restricted-synchronous-native-app-lib-host-profile');
  callers(native);
  assert.equal(native.guest_async_abi, false);
  assert.equal(native.mobile_device_execution, false);
  assert.equal(native.binding_source_sha256, gitHash('host/lib-e2e/rust/src/bin/environment-app-reference.rs'));
  assert.deepEqual(Object.keys(native.engines).sort(), ['wasmi', 'wasmtime']);
  for (const engine of Object.values(native.engines)) {
    assert.equal(engine.real_source_app_calls, 64);
    assert.equal(engine.controlled_oracles, 2);
    assert.equal(engine.negative_controls, 4);
  }
}
console.log(JSON.stringify({source, receipt_count:receipts.length,
  qualification:'restricted-desktop-components-and-S1-only',
  uniform_v1_accepted:false, app_pair_cross_receipt_consistent:true,
  app_binary_rebuild_verified:false, receipts}, null, 2));
