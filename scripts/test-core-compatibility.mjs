import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coreContract, featureProbeBytes, probeCoreFeatures, preflightCoreArtifact, currentHost } from './core-compatibility.mjs';
const load = path => readFileSync(new URL('../' + path, import.meta.url));
const features = probeCoreFeatures();
for (const name of Object.keys(features)) {
  assert.deepEqual(featureProbeBytes(name), new Uint8Array(load('compatibility/probes/' + name + '.wasm')));
  if (features[name]) assert.equal(new WebAssembly.Instance(new WebAssembly.Module(featureProbeBytes(name)), {}).exports.run(), 7);
}
for (const row of coreContract.artifacts) {
  const bytes = load(row.path);
  const missing = row.additional_required_gates.filter(name => !features[name]);
  if (missing.length) assert.throws(() => preflightCoreArtifact(row.id, bytes), error => error.diagnostic.code === 'engine.feature_unsupported' && JSON.stringify(error.diagnostic.missing_features) === JSON.stringify(missing));
  else assert.equal(preflightCoreArtifact(row.id, bytes).accepted, true);
}
const standard = load(coreContract.artifacts.find(row => row.id === 'standard').path);
const damaged = new Uint8Array(standard); damaged[8] ^= 1;
let validations = 0;
assert.throws(() => preflightCoreArtifact('standard', damaged, () => { validations++; return true; }), error => error.diagnostic.code === 'artifact.identity_mismatch');
assert.equal(validations, 0, 'identity mismatch must reject before engine probes');
assert.throws(() => preflightCoreArtifact('unknown', standard), error => error.diagnostic.code === 'compatibility.contract_invalid');
assert.throws(() => preflightCoreArtifact('standard', null), error => error.diagnostic.code === 'artifact.bytes_invalid');
const tail = featureProbeBytes('tail-call');
assert.throws(() => preflightCoreArtifact('standard', standard, bytes => !Buffer.from(bytes).equals(Buffer.from(tail))), error => error.diagnostic.code === 'engine.feature_unsupported' && JSON.stringify(error.diagnostic.missing_features) === '["tail-call"]');
assert.throws(() => preflightCoreArtifact('standard', standard, bytes => bytes.length < 100), error => error.diagnostic.code === 'engine.artifact_unsupported', 'passing small probes never replaces full-module validation');
const row = coreContract.artifacts.find(row => row.id === 'standard');
row.additional_required_gates.push('unknown-feature');
try {
  assert.throws(() => preflightCoreArtifact('standard', standard, () => true), error => error.diagnostic.code === 'compatibility.contract_invalid');
} finally { row.additional_required_gates.pop(); }
console.log(JSON.stringify({accepted:true, host:currentHost(), features, negative_tests:6, supported_probe_oracle:7}));
