import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

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
const forbiddenSourceSegment = /(^|\/)(target|vendor|cache|node_modules)(\/|$)/;

const registry = JSON.parse(
  await readFile(resolve(root, 'libsrc/registry.json'), 'utf8'),
);
assert.equal(registry.schema, 'wasmc.libsrc-registry/v1');
assert.equal(registry.policy.admission_separate, true);

async function assertMissing(path, message) {
  try {
    await access(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  assert.fail(message);
}

const rows = [];
for (const id of candidateIds) {
  const matches = registry.candidates.filter(candidate => candidate.id === id);
  assert.equal(matches.length, 1, id + ': expected exactly one registry entry');
  const entry = matches[0];
  assert.equal(entry.stage, 'public-source-candidate', id + ': stage drift');
  assert.equal(entry.host_import_budget, 0, id + ': host import budget drift');
  assert.equal(entry.next_gate, 'admission-review', id + ': next gate drift');

  const manifestPath = resolve(root, entry.source_root, 'candidate.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.id, id);
  assert.equal(manifest.version, entry.version);
  assert.equal(manifest.admitted, false, id + ': admission must remain human-controlled');
  assert.ok(
    manifest.completed_gates.includes('wasmi-qualification'),
    id + ': Wasmi qualification is not recorded',
  );
  assert.deepEqual(
    manifest.pending_gates,
    ['admission-review'],
    id + ': automated qualification is incomplete or admission was pre-approved',
  );
  assert.equal(manifest.build?.final_package_source_free, true);
  assert.equal(manifest.build?.embeds_third_party_source, false);
  assert.ok(Array.isArray(manifest.source) && manifest.source.length > 0);
  for (const source of manifest.source) {
    assert.equal(typeof source, 'string', id + ': non-string source entry');
    assert.equal(isAbsolute(source), false, id + ': absolute source entry');
    assert.equal(
      forbiddenSourceSegment.test(source),
      false,
      id + ': generated or vendored source entry: ' + source,
    );
  }

  await assertMissing(
    resolve(root, 'libs', id),
    id + ': immutable package exists before human admission review',
  );

  const artifactPath = resolve(root, manifest.build.artifact);
  const artifact = await readFile(artifactPath);
  assert.equal(WebAssembly.validate(artifact), true, id + ': invalid Core Wasm artifact');
  const coreImports = WebAssembly.Module.imports(
    new WebAssembly.Module(artifact),
  ).length;
  assert.equal(coreImports, 0, id + ': Core Wasm imports exceed zero budget');
  const artifactStat = await stat(artifactPath);

  rows.push({
    id,
    version: manifest.version,
    artifact_bytes: artifactStat.size,
    artifact_sha256: createHash('sha256').update(artifact).digest('hex'),
    core_imports: coreImports,
    pending_gates: manifest.pending_gates,
  });
}

console.log(JSON.stringify({
  accepted: true,
  schema: 'wasmc.data-admission-review-readiness/v1',
  cohort: rows.length,
  automated_gates_complete: true,
  human_admission_required: true,
  admitted: 0,
  immutable_packages_created: 0,
  non_claims: [
    'hosted-checks-complete',
    'admission-approved',
    'immutable-package-created',
    'catalog-published',
  ],
  rows,
}));
