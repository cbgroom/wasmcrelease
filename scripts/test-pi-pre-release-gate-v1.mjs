import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateCandidateTree, validateQualification, validateReleaseRehearsal } from './pi-pre-release-gate-v1.mjs';
import { readProtocol, protocolDigest, protocolRelativePath } from './fresh-agent-learning-v1.mjs';
import {readFileSync} from 'node:fs';

const protocol = readProtocol();
const commit = '1'.repeat(40);
const tree = 'b'.repeat(40);
const product = Buffer.from('final candidate guidance');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const digest = sha256(product);
const inputs=new Map([['AGENTS.md',product]]);
if(protocol.release_binding){
  inputs.set(protocolRelativePath(protocol.release_binding.version),Buffer.from(JSON.stringify(protocol,null,2)+'\n'));
  inputs.set('current/wasmc.mjs',readFileSync(new URL('../current/wasmc.mjs',import.meta.url)));
}
const candidate = {
  schema: protocol.release_binding?'wasmc.release-product-candidate/v3':'wasmc.release-product-candidate/v2',
  version: protocol.release_binding?.version??'9.9.9',
  product_files: [...inputs].map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha256(bytes)})),
  current_catalog:{sha256:protocol.release_binding?.catalog_sha256},
  current_release_closure:{compiler_sha256:protocol.release_binding?.compiler_sha256}
};
candidate.product_set_sha256 = sha256(JSON.stringify(candidate.product_files));
validateCandidateTree(candidate, commit, path => {
  assert.ok(inputs.has(path));
  return inputs.get(path);
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
  protocol_sha256: protocolDigest(protocol),
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
  value => { value.protocol_sha256 = '0'.repeat(64); },
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
if(protocol.release_binding)for(const mutate of [
  value=>value.current_catalog.sha256='0'.repeat(64),
  value=>value.current_release_closure.compiler_sha256='0'.repeat(64),
  value=>value.product_files.find(r=>r.path==='current/wasmc.mjs').sha256='0'.repeat(64),
  value=>value.product_files.find(r=>r.path===protocolRelativePath(value.version)).sha256='0'.repeat(64),
  value=>value.product_files=value.product_files.filter(r=>r.path!==protocolRelativePath(value.version))
]){
  const invalid=structuredClone(candidate);mutate(invalid);
  assert.throws(()=>validateQualification(invalid,release,commit,tree,receipt,protocol));
}

console.log(JSON.stringify({ accepted: true, rejects_stale_rehearsal_commit_or_tree: true, rejects_candidate_or_product_drift: true, rejects_incomplete_pair: true, rejects_structural_or_white_box_failure: true, rejects_retry_or_wrong_first_answer: true, rejects_protocol_or_bound_artifact_drift:true }));
