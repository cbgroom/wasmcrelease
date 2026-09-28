#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const model = JSON.parse(await readFile(new URL("../runtime/client-foundation-v1/dynamic-lib-graph-model.json", import.meta.url), "utf8"));
const document = await readFile(new URL("../docs/DYNAMIC_LIB_GRAPH_MODEL.md", import.meta.url), "utf8");
const normalizedDocument = document.replace(/\s+/g, " ");

assert.equal(model.schema, "wasmc.dynamic-lib-graph-model/v1");
assert.equal(model.lifecycle, "prototype-model-not-admitted-not-released");
assert.equal(model.host_boundary, "resource-window-operation-completion-cancel-release");
assert.equal(model.graph_shape, "dag");

const phases = new Set(model.manager_phases);
assert.equal(phases.size, model.manager_phases.length);
for (const required of ["stable", "preparing", "draining", "closed"]) assert.ok(phases.has(required), `missing phase: ${required}`);

const transitionKeys = new Set();
for (const transition of model.transitions) {
  assert.ok(phases.has(transition.from), `unknown transition source: ${transition.from}`);
  assert.ok(phases.has(transition.to), `unknown transition target: ${transition.to}`);
  const key = `${transition.event}:${transition.from}`;
  assert.ok(!transitionKeys.has(key), `ambiguous transition: ${key}`);
  transitionKeys.add(key);
}
for (const required of [
  "apply-request:stable",
  "prepare-failed:preparing",
  "publish:preparing",
  "drain-complete:draining",
  "cleanup-failed:draining",
  "close:stable",
]) assert.ok(transitionKeys.has(required), `missing transition: ${required}`);

const invariants = new Set(model.invariants);
assert.equal(invariants.size, model.invariants.length);
for (const required of [
  "single-active-generation",
  "candidate-not-observable",
  "invoke-captures-one-generation",
  "referenced-resource-not-released",
  "prepublish-failure-preserves-active",
  "postpublish-cleanup-never-rolls-back",
  "reuse-requires-full-instance-identity",
  "exact-wit-port-compatibility",
  "package-bound-state-contract",
  "snapshot-after-old-generation-drain",
  "new-invocations-wait-for-stateful-publish-or-rollback",
  "close-reclaims-all-runtime-resources",
]) assert.ok(invariants.has(required), `missing invariant: ${required}`);

for (const qualified of model.current_implementation_profile.qualified_invariants) {
  assert.ok(invariants.has(qualified), `qualified invariant is absent from model: ${qualified}`);
}
assert.equal(model.current_implementation_profile.graph_shape, "serial-pipeline-and-general-dag-client-gateway");
assert.equal(model.current_implementation_profile.state_policy, "stateless-sticky-and-same-schema-snapshot-v1");
assert.equal(model.current_implementation_profile.graph_identity, "canonical-json-sha256");
assert.equal(model.current_implementation_profile.configuration, "canonical-json-sha256");
assert.equal(model.current_implementation_profile.wit_contract_identity, "wasm-tools-derived-port-type-sha256-bound-to-exact-wit");
assert.equal(model.current_implementation_profile.retired_cleanup, "durable-publication-ledger-and-process-owner-fence");
for (const gate of ["cross-schema-state-migration-lib", "stateful-active-checkpoint-restart"]) {
  assert.ok(model.current_implementation_profile.open_gates.includes(gate), `missing open gate: ${gate}`);
}

for (const phrase of [
  "The Host remains fixed",
  "A serial pipeline is merely a DAG",
  "A candidate is never observable",
  "Same code does not imply the same instance",
  "Unknown or incomplete state policy fails closed",
]) assert.ok(normalizedDocument.includes(phrase), `model document missing rule: ${phrase}`);

console.log(JSON.stringify({
  accepted: true,
  schema: model.schema,
  phases: model.manager_phases.length,
  transitions: model.transitions.length,
  invariants: model.invariants.length,
  implementation_profile: model.current_implementation_profile.graph_shape,
  open_gates: model.current_implementation_profile.open_gates.length,
  fixed_host_api_changed: false,
}));
