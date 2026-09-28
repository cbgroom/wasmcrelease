#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const model = JSON.parse(await readFile(new URL("../runtime/client-foundation-v1/dynamic-lib-graph-model.json", import.meta.url), "utf8"));
const orientation = JSON.parse(await readFile(new URL("../runtime/client-foundation-v1/agent-checkpoint-orientation.json", import.meta.url), "utf8"));
const document = await readFile(new URL("../docs/DYNAMIC_LIB_GRAPH_MODEL.md", import.meta.url), "utf8");
const normalizedDocument = document.replace(/\s+/g, " ");

assert.equal(model.schema, "wasmc.dynamic-lib-graph-model/v1");
assert.equal(model.lifecycle, "prototype-model-not-admitted-not-released");
assert.equal(model.host_boundary, "resource-window-operation-completion-cancel-release");
assert.equal(model.graph_shape, "dag");
assert.equal(orientation.schema, "wasmc.dynamic-client-checkpoint-orientation/v1");
assert.equal(orientation.lifecycle.qualified, true);
for (const state of ["admitted", "released", "discoverable", "installable"]) assert.equal(orientation.lifecycle[state], false);
assert.match(orientation.answer, /not general exactly-once/);
assert.equal(orientation.gateway_invoke_order[4], "Client persists checkpoint and command result in one state-file replacement");
assert.equal(orientation.failure_policy.missing_or_corrupt, "runtime unavailable while control remains connected");
assert.equal(orientation.failure_policy.partial_multi_block_restore, "graph poisoned until close and reconstruction");
assert.deepEqual(orientation.open_gates, ["cross-schema-state-migration-lib", "sticky-active-restart-disposition"]);
assert.equal(orientation.protected_surface.proof_command, "git diff --name-only bed1e4d236bb78a992355321deca8968a6400a0d HEAD -- host current runtime/client-foundation-gateway-v1/cli.mjs");
assert.equal(orientation.protected_surface.expected_output, "");
assert.match(orientation.stop, /sufficient/);

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
  "active-checkpoint-bound-to-graph-identity",
  "invoke-result-and-state-checkpoint-persist-together",
  "checkpoint-restored-before-runtime-available",
  "partial-checkpoint-restore-poisons-graph",
  "close-reclaims-all-runtime-resources",
]) assert.ok(invariants.has(required), `missing invariant: ${required}`);

for (const qualified of model.current_implementation_profile.qualified_invariants) {
  assert.ok(invariants.has(qualified), `qualified invariant is absent from model: ${qualified}`);
}
assert.equal(model.state_contract.authority, "exact-package-descriptor");
assert.equal(model.state_contract.graph_declaration, "exact-match-and-graph-digest-bound");
assert.equal(model.state_contract.gateway_metadata, "derived-from-package-and-verified-before-enqueue");
assert.equal(model.state_contract.client_verification, "after-download-on-cache-read-and-on-restart");
assert.equal(model.state_contract.snapshot_encoding, "canonical-base64");
assert.equal(model.state_contract.max_snapshot_bytes, 1048576);
assert.equal(model.state_contract.migration_barrier_scope, "whole-graph");
assert.deepEqual(model.state_contract.active_checkpoint, {
  schema: "wasmc.dynamic-lib-state-checkpoint/v1",
  per_block_max_decoded_bytes: 1048576,
  client_persisted_max_bytes: 8388608,
  identity: "canonical-json-sha256-bound-to-graph-revision-and-digest",
  publication: "persisted-with-active-graph-before-barrier-release",
  invoke: "checkpoint-and-command-result-persisted-together-before-receipt",
  restart: "restore-before-runtime-available",
  missing_or_corrupt: "runtime-unavailable-control-remains-connected",
  partial_restore_failure: "graph-poisoned-until-close-and-reconstruction",
});
assert.deepEqual(model.state_contract.same_schema_order, [
  "install-probe-health-candidate",
  "block-new-invocations",
  "drain-old-generation",
  "snapshot-and-verify-source",
  "restore-target",
  "health-candidate",
  "publish-and-persist-retired-owner",
  "release-invocation-barrier",
  "drain-and-release-retired-generation",
]);
const evidencePaths = [
  "agent_orientation",
  "normative_model",
  "engine",
  "package_spec",
  "client_durability",
  "gateway_binding",
  "focused_qualification",
  "integrated_qualification",
  "publication_crash_fixture",
  "checkpoint_crash_fixture",
  "host_cli_runtime_guard",
].map((key) => model.white_box_evidence[key]);
for (const relative of evidencePaths) {
  assert.equal(typeof relative, "string");
  await readFile(new URL(`../${relative}`, import.meta.url));
}
for (const relative of Object.values(orientation.evidence)) await readFile(new URL(`../${relative}`, import.meta.url));
assert.deepEqual(model.white_box_evidence.commands, [
  "node scripts/test-dynamic-lib-stateful-v1.mjs",
  "node scripts/validate-dynamic-lib-graph-model-v1.mjs",
  "node scripts/test-dynamic-client-foundation-gateway-v1.mjs",
]);
assert.equal(model.white_box_evidence.protected_change_scope_base, "bed1e4d236bb78a992355321deca8968a6400a0d");
assert.equal(model.white_box_evidence.protected_change_scope_command, "git diff --name-only bed1e4d236bb78a992355321deca8968a6400a0d HEAD -- host current runtime/client-foundation-gateway-v1/cli.mjs");
assert.equal(model.current_implementation_profile.graph_shape, "serial-pipeline-and-general-dag-client-gateway");
assert.equal(model.current_implementation_profile.state_policy, "stateless-sticky-and-same-schema-snapshot-v1");
assert.equal(model.current_implementation_profile.graph_identity, "canonical-json-sha256");
assert.equal(model.current_implementation_profile.configuration, "canonical-json-sha256");
assert.equal(model.current_implementation_profile.wit_contract_identity, "wasm-tools-derived-port-type-sha256-bound-to-exact-wit");
assert.equal(model.current_implementation_profile.retired_cleanup, "durable-publication-ledger-and-process-owner-fence");
assert.equal(model.current_implementation_profile.stateful_restart, "snapshot-v1-active-checkpoint-with-invoke-result-binding");
for (const gate of ["cross-schema-state-migration-lib", "sticky-active-restart-disposition"]) {
  assert.ok(model.current_implementation_profile.open_gates.includes(gate), `missing open gate: ${gate}`);
}

for (const phrase of [
  "The Host remains fixed",
  "A serial pipeline is merely a DAG",
  "A candidate is never observable",
  "Same code does not imply the same instance",
  "Unknown or incomplete state policy fails closed",
  "Start here for the complete implemented state contract",
  "The barrier is graph-wide",
  "checkpoint and command result are written in one Client state transaction",
  "Missing, stale or corrupt checkpoint identity leaves runtime unavailable",
  "the graph is marked restore-failed",
  "use this bounded evidence index instead of searching the repository",
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
