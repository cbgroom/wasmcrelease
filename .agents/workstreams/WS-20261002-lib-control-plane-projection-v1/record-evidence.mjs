import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const here = fileURLToPath(new URL('./', import.meta.url));
const phase = process.argv[2];
assert(['before', 'after'].includes(phase));
const base = 'dd30f28276a633cefb68972186c2cbeb2fca4a80';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const immutablePaths = ['release.json', 'manifest.json', 'provenance.json',
  'SHA256SUMS', 'package-index.json', 'channels/candidates/0.0.20.json',
  'channels/dev.json', 'channels/main.json', 'channels/prod.json',
  'release-lib-route-readiness.json', 'catalog/libs-current-v2.json',
  'catalog/current-v2-policy.json', 'catalog/current-v2-migration.json',
  'scripts/lib-ecosystem-control-plane.mjs'];
const preserved = immutablePaths.map(path => {
  const actual = readFileSync(join(root, path));
  const expected = execFileSync('git', ['show', `${base}:${path}`],
    { cwd: root, maxBuffer: 2 * 1024 * 1024 });
  assert(actual.equals(expected), `out-of-scope file changed: ${path}`);
  return { path, bytes: actual.length, sha256: sha(actual), unchanged_from_base: true };
});
const commands = [
  ['node', 'scripts/lib-ecosystem-control-plane.mjs', '--check'],
  ['node', 'scripts/test-lib-control-plane-projection.mjs'],
  ['node', 'scripts/test-current-v2-closure.mjs'],
  ['node', 'scripts/lib-route-closure.mjs', '--check'],
  ['node', 'scripts/release-candidate.mjs', 'verify', 'channels/candidates/0.0.20.json'],
  ['/bin/bash', 'scripts/maintainer-orient.sh'],
  ['/bin/bash', 'scripts/validate-maintainer.sh'],
  ['git', 'diff', '--check']
];
const checks = commands.map(argv => {
  const command = argv[0] === 'node' ? process.execPath : argv[0];
  const result = spawnSync(command, argv.slice(1),
    { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 60000 });
  assert.equal(result.error, undefined);
  const expectedReject = argv.includes('verify') || argv.some(arg =>
    arg.endsWith('maintainer-orient.sh') || arg.endsWith('validate-maintainer.sh')) ||
    (phase === 'before' && ['scripts/lib-ecosystem-control-plane.mjs',
      'scripts/test-lib-control-plane-projection.mjs'].includes(argv[1]));
  assert.equal(result.status, expectedReject ? 1 : 0, `unexpected exit: ${argv.join(' ')}`);
  if (argv.includes('verify')) assert(result.stderr.includes('product drift rejected'));
  if (argv.some(arg => arg.endsWith('maintainer-orient.sh') || arg.endsWith('validate-maintainer.sh')))
    assert(result.stderr.includes('manifest identity mismatch: scripts/lib-catalog.mjs'));
  if (phase === 'before' && argv[1] === 'scripts/lib-ecosystem-control-plane.mjs')
    assert(result.stderr.includes('lib ecosystem control plane is stale'));
  if (phase === 'before' && argv[1] === 'scripts/test-lib-control-plane-projection.mjs')
    assert(result.stderr.includes('selected count drift'));
  // The native orientation embeds its machine-local checkout path. Retain only
  // its version/identity facts and redacted stderr; never publish that path.
  const redact = text => text.replaceAll(root.replace(/\/$/, ''), '<public-worktree>');
  return { command: argv, exit_status: result.status,
    classification: expectedReject ? 'retained-rejection-not-pass' : 'pass',
    stdout: redact(result.stdout), stderr: redact(result.stderr) };
});
const original = JSON.parse(execFileSync('git', ['show', `${base}:lib-ecosystem-control-plane.json`],
  { cwd: root, maxBuffer: 1024 * 1024 }));
const current = JSON.parse(readFileSync(join(root, 'lib-ecosystem-control-plane.json')));
const changes = [];
function compare(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    changes.push({ path, before: a, after: b });
    return;
  }
  assert.deepEqual(Object.keys(a), Object.keys(b), `projection shape changed: ${path}`);
  for (const key of Object.keys(a)) compare(a[key], b[key], `${path}/${key}`);
}
compare(original, current);
const allowed = new Set(['/inventory/current_side_installable']);
for (const id of ['wasmc-json', 'wasmc-compression']) {
  const index = original.packages.findIndex(row => row.id === id);
  assert(index >= 0);
  allowed.add(`/packages/${index}/current_side_remediation/resolvable_installable`);
  allowed.add(`/packages/${index}/current_side_remediation/authority`);
}
if (phase === 'after') {
  assert.equal(changes.length, allowed.size);
  for (const row of changes) assert(allowed.has(row.path), `unexpected derived change: ${row.path}`);
  assert.equal(current.inventory.current_side_installable, 5);
} else assert.equal(changes.length, 0);
const receipt = { schema: 'wasmc.lib-control-plane-projection-evidence/v1', phase,
  base_commit: base,
  measurement_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version,
  measurement_scope: 'working tree with exact public base and digest-bound test scripts; commit alone is not a tested-tree assertion',
  test_inputs: ['scripts/test-lib-control-plane-projection.mjs',
    '.agents/workstreams/WS-20261002-lib-control-plane-projection-v1/record-evidence.mjs']
    .map(path => ({ path, sha256: sha(readFileSync(join(root, path))) })),
  projection: { bytes: readFileSync(join(root, 'lib-ecosystem-control-plane.json')).length,
    sha256: sha(readFileSync(join(root, 'lib-ecosystem-control-plane.json'))) },
  preserved, changed_projection_fields: changes, checks,
  nonclaims: ['full maintainer PASS', 'all18 qualification', 'new candidate or release',
    'main integration', 'private producer evidence'] };
const output = join(here, `evidence-${phase}.json`);
writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ accepted: true, path: relative(root, output),
  sha256: sha(readFileSync(output)), checks: checks.map(check =>
    ({ command: check.command, exit_status: check.exit_status, classification: check.classification })),
  preserved_files: preserved.length, changed_projection_fields: changes.length }));
