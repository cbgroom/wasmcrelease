import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const coreContract = JSON.parse(readFileSync(new URL('../compatibility/core-artifacts-v009.json', import.meta.url)));
export const currentHost = () => ({name:globalThis.Bun ? 'bun' : globalThis.Deno ? 'deno' : 'node', version:globalThis.Bun?.version ?? globalThis.Deno?.version.deno ?? process.version, v8:process.versions.v8 ?? null});
const probes = Object.freeze({
  'function-references': '0061736d010000000105016000017f03030200000707010372756e0001090501030001000a0d02040041070b0600d20014000b0015046e616d65010801000576616c7565040401000166',
  'tail-call': '0061736d010000000105016000017f03030200000707010372756e00010a0b02040041070b040012000b000f046e616d65010801000576616c7565',
});
export const featureProbeBytes = name => {
  if (!Object.hasOwn(probes, name)) throw new Error('unknown compatibility feature');
  return new Uint8Array(Buffer.from(probes[name], 'hex'));
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const supports = (bytes, validate) => {
  try { return validate(bytes) === true; } catch { return false; }
};
export function probeCoreFeatures(validate = bytes => WebAssembly.validate(bytes)) {
  return Object.fromEntries(Object.keys(probes).map(name => [name, supports(featureProbeBytes(name), validate)]));
}
export class CoreCompatibilityError extends Error {
  constructor(diagnostic) {
    super(JSON.stringify(diagnostic));
    this.name = 'CoreCompatibilityError';
    this.diagnostic = diagnostic;
  }
  toJSON() { return this.diagnostic; }
}
// Preflight is a consumer reference, not an authority grant or a third-party resolver.
// The validation override exists for negative tests, not an engine-support claim.
export function preflightCoreArtifact(id, bytes, validate = bytes => WebAssembly.validate(bytes)) {
  const row = coreContract.artifacts.find(row => row.id === id);
  const reject = (code, extra = {}) => { throw new CoreCompatibilityError({accepted:false, code, artifact:id, ...extra}); };
  if (!row || coreContract.schema !== 'wasmc.core-compatibility/v1') reject('compatibility.contract_invalid');
  if (!(bytes instanceof Uint8Array)) reject('artifact.bytes_invalid');
  if (bytes.byteLength !== row.bytes || sha(bytes) !== row.sha256) reject('artifact.identity_mismatch');
  const features = probeCoreFeatures(validate);
  if (row.additional_required_gates.some(name => !Object.hasOwn(features, name))) reject('compatibility.contract_invalid');
  const missing = row.additional_required_gates.filter(name => !features[name]);
  if (missing.length) reject('engine.feature_unsupported', {missing_features:missing, sha256:row.sha256, action:'Use a supported engine or a separately admitted portable variant; do not change immutable bytes or enable flags silently.'});
  // Complete validation is still required: probes are not exhaustive feature analysis.
  if (!supports(new Uint8Array(bytes), validate)) reject('engine.artifact_unsupported', {sha256:row.sha256});
  return {accepted:true, artifact:id, sha256:row.sha256, validation_profile:row.validation_profile, feature_support:features};
}
