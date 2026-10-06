import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REQUEST = 'wasmc.system-profile-request/v2';
const SOURCE = 'wasmc.lib-refresh-source/v2';
const TARGET = ['os', 'architecture', 'environment', 'embedding'];
const STAGES = ['source', 'qualified', 'admitted', 'released', 'discoverable', 'installable'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export class ProfileResolutionError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'ProfileResolutionError'; this.code = code; this.details = details; }
}
const fail = (code, message, details) => { throw new ProfileResolutionError(code, message, details); };
function target(value, label) {
  if (!object(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...TARGET].sort()) ||
      TARGET.some(key => typeof value[key] !== 'string' || !value[key])) fail('target.invalid', label + ': invalid exact target');
}
function local(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) fail('package.path_invalid', 'relative file required');
  const base = fs.realpathSync(root), result = path.resolve(base, relative);
  if (!result.startsWith(base + path.sep)) fail('package.path_invalid', 'path escapes root', { relative });
  const actual = fs.realpathSync(result);
  if (actual !== result || !actual.startsWith(base + path.sep) || !fs.statSync(actual).isFile())
    fail('package.path_invalid', 'symlink or non-regular source rejected', { relative });
  return result;
}
const sameTarget = (a, b) => TARGET.every(key => a[key] === b[key]);

// Current authoring only. A source plan does not inherit old admission/device
// evidence. Executable consumers must select a verified generated Root receipt.
export function loadSystemLibSource(root, sourcePath) {
  if (!/^libspec\/[a-z0-9-]+\/lib\.json$/.test(sourcePath)) fail('package.invalid', 'source must be canonical libspec/<id>/lib.json');
  const sourceFile = local(root, sourcePath), bytes = fs.readFileSync(sourceFile);
  const spec = JSON.parse(bytes), base = path.dirname(sourceFile);
  if (spec.schema !== SOURCE || spec.profile !== 'native') fail('package.invalid', 'current native source schema required');
  if (path.basename(base) !== spec.id) fail('package.invalid', 'source identity/path mismatch');
  const binding = spec.native?.binding;
  if (!object(binding) || typeof binding.implements !== 'string' || typeof binding.boundary !== 'string' ||
      typeof binding.descriptor !== 'string') fail('package.binding_missing', 'exact native binding required', { sourcePath });
  if (!Array.isArray(binding.targets) || !binding.targets.length) fail('package.target_missing', 'binding targets required');
  binding.targets.forEach(value => target(value, sourcePath));
  const witFile = local(base, 'lib.wit'), witBytes = fs.readFileSync(witFile);
  const witPackage = witBytes.toString().match(/^package\s+([^;]+);/m)?.[1];
  if (witPackage !== binding.implements) fail('package.wit_mismatch', 'WIT package differs from binding');
  if (!spec.native.files.includes(binding.descriptor)) fail('descriptor.invalid', 'descriptor not declared in source inventory');
  const descriptorFile = local(base, binding.descriptor), descriptorBytes = fs.readFileSync(descriptorFile);
  const descriptor = JSON.parse(descriptorBytes);
  if (descriptor.wit !== 'lib.wit' || typeof descriptor.identity !== 'string') fail('descriptor.wit_mismatch', 'descriptor must name source-root lib.wit');
  const declared = new Set(spec.native.files);
  const sourceHashes = {};
  for (const file of [...declared].sort()) sourceHashes[file] = sha(fs.readFileSync(local(base, file)));
  let artifact;
  if (descriptor.schema === 'wasmc.platform-binding-descriptor/v1') {
    target(descriptor.target, 'descriptor');
    if (!binding.targets.some(t => sameTarget(t, descriptor.target))) fail('descriptor.target_mismatch', 'descriptor target differs from binding');
    if (descriptor.artifact?.format !== 'embedded-source' || !Array.isArray(descriptor.artifact.sources) ||
        !descriptor.artifact.sources.length) fail('descriptor.artifact_invalid', 'embedded source list required');
    for (const file of descriptor.artifact.sources) {
      if (!declared.has(file)) fail('descriptor.artifact_invalid', 'embedded source is not in source inventory', { file });
      local(base, file);
    }
    artifact = { ...descriptor.artifact, sources: descriptor.artifact.sources.map(f => path.relative(root, local(base, f))) };
  } else if (descriptor.schema === 'wasmc.native-boundary-descriptor/v1') {
    if (!object(descriptor.adapter) || typeof descriptor.adapter.path !== 'string') fail('descriptor.adapter_invalid', 'native adapter declaration required');
    artifact = { format: 'native-adapter', source: path.relative(root, local(base, spec.native.entry)),
      build_target: spec.native.target, executable: false };
  } else fail('descriptor.invalid', 'unsupported physical binding descriptor');
  if (binding.artifact_format !== artifact.format) fail('package.artifact_invalid', 'binding/descriptor formats differ');
  return { api: binding.implements, provider: descriptor.identity, source: sourcePath,
    source_sha256: sha(bytes), wit: path.relative(root, witFile), wit_sha256: sha(witBytes),
    descriptor: path.relative(root, descriptorFile), descriptor_sha256: sha(descriptorBytes),
    implementation_sha256: sourceHashes, boundary: binding.boundary, artifact,
    targets: binding.targets, lifecycle: Object.fromEntries(STAGES.map(s => [s, s === 'source'])) };
}

export function resolveSystemProfile(request, sources) {
  if (!object(request) || request.schema !== REQUEST) fail('request.invalid', 'current request schema required: ' + REQUEST);
  target(request.target, 'request');
  if (!Array.isArray(request.requirements) || !request.requirements.length ||
      request.requirements.some(v => typeof v !== 'string' || !v)) fail('request.invalid', 'nonempty requirements required');
  if (new Set(request.requirements).size !== request.requirements.length) fail('request.requirement_duplicate', 'requirements must be unique');
  const stage = request.required_lifecycle ?? 'source';
  if (!STAGES.includes(stage)) fail('request.lifecycle_invalid', 'invalid lifecycle');
  const pins = request.pins ?? {};
  if (!object(pins)) fail('request.pin_invalid', 'pins must be an object');
  if (new Set(sources.map(s => s.provider)).size !== sources.length) fail('provider.identity_duplicate', 'provider identities must be unique');
  const bindings = request.requirements.map(api => {
    const eligible = sources.filter(s => s.api === api && s.boundary === request.boundary &&
      s.targets.some(t => sameTarget(t, request.target)) && s.lifecycle[stage] === true);
    const chosen = pins[api] === undefined ? eligible : eligible.filter(s => s.provider === pins[api]);
    if (!chosen.length) fail(pins[api] === undefined ? 'provider.none' : 'provider.pin_unmatched', 'no exact provider satisfies request', { api, stage });
    if (chosen.length !== 1) fail('provider.ambiguous', 'pin one exact provider', { api });
    const { targets, ...selected } = chosen[0];
    return { ...selected, target: request.target };
  });
  return { schema: 'wasmc.library-os-profile/v3', id: request.id, target: request.target,
    host: request.host, required_lifecycle: stage, requirements: request.requirements,
    bindings, acceptance: request.acceptance, executable: false };
}
export function resolveSystemProfileRequest(root, request) {
  if (!object(request) || !Array.isArray(request.sources) || !request.sources.length || 'candidates' in request)
    fail('request.invalid', 'sources required; historical candidate requests are unsupported');
  return resolveSystemProfile(request, request.sources.map(p => loadSystemLibSource(root, p)));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, input, output] = process.argv.slice(2);
  if (command !== 'resolve' || !input) throw new Error('usage: profile-resolver.mjs resolve <current request> [output]');
  try {
    const result = resolveSystemProfileRequest(process.cwd(), JSON.parse(fs.readFileSync(input, 'utf8')));
    const text = JSON.stringify(result, null, 2) + '\n';
    if (output) fs.writeFileSync(output, text); else process.stdout.write(text);
  } catch (error) {
    console.error(JSON.stringify({ accepted: false, code: error.code, message: error.message }));
    process.exitCode = 1;
  }
}
