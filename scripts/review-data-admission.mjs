import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const candidateIds = [
  'wasmc-data-core',
  'wasmc-csv',
  'wasmc-data-expr',
  'wasmc-data-compute',
  'wasmc-data-relational',
  'wasmc-data-profile',
  'wasmc-data-interchange',
];
const canonicalFiles = [
  'SKILL.md',
  'artifact.wasm',
  'component.wasm',
  'lib.json',
  'lib.wit',
  'references/agent-delta.json',
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const registry = JSON.parse(await readFile(resolve(root, 'libsrc/registry.json'), 'utf8'));
assert.equal(registry.schema, 'wasmc.libsrc-registry/v1');
assert.equal(registry.policy.admission_separate, true);

async function files(directory, prefix = '') {
  const rows = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) rows.push(...await files(resolve(directory, entry.name), relative));
    else if (entry.isFile()) rows.push(relative);
  }
  return rows;
}

const rows = [];
for (const id of candidateIds) {
  const matches = registry.candidates.filter(candidate => candidate.id === id);
  assert.equal(matches.length, 1, id + ': expected exactly one registry entry');
  const entry = matches[0];
  assert.equal(entry.stage, 'admitted', id + ': admission is not closed');
  assert.equal(entry.version, '0.0.1');
  assert.equal(entry.host_import_budget, 0);
  assert.equal(entry.next_gate, null);

  const candidate = JSON.parse(
    await readFile(resolve(root, entry.source_root, 'candidate.json'), 'utf8'),
  );
  assert.equal(candidate.id, id);
  assert.equal(candidate.version, entry.version);
  assert.equal(candidate.admitted, true);
  assert.ok(candidate.completed_gates.includes('wasmi-qualification'));
  assert.ok(candidate.completed_gates.includes('admission-review'));
  assert.deepEqual(candidate.pending_gates, []);
  assert.match(candidate.admission?.source_authority ?? '', /^[0-9a-f]{40}$/);
  assert.equal(candidate.build?.final_package_source_free, true);
  assert.equal(candidate.build?.embeds_third_party_source, false);

  const packageRoot = resolve(root, 'libs', id);
  assert.deepEqual((await files(packageRoot)).sort(), canonicalFiles);
  const lib = JSON.parse(await readFile(resolve(packageRoot, 'lib.json'), 'utf8'));
  assert.equal(lib.schema, 'wasmc.lib/v0');
  assert.equal(lib.id, id);
  assert.equal(lib.version, '0.0.1');
  assert.equal(lib.admission?.approved, true);
  assert.equal(lib.admission?.source_authority, candidate.admission.source_authority);
  const artifact = await readFile(resolve(packageRoot, lib.artifact.path));
  assert.equal(WebAssembly.validate(artifact), true);
  assert.equal(WebAssembly.Module.imports(new WebAssembly.Module(artifact)).length, 0);
  assert.equal(artifact.length, lib.artifact.bytes);
  assert.equal(sha(artifact), lib.artifact.sha256);
  const component = await readFile(resolve(packageRoot, lib.component.path));
  assert.equal(component.length, lib.component.bytes);
  assert.equal(sha(component), lib.component.sha256);
  rows.push({
    id,
    version: lib.version,
    source_authority: lib.admission.source_authority,
    artifact_bytes: artifact.length,
    artifact_sha256: lib.artifact.sha256,
    component_bytes: component.length,
    component_sha256: lib.component.sha256,
    core_imports: 0,
  });
}

console.log(JSON.stringify({
  accepted: true,
  schema: 'wasmc.data-admission-closure/v1',
  cohort: rows.length,
  admitted: rows.length,
  immutable_packages_created: rows.length,
  source_free: true,
  rows,
}));
