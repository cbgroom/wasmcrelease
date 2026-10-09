import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const protectedFiles = ['release.json', 'manifest.json', 'provenance.json', 'SHA256SUMS', 'package-index.json',
  'channels/candidates/0.0.21.json', 'channels/dev.json', 'channels/main.json', 'channels/prod.json'];
const allowedChanges = ['AGENTS.md', 'scripts/agent-release-orientation.mjs', 'scripts/lib-ecosystem-control-plane.mjs',
  'scripts/test-agent-quickstart.mjs', 'scripts/validate-release-surfaces.mjs'];
export const focusedChecks = [
  ['scripts/agent-routes.mjs', '--check'], ['scripts/test-agent-routes.mjs'], ['scripts/test-agent-quickstart.mjs'],
  ['scripts/agent-release-orientation.mjs', '--check'], ['scripts/validate-agent-docs.mjs'], ['scripts/test-agent-guidance.mjs'],
  ['scripts/validate-release-surfaces.mjs'], ['scripts/lib-ecosystem-control-plane.mjs', '--check'],
  ['scripts/validate-sdk-agent-routes.mjs'], ['scripts/test-library-first.mjs'],
  ['scripts/current-compiler-integrity.mjs', '--require-qualification']
];

export function validateGuidanceFence(base = root) {
  const policy = JSON.parse(readFileSync(resolve(root, '.agents/pi-guidance-validation-policy.json')));
  assert.equal(policy.schema, 'wasmc.pi-guidance-pre-candidate-fence/v1');
  assert.equal(policy.baseline_commit, 'c888af39c11640644591ff42aeaf8b09f632f651');
  assert.equal(policy.immutable_tag, 'v0.0.21');
  assert.equal(policy.immutable_commit, '90fe37f33e53fa47707e7694da2fbfb30773110f');
  assert.equal(execFileSync('git', ['rev-parse', `${policy.immutable_tag}^{}`], { cwd: root, encoding: 'utf8' }).trim(), policy.immutable_commit);
  assert.deepEqual(Object.keys(policy.protected_file_sha256).sort(), [...protectedFiles].sort());
  assert.deepEqual([...policy.allowed_changed_frozen_files].sort(), [...allowedChanges].sort());
  for (const path of protectedFiles) {
    const original = execFileSync('git', ['show', `${policy.baseline_commit}:${path}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    assert.equal(hash(original), policy.protected_file_sha256[path], `independent baseline pin drift: ${path}`);
    assert.ok(lstatSync(resolve(base, path)).isFile(), `protected identity must be a file: ${path}`);
    assert.equal(hash(readFileSync(resolve(base, path))), hash(original), `protected release identity drift: ${path}`);
  }
  assert.equal(policy.candidate_path, 'channels/candidates/0.0.21.json');
  assert.equal(policy.candidate_sha256, 'e0d34d806f81f56dde084ae5b1626bdcfcb4ccb8a59491e2b9d37ecce43db651');
  const bytes = readFileSync(resolve(base, policy.candidate_path));
  assert.equal(hash(bytes), policy.candidate_sha256);
  const candidate = JSON.parse(bytes), changed = [];
  for (const row of candidate.product_files) {
    assert.ok(!row.path.split('/').includes('..') && !row.path.startsWith('/'));
    const path = resolve(base, row.path);
    assert.ok(lstatSync(path).isFile(), `frozen product must be a file: ${row.path}`);
    const actual = readFileSync(path);
    if (actual.length !== row.bytes || hash(actual) !== row.sha256) {
      assert.ok(allowedChanges.includes(row.path), `unapproved frozen product drift: ${row.path}`);
      changed.push(row.path);
    }
  }
  assert.ok(changed.includes('AGENTS.md'), 'this fence applies to the unreleased guidance tree');
  return { protected_release_identities: protectedFiles.length, frozen_product_files: candidate.product_files.length,
    changed_frozen_files: changed, candidate_path: policy.candidate_path, candidate_sha256: policy.candidate_sha256 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--out-dir'));
  const out = args.length ? resolve(args[1]) : null;
  if (out) mkdirSync(out, { recursive: true });
  const report = { schema: 'wasmc.pi-guidance-workstream-preflight/v1', accepted: false,
    scope: 'Unreleased guidance checks and immutable-release fence; not whole-product or successor admission',
    checks: [] };
  const run = (argv, label) => {
    const result = spawnSync(process.execPath, argv, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
    if (out) for (const stream of ['stdout', 'stderr']) writeFileSync(resolve(out, `${label}.${stream}`), result[stream] ?? '');
    return { argv: ['node', ...argv], exit_code: result.status, signal: result.signal,
      stdout_sha256: hash(result.stdout ?? ''), stderr_sha256: hash(result.stderr ?? ''), result };
  };
  try {
    report.fence = validateGuidanceFence();
    for (const [i, argv] of focusedChecks.entries()) {
      const { result, ...receipt } = run(argv, `check-${i}`); report.checks.push(receipt);
      assert.equal(result.error, undefined); assert.equal(result.status, 0, `${argv.join(' ')}: ${result.stderr}`);
    }
    const { result, ...receipt } = run(['scripts/release-candidate.mjs', 'verify', report.fence.candidate_path,
      '--candidate-sha256', report.fence.candidate_sha256], 'old-candidate');
    assert.equal(result.error, undefined); assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('product drift rejected'), result.stderr);
    report.old_candidate = { ...receipt, expected_product_drift_rejected: true };
    report.accepted = true;
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
  }
  if (out) writeFileSync(resolve(out, 'preflight.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
