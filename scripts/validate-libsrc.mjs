import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

const root = process.cwd();
const registryPath = resolve(root, 'libsrc/registry.json');
const registry = JSON.parse(await readFile(registryPath, 'utf8'));
assert.equal(registry.schema, 'wasmc.libsrc-registry/v1');
assert.equal(registry.policy?.principle, 'host-thin-lib-rich');
assert.equal(registry.policy?.admission_separate, true);
assert.ok(Array.isArray(registry.candidates) && registry.candidates.length > 0);

const ids = new Set();
const allowedStages = new Set(['public-source-candidate', 'public-reimplementation-required']);
for (const candidate of registry.candidates) {
  assert.equal(typeof candidate.id, 'string');
  assert.ok(candidate.id.startsWith('wasmc-'), candidate.id);
  assert.ok(!ids.has(candidate.id), 'duplicate candidate id: ' + candidate.id);
  ids.add(candidate.id);
  assert.ok(allowedStages.has(candidate.stage), candidate.id + ': invalid stage');
  assert.ok(Number.isInteger(candidate.host_import_budget) && candidate.host_import_budget >= 0);
  assert.equal(typeof candidate.oracle?.path, 'string');
  assert.match(candidate.oracle?.sha256 ?? '', /^[0-9a-f]{64}$/);

  const oraclePath = resolve(root, candidate.oracle.path);
  const oracleBytes = await readFile(oraclePath);
  const actual = createHash('sha256').update(oracleBytes).digest('hex');
  assert.equal(actual, candidate.oracle.sha256, candidate.id + ': oracle digest drift');

  if (candidate.stage === 'public-source-candidate') {
    assert.equal(typeof candidate.source_root, 'string');
    const sourceRoot = resolve(root, candidate.source_root);
    assert.ok((await stat(sourceRoot)).isDirectory());
    const manifest = JSON.parse(await readFile(resolve(sourceRoot, 'candidate.json'), 'utf8'));
    assert.equal(manifest.schema, 'wasmc.libsrc-candidate/v1');
    assert.equal(manifest.id, candidate.id);
    assert.equal(manifest.host_import_budget, candidate.host_import_budget);
    assert.equal(manifest.admitted, false);
    assert.ok(Array.isArray(manifest.completed_gates), candidate.id + ': missing completed_gates');
    assert.ok(Array.isArray(manifest.pending_gates), candidate.id + ': missing pending_gates');
    assert.ok(
      manifest.completed_gates.every(gate => typeof gate === 'string' && gate.length > 0),
      candidate.id + ': invalid completed gate',
    );
    assert.ok(
      manifest.pending_gates.every(gate => typeof gate === 'string' && gate.length > 0),
      candidate.id + ': invalid pending gate',
    );
    assert.equal(
      new Set([...manifest.completed_gates, ...manifest.pending_gates]).size,
      manifest.completed_gates.length + manifest.pending_gates.length,
      candidate.id + ': duplicate or overlapping gate',
    );
    await readFile(resolve(sourceRoot, manifest.wit), 'utf8');
    assert.ok(Array.isArray(manifest.source) && manifest.source.length > 0);
    for (const source of manifest.source) await readFile(resolve(sourceRoot, source));
    assert.equal(manifest.qualification?.runner, 'node');
    assert.equal(typeof manifest.qualification?.script, 'string');
    const qualificationPath = resolve(root, manifest.qualification.script);
    const qualificationRel = relative(root, qualificationPath);
    assert.ok(
      qualificationRel &&
        !qualificationRel.startsWith('..') &&
        !qualificationRel.includes('/../') &&
        !qualificationRel.includes('\\..\\'),
      candidate.id + ': qualification script escapes repository',
    );
    assert.equal(dirname(qualificationRel), 'scripts');
    assert.ok(qualificationRel.endsWith('.mjs'));
    assert.ok((await stat(qualificationPath)).isFile());
  } else {
    assert.equal(typeof candidate.next_gate, 'string');
    assert.ok(candidate.next_gate.startsWith('clean-room-source'));
  }

  if (candidate.host_import_budget === 0) {
    assert.ok(!candidate.allowed_host_imports || candidate.allowed_host_imports.length === 0);
  } else {
    assert.ok(Array.isArray(candidate.allowed_host_imports));
    assert.ok(candidate.allowed_host_imports.length <= candidate.host_import_budget);
  }
}

console.log(JSON.stringify({
  accepted: true,
  schema: registry.schema,
  candidates: registry.candidates.length,
  public_source_candidates: registry.candidates.filter(c => c.stage === 'public-source-candidate').length,
  reimplementation_required: registry.candidates.filter(c => c.stage === 'public-reimplementation-required').length,
  host_thin: true,
}));
