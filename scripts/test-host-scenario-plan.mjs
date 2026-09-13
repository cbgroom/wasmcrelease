import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const plan = JSON.parse(await readFile(new URL('host/scenarios/plan.json', root)));
const families = ['describe','open','read','write','invoke','wait','cancel','release','clock-read','entropy-fill','window-acquire','window-commit'];
assert.equal(plan.uniform_v1_accepted, false);
assert.equal(plan.scenarios.length, 5);
assert.equal(new Set(plan.scenarios.map(s=>s.id)).size, 5);
assert.equal(new Set(plan.platform_targets).size, 11);
const covered = new Set();
for (const s of plan.scenarios) {
  assert.equal(s.uniform_v1_status, 'planned');
  assert.equal(new Set(s.families).size, s.families.length);
  assert.ok(s.browser_execution && s.mobile_execution.includes('device'));
  for (const f of s.families) { assert.ok(families.includes(f)); covered.add(f); }
}
assert.deepEqual([...covered].sort(), families.sort());
for (const key of ['preflight_counts_as_v1_execution','unsupported_counts_as_positive_execution','compile_counts_as_device_execution','fetch_counts_as_raw_tcp']) assert.equal(plan.evidence_policy[key], false);
assert.equal(plan.evidence_policy.typed_wasmc_rust_equivalence_required, true);
assert.equal(plan.evidence_policy.exact_source_receipts_required, true);
console.log('PASS five scenarios cover 12 candidate Host families; no preflight or unsupported result counted as v1 execution');
