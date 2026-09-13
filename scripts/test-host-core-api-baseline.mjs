import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const baseline = JSON.parse(readFileSync(new URL('../host/core-api-v1-baseline.json', import.meta.url)));
function validate(b) {
  assert.equal(b.schema, 'wasmc.host-core-api.baseline/v1');
  assert.equal(b.revision, '1.0.0-draft.1');
  assert.equal(b.status, 'candidate');
  assert.equal(b.runtime_abi_accepted, false);
  assert.equal(b.physical_signatures, null);
  assert.equal(b.count_scope, 'mechanism-families-not-physical-import-count');
  assert.equal(b.design_budget, 20);
  assert.ok(b.inventory.length <= b.design_budget);
  const names = b.inventory.map(a => a.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.every(n => /^[a-z]+(?:-[a-z]+)*$/.test(n)));
  assert.equal(new Set(names.map(n => n.replaceAll('-', '_'))).size, names.length);
  const semantic = ['describe','open','read','write','invoke','wait','cancel','release','clock-read','entropy-fill'];
  const carrier = ['window-acquire','window-commit'];
  assert.deepEqual(b.inventory.filter(a => a.group === 'semantic').map(a => a.name), semantic);
  assert.deepEqual(b.inventory.filter(a => a.group === 'carrier').map(a => a.name), carrier);
  assert.equal(b.inventory.length, semantic.length + carrier.length);
  assert.equal(b.inventory.find(a => a.name === 'describe').effect, 'none');
  assert.ok(b.core_carrier.required.includes('copy-windows'));
  assert.ok(b.core_carrier.required.includes('correlated-completion'));
  assert.ok(b.core_carrier.required.includes('scoped-identity'));
  assert.ok(b.core_carrier.required.every(f => !b.core_carrier.optional.includes(f)));
  assert.equal(b.core_carrier.window_helpers_required, true);
  assert.equal(b.core_carrier.guest_raw_handles, false);
  assert.equal(b.core_carrier.general_allocation_owner, 'corelib');
  assert.equal(b.core_carrier.unknown_operation_policy, 'reject-before-effect');
  for (const key of ['cancel_is_rollback','wait_timeout_cancels_operation','timeout_force_releases','busy_release_consumes','automatic_replay']) {
    assert.equal(b.lifecycle[key], false, key);
  }
  for (const key of ['quota_counts_quarantine','quota_counts_undelivered_results','retirement_requires_stop_close_ack','completion_correlation_required']) {
    assert.equal(b.lifecycle[key], true, key);
  }
  assert.equal(b.platform_policy, 'explicit-negotiated-capabilities-no-silent-fallback');
  assert.equal(b.semantic_wit, 'pending-v1-review-not-v0-host.wit');
  assert.equal(b.normative_reference, 'CORE_API_V1_BASELINE.md');
  assert.ok(readFileSync(new URL(`../host/${b.normative_reference}`, import.meta.url)).length > 0);
}
validate(baseline);
const mutations = [
  b => b.inventory.push({...b.inventory[0]}),
  b => { b.inventory[0].name = 'describe_raw'; },
  b => { b.runtime_abi_accepted = true; },
  b => { b.physical_signatures = {}; },
  b => { b.design_budget = 21; },
  b => { b.core_carrier.window_helpers_required = false; },
  b => { b.core_carrier.optional.push('copy-windows'); },
  b => { b.core_carrier.guest_raw_handles = true; },
  b => { b.core_carrier.general_allocation_owner = 'host'; },
  b => { b.lifecycle.cancel_is_rollback = true; },
  b => { b.lifecycle.wait_timeout_cancels_operation = true; },
  b => { b.lifecycle.timeout_force_releases = true; },
  b => { b.lifecycle.busy_release_consumes = true; },
  b => { b.lifecycle.quota_counts_quarantine = false; },
  b => { b.lifecycle.quota_counts_undelivered_results = false; },
  b => { b.lifecycle.completion_correlation_required = false; },
  b => { b.semantic_wit = 'v0/host.wit'; },
];
for (const mutate of mutations) {
  const invalid = structuredClone(baseline);
  mutate(invalid);
  assert.throws(() => validate(invalid));
}
console.log(JSON.stringify({accepted: true, scope: 'candidate-inventory-invariants-not-runtime-proof',
  mechanism_families: baseline.inventory.length, design_budget: baseline.design_budget,
  negative_controls: mutations.length, runtime_abi_accepted: false}));
