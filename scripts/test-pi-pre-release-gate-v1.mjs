import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateCandidateTree, validateQualification, validateReleaseRehearsal } from './pi-pre-release-gate-v1.mjs';
import { readProtocol, protocolDigest, protocolRelativePath } from './fresh-agent-learning-v1.mjs';
import {readFileSync} from 'node:fs';

// The public workstream intentionally retains a frozen v23 protocol alongside
// future compiler carriers. Bind a legal v3 fixture in memory; never refresh
// the actual frozen protocol or pretend this is live final-candidate evidence.
const protocol = readProtocol();
if(protocol.release_binding){
  const prior=structuredClone(protocol.release_binding),compiler=JSON.parse(readFileSync(new URL('../current/compiler-release.json',import.meta.url)));
  const sha=value=>createHash('sha256').update(value).digest('hex');
  Object.assign(protocol.release_binding,{version:compiler.version,compiler_sha256:compiler.compiler.sha256,
    facade_sha256:sha(readFileSync(new URL('../current/wasmc.mjs',import.meta.url))),
    catalog_sha256:sha(readFileSync(new URL('../catalog/libs-current-v2.json',import.meta.url)))});
  const identities=new Map([['v'+prior.version,'v'+compiler.version],
    ...['compiler_sha256','facade_sha256','catalog_sha256'].map(key=>[prior[key],protocol.release_binding[key]])]);
  for(const row of protocol.cases)for(const key of ['required_literals','allowed_sha256'])
    if(row.answer_contract?.[key])row.answer_contract[key]=row.answer_contract[key].map(value=>identities.get(value)??value);
}
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

const singlePolicy='glm-5.3-flash-single-v1',single=structuredClone(receipt);
single.schema='wasmc.pi-pre-release-qualification/v2';single.qualification_policy=singlePolicy;
single.models=single.models.filter(row=>row.identity==='glm-5.3-flash');
single.controlled_pair_accepted=false;single.single_model_accepted=true;
assert.equal(validateQualification(candidate,release,commit,tree,single,protocol,singlePolicy),true);
assert.throws(()=>validateQualification(candidate,release,commit,tree,single,protocol),'single cannot satisfy default pair policy');
assert.throws(()=>validateQualification(candidate,release,commit,tree,receipt,protocol,singlePolicy),'pair receipt cannot impersonate single policy');
let singleControls=0;
for(const mutate of [
 value=>value.qualification_policy='controlled-pair-v1',
 value=>value.controlled_pair_accepted=true,
 value=>value.single_model_accepted=false,
 value=>value.models[0].identity='deepseek-v4.1-flash',
 value=>value.models.push(structuredClone(value.models[0])),
 value=>value.models[0].cases.pop(),
 value=>value.models[0].cases[1].id=value.models[0].cases[0].id,
 value=>value.models[0].cases[0].error_results=1,
 value=>value.models[0].cases[0].retries=1,
 value=>value.models[0].cases[0].oracle_passed=false,
 value=>value.models[0].white_box_pass=false,
 value=>value.release.rehearsal_commit='2'.repeat(40),
 value=>value.release.rehearsal_tree='2'.repeat(40),
 value=>value.protocol_sha256='0'.repeat(64),
 value=>value.review.independent_from_model_self_assessment=false
]){const invalid=structuredClone(single);mutate(invalid);
 assert.throws(()=>validateQualification(candidate,release,commit,tree,invalid,protocol,singlePolicy));singleControls++;}
const historical=structuredClone(candidate);historical.version='0.0.23';
assert.throws(()=>validateQualification(historical,{...release,version:historical.version,tag:'v0.0.23',staged_product_manifest:'channels/candidates/0.0.23.json'},commit,tree,single,protocol,singlePolicy));
assert.throws(()=>validateQualification(candidate,release,commit,tree,single,protocol,'arbitrary-single-model'));
console.log(JSON.stringify({ accepted: true, rejects_stale_rehearsal_commit_or_tree: true, rejects_candidate_or_product_drift: true, rejects_incomplete_pair: true, rejects_structural_or_white_box_failure: true, rejects_retry_or_wrong_first_answer: true, rejects_protocol_or_bound_artifact_drift:true,explicit_glm_single_model_accepted:true,single_model_negative_controls:singleControls+4,historical_pair_default_preserved:true,live_model_run:false }));
