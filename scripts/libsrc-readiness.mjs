import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const registry = JSON.parse(await readFile(resolve(root, 'libsrc/registry.json'), 'utf8'));
assert.equal(registry.schema, 'wasmc.libsrc-registry/v1');

const rows = [];
for (const entry of registry.candidates) {
  const manifest = JSON.parse(
    await readFile(resolve(root, entry.source_root, 'candidate.json'), 'utf8'),
  );
  assert.equal(manifest.id, entry.id);
  assert.ok(Array.isArray(manifest.completed_gates), entry.id + ': missing completed_gates');
  assert.ok(Array.isArray(manifest.pending_gates), entry.id + ': missing pending_gates');
  const completed = manifest.completed_gates;
  const pending = manifest.pending_gates;
  rows.push({
    id: entry.id,
    version: entry.version,
    stage: entry.stage,
    semantic_kind: entry.semantic_kind,
    host_import_budget: entry.host_import_budget,
    allowed_host_imports: entry.allowed_host_imports ?? [],
    completed_gates: completed,
    pending_gates: pending,
    qualification_script: manifest.qualification?.script ?? null,
    admitted: manifest.admitted === true,
    admission_ready: entry.stage === 'public-source-candidate' && pending.length === 0,
  });
}

const report = {
  accepted: true,
  schema: 'wasmc.libsrc-readiness/v1',
  principle: registry.policy.principle,
  candidates: rows.length,
  public_source_candidates: rows.filter(r => r.stage === 'public-source-candidate').length,
  admitted: rows.filter(r => r.admitted).length,
  admission_ready: rows.filter(r => r.admission_ready).length,
  pending_gate_count: rows.reduce((n, r) => n + r.pending_gates.length, 0),
  rows,
};

console.log(JSON.stringify(report));
