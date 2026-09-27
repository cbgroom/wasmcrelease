import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProtocol } from './fresh-agent-learning-v1.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const exactCommit = value => /^[0-9a-f]{40}$/.test(value ?? '');
const exactDigest = value => /^[0-9a-f]{64}$/.test(value ?? '');
const exactTree = value => /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value ?? '');

function git(...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: args[0] === 'show' ? null : 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
}

export function validateCandidateTree(candidate, commit, readAtCommit) {
  assert.ok(exactCommit(commit), 'exact candidate commit required');
  assert.ok(['wasmc.release-product-candidate/v2', 'wasmc.release-product-candidate/v3'].includes(candidate.schema));
  assert.match(candidate.version, /^\d+\.\d+\.\d+$/);
  assert.ok(Array.isArray(candidate.product_files) && candidate.product_files.length > 0);
  for (const row of candidate.product_files) {
    const bytes = readAtCommit(row.path);
    assert.equal(bytes.length, row.bytes, `candidate bytes drift at ${row.path}`);
    assert.equal(sha256(bytes), row.sha256, `candidate digest drift at ${row.path}`);
  }
  assert.equal(sha256(JSON.stringify(candidate.product_files)), candidate.product_set_sha256);
  return true;
}

export function validateReleaseRehearsal(candidate, release, commit, tree) {
  assert.ok(['wasmc-public-release/v1', 'wasmc-public-release/v2'].includes(release.schema));
  assert.equal(release.version, candidate.version);
  assert.equal(release.stage, 'prod');
  assert.equal(release.tag, `v${candidate.version}`);
  assert.equal(release.staged_product_manifest, `channels/candidates/${candidate.version}.json`);
  assert.ok(exactCommit(release.product_candidate_commit), 'release candidate commit missing');
  assert.ok(exactTree(tree), 'exact release rehearsal tree required');
  assert.ok(exactCommit(commit), 'exact release rehearsal commit required');
  return true;
}

export function validateQualification(candidate, release, commit, tree, receipt, protocol) {
  validateProtocol(protocol);
  validateReleaseRehearsal(candidate, release, commit, tree);
  assert.equal(receipt.schema, 'wasmc.pi-pre-release-qualification/v1');
  assert.equal(receipt.release?.version, candidate.version);
  assert.equal(receipt.release?.rehearsal_commit, commit);
  assert.equal(receipt.release?.rehearsal_tree, tree);
  assert.equal(receipt.release?.candidate_commit, release.product_candidate_commit);
  assert.equal(receipt.release?.product_set_sha256, candidate.product_set_sha256);
  assert.equal(receipt.protocol, protocol.schema);
  assert.equal(receipt.agent?.implementation, 'pi');
  assert.match(receipt.agent?.version ?? '', /^\d+\.\d+\.\d+$/);
  assert.equal(receipt.fresh_local_git_clone_per_case, true);
  assert.equal(receipt.raw_trace_retained, false);
  assert.equal(receipt.hidden_reasoning_retained, false);
  assert.equal(receipt.review?.independent_from_model_self_assessment, true);

  const requiredModels = protocol.cohort_gate.required_models;
  assert.equal(receipt.models?.length, requiredModels.length);
  for (const required of requiredModels) {
    const model = receipt.models.find(row => row.provider === required.provider && row.identity === required.identity);
    assert.ok(model, `missing required model ${required.provider}/${required.identity}`);
    assert.equal(model.structural_pass, true, `${required.identity} structural gate failed`);
    assert.equal(model.white_box_pass, true, `${required.identity} white-box gate failed`);
    assert.equal(model.cases?.length, protocol.cases.length);
    assert.equal(new Set(model.cases.map(row => row.id)).size, protocol.cases.length);
    for (const caseDefinition of protocol.cases) {
      const row = model.cases.find(item => item.id === caseDefinition.id);
      assert.ok(row, `${required.identity} missing ${caseDefinition.id}`);
      assert.equal(row.structural_pass, true, `${required.identity}/${row.id} structural failure`);
      assert.equal(row.oracle_passed, true, `${required.identity}/${row.id} oracle failure`);
      assert.equal(row.first_final_correct, true, `${required.identity}/${row.id} first-final failure`);
      assert.ok(exactDigest(row.final_answer_sha256), `${required.identity}/${row.id} answer digest missing`);
      assert.equal(row.error_results, 0, `${required.identity}/${row.id} tool errors present`);
      assert.equal(row.retries, 0, `${required.identity}/${row.id} retries present`);
    }
  }
  assert.equal(receipt.controlled_pair_accepted, true);
  return true;
}

function parse(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith('--')) throw new Error(`unknown argument: ${key}`);
    options[key.slice(2)] = rest[++index];
  }
  return { command, options };
}

function atCommit(commit, path) {
  assert.match(path, /^[A-Za-z0-9._/-]+$/);
  return git('show', `${commit}:${path}`);
}

function releaseInputs(commit, candidatePath) {
  const candidate = JSON.parse(atCommit(commit, candidatePath).toString('utf8'));
  const release = JSON.parse(atCommit(commit, 'release.json').toString('utf8'));
  const tree = git('rev-parse', `${commit}^{tree}`).trim();
  validateCandidateTree(candidate, commit, path => atCommit(commit, path));
  validateReleaseRehearsal(candidate, release, commit, tree);
  return { candidate, release, tree };
}

async function runModel(model, commit, output, timeoutMs) {
  mkdirSync(dirname(output), { recursive: true });
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [
      join(root, 'scripts/run-pi-learning-model-v1.mjs'),
      '--model', model,
      '--commit', commit,
      '--out', output,
      '--timeout-ms', String(timeoutMs)
    ], { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', code => resolvePromise({ model, output, accepted: code === 0, exit_code: code }));
  });
}

async function main() {
  const { command, options } = parse(process.argv.slice(2));
  const protocol = validateProtocol(JSON.parse(readFileSync(join(root, 'agent-evaluation/fresh-agent-learning-v1.json'), 'utf8')));
  if (command === 'run') {
    const commit = options.commit;
    assert.ok(exactCommit(commit), '--commit must be an exact 40-character commit');
    assert.equal(git('status', '--porcelain').trim(), '', 'pre-release Pi run requires a clean worktree; commit the final candidate first');
    git('cat-file', '-e', `${commit}^{commit}`);
    const candidatePath = options.candidate;
    assert.ok(candidatePath, '--candidate is required');
    const { candidate, release, tree } = releaseInputs(commit, candidatePath);
    const outputDirectory = resolve(options['out-dir'] ?? join(root, 'target/fresh-agent/pre-release', commit));
    const timeoutMs = Number(options['timeout-ms'] ?? 180000);
    assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 600000);
    const results = await Promise.all(protocol.cohort_gate.required_models.map(row => {
      const model = `${row.provider}/${row.identity}`;
      return runModel(model, commit, join(outputDirectory, `${row.identity}.json`), timeoutMs);
    }));
    const accepted = results.every(row => row.accepted);
    console.log(JSON.stringify({
      accepted,
      scope: 'structural-live-model-run-only',
      release_rehearsal_commit: commit,
      release_rehearsal_tree: tree,
      candidate_commit: release.product_candidate_commit,
      product_set_sha256: candidate.product_set_sha256,
      results,
      next: accepted ? 'independent white-box review and privacy-safe receipt' : 'classify failures; do not promote'
    }));
    if (!accepted) process.exitCode = 1;
  } else if (command === 'verify') {
    const commit = options.commit;
    const candidatePath = options.candidate;
    const receiptPath = options.receipt;
    assert.ok(exactCommit(commit) && candidatePath && receiptPath, 'verify requires --commit, --candidate and --receipt');
    const { candidate, release, tree } = releaseInputs(commit, candidatePath);
    const receipt = JSON.parse(readFileSync(isAbsolute(receiptPath) ? receiptPath : resolve(root, receiptPath), 'utf8'));
    validateQualification(candidate, release, commit, tree, receipt, protocol);
    console.log(JSON.stringify({ accepted: true, release_rehearsal_commit: commit, release_rehearsal_tree: tree, candidate_commit: release.product_candidate_commit, product_set_sha256: candidate.product_set_sha256, controlled_pair_accepted: true }));
  } else {
    throw new Error('usage: pi-pre-release-gate-v1.mjs run|verify --commit SHA --candidate FILE [--receipt FILE]');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
