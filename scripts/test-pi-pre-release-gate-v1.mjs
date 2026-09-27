import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateCandidateTree, validateQualification, validateReleaseRehearsal } from './pi-pre-release-gate-v1.mjs';
import { readProtocol } from './fresh-agent-learning-v1.mjs';

const protocol = readProtocol();
const commit = '1'.repeat(40);
const tree = 'b'.repeat(40);
const product = Buffer.from('final candidate guidance');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const digest = sha256(product);
const candidate = {
  schema: 'wasmc.release-product-candidate/v2',
  version: '9.9.9',
  product_files: [{ path: 'AGENTS.md', bytes: product.length, sha256: digest }]
};
candidate.product_set_sha256 = sha256(JSON.stringify(candidate.product_files));
validateCandidateTree(candidate, commit, path => {
  assert.equal(path, 'AGENTS.md');
  return product;
});
const release = {
  schema: 'wasmc-public-release/v1',
  version: candidate.version,
  stage: 'prod',
  tag: `v${candidate.version}`,
  staged_product_manifest: `channels/candidates/${candidate.version}.json`,
  product_candidate_commit: '3'.repeat(40)
};
assert.equal(validateReleaseRehearsal(candidate, release, commit, tree), true);

const cases = protocol.cases.map(row => ({
  id: row.id,
  structural_pass: true,
  oracle_passed: true,
  first_final_correct: true,
  final_answer_sha256: 'a'.repeat(64),
  error_results: 0,
  retries: 0
}));
const receipt = {
  schema: 'wasmc.pi-pre-release-qualification/v1',
  release: { version: candidate.version, rehearsal_commit: commit, rehearsal_tree: tree, candidate_commit: release.product_candidate_commit, product_set_sha256: candidate.product_set_sha256 },
  protocol: protocol.schema,
  agent: { implementation: 'pi', version: '0.87.1' },
  fresh_local_git_clone_per_case: true,
  raw_trace_retained: false,
  hidden_reasoning_retained: false,
  review: { independent_from_model_self_assessment: true },
  models: protocol.cohort_gate.required_models.map(model => ({ ...model, structural_pass: true, white_box_pass: true, cases })),
  controlled_pair_accepted: true
};
assert.equal(validateQualification(candidate, release, commit, tree, receipt, protocol), true);

for (const mutate of [
  value => { value.release.rehearsal_commit = '2'.repeat(40); },
  value => { value.release.rehearsal_tree = '2'.repeat(40); },
  value => { value.release.candidate_commit = '2'.repeat(40); },
  value => { value.release.product_set_sha256 = '0'.repeat(64); },
  value => { value.models.pop(); },
  value => { value.models[0].structural_pass = false; },
  value => { value.models[0].white_box_pass = false; },
  value => { value.models[0].cases[0].oracle_passed = false; },
  value => { value.models[0].cases[0].first_final_correct = false; },
  value => { value.models[0].cases[0].retries = 1; },
  value => { value.controlled_pair_accepted = false; }
]) {
  const invalid = structuredClone(receipt);
  mutate(invalid);
  assert.throws(() => validateQualification(candidate, release, commit, tree, invalid, protocol));
}

console.log(JSON.stringify({ accepted: true, rejects_stale_rehearsal_commit_or_tree: true, rejects_candidate_or_product_drift: true, rejects_incomplete_pair: true, rejects_structural_or_white_box_failure: true, rejects_retry_or_wrong_first_answer: true }));
