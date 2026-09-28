#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const model = JSON.parse(await readFile(new URL("../runtime/client-foundation-v1/dynamic-lib-graph-model.json", import.meta.url), "utf8"));
const orientation = JSON.parse(await readFile(new URL("../runtime/client-foundation-v1/agent-checkpoint-orientation.json", import.meta.url), "utf8"));
const migrationOrientation = JSON.parse(await readFile(new URL("../runtime/client-foundation-v1/agent-state-migration-orientation.json", import.meta.url), "utf8"));
const migrationProjection = JSON.parse(await readFile(new URL("../agent-client-gateway-state-migration.json", import.meta.url), "utf8"));
const restartProjection = JSON.parse(await readFile(new URL("../agent-client-gateway-state-restart.json", import.meta.url), "utf8"));
const document = await readFile(new URL("../docs/DYNAMIC_LIB_GRAPH_MODEL.md", import.meta.url), "utf8");
const normalizedDocument = document.replace(/\s+/g, " ");

assert.equal(model.schema, "wasmc.dynamic-lib-graph-model/v1");
assert.equal(model.lifecycle, "prototype-model-not-admitted-not-released");
assert.equal(model.host_boundary, "resource-window-operation-completion-cancel-release");
assert.equal(model.graph_shape, "dag");
assert.equal(orientation.schema, "wasmc.dynamic-client-checkpoint-orientation/v1");
assert.match(orientation.rule, /bounded answer route/);
assert.match(orientation.request_classification.rule, /not by itself an implementation-line audit/);
assert.match(orientation.request_classification.implementation_line_audit_requires, /exact source lines/);
assert.equal(orientation.lifecycle.qualified, true);
for (const state of ["admitted", "released", "discoverable", "installable"]) assert.equal(orientation.lifecycle[state], false);
assert.match(orientation.answer, /not general exactly-once/);
assert.deepEqual(orientation.crash_fault_receipt, {
  fixture_exit_code: 87,
  message_id: "dg-22",
  persisted_response: "SV2:2",
  post_restart_get: "SV2:2",
  meaning: "the persisted result was returned and the increment was not replayed",
});
assert.equal(orientation.cross_schema_migration.implemented, true);
assert.match(orientation.cross_schema_migration.binding, /source schema and target schema/);
assert.equal(orientation.gateway_invoke_order[4], "Client persists checkpoint and command result in one state-file replacement");
assert.equal(orientation.failure_policy.missing_or_corrupt, "runtime unavailable while control remains connected");
assert.equal(orientation.failure_policy.partial_multi_block_restore, "graph poisoned until close and reconstruction");
assert.deepEqual(orientation.open_gates, []);
assert.equal(orientation.protected_surface.proof_command, "git diff --name-only bed1e4d236bb78a992355321deca8968a6400a0d HEAD -- host current runtime/client-foundation-gateway-v1/cli.mjs");
assert.equal(orientation.protected_surface.expected_output, "");
assert.deepEqual(orientation.required_additional_reads, []);
assert.match(orientation.final_answer_policy, /Do not reopen/);
assert.match(orientation.stop, /sufficient/);
assert.equal(migrationOrientation.schema, "wasmc.dynamic-client-state-migration-orientation/v1");
assert.equal(migrationProjection.schema, "wasmc.dynamic-client-state-migration-projection/v1");
assert.equal(migrationOrientation.root_projection, "agent-client-gateway-state-migration.json");
assert.equal(migrationProjection.authority_file, "runtime/client-foundation-v1/agent-state-migration-orientation.json");
assert.deepEqual(migrationProjection.lifecycle, migrationOrientation.lifecycle);
assert.deepEqual(migrationProjection.open_gates, migrationOrientation.open_gates);
assert.deepEqual(migrationProjection.not_claimed, migrationOrientation.not_claimed);
assert.deepEqual(migrationProjection.checks, migrationOrientation.verify);
assert.equal(migrationProjection.proved.local, migrationOrientation.qualified_observations.local_cross_schema);
assert.equal(migrationProjection.proved.gateway, migrationOrientation.qualified_observations.gateway_cross_schema);
assert.equal(migrationProjection.proved.restart, migrationOrientation.qualified_observations.target_schema_restart);
assert.match(migrationProjection.rule, /Do not read release orientation/);
assert.match(migrationOrientation.rule, /bounded answer route/);
assert.match(migrationOrientation.request_classification.rule, /not source-line inspection/);
assert.equal(migrationOrientation.lifecycle.qualified, true);
for (const state of ["admitted", "released", "discoverable", "installable"]) assert.equal(migrationOrientation.lifecycle[state], false);
assert.match(migrationOrientation.lifecycle_authority.stopping_rule, /Do not search release\.json/);
assert.match(migrationOrientation.adjacent_route_boundary, /not required/);
assert.equal(migrationOrientation.authority.plan_schema, "wasmc.dynamic-lib-state-migration-plan/v1");
assert.match(migrationOrientation.stable_graph, /ephemeral transition dependency/);
assert.deepEqual(migrationOrientation.open_gates, []);
assert.deepEqual(migrationOrientation.required_additional_reads, []);
assert.equal(migrationOrientation.white_box_binding_receipt.plan_derivation_symbol, "describeStateMigrations");
assert.equal(migrationOrientation.white_box_binding_receipt.engine_operation, "migrate-state-v1");
assert.match(migrationOrientation.white_box_binding_receipt.integrated_oracle, /SV2:2->SV3:2/);
assert.match(migrationOrientation.final_answer_policy, /Do not open the model/);
assert.match(migrationOrientation.stop, /No additional read is required/);
assert.equal(restartProjection.schema, "wasmc.dynamic-client-state-restart-projection/v1");
assert.equal(restartProjection.authority_file, "runtime/client-foundation-v1/agent-checkpoint-orientation.json");
assert.deepEqual(restartProjection.lifecycle, orientation.lifecycle);
assert.deepEqual(restartProjection.state_model_open_gates, orientation.open_gates);
assert.deepEqual(restartProjection.checks, orientation.verify);
assert.equal(restartProjection.sticky.proved, orientation.qualified_observations.sticky_explicit_reset_client_restart);
assert.match(restartProjection.sticky.identity, /canonical graph digest/);
assert.match(restartProjection.host_boundary, /fixed Host API and minimal CLI are unchanged/);
assert.match(restartProjection.rule, /Do not read release orientation/);

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
  "cross-schema-migration-requires-exact-plan-and-package",
  "migration-resource-is-ephemeral",
  "sticky-restart-requires-identity-bound-disposition",
  "sticky-reset-completes-before-runtime-available",
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
assert.deepEqual(model.state_contract.cross_schema_migration, {
  plan_schema: "wasmc.dynamic-lib-state-migration-plan/v1",
  identity: "canonical-json-sha256-over-node-package-wit-configuration-and-schema-pair",
  package_contract: "exact-state-migration-descriptor-with-snapshot-v1-protocol",
  lifetime: "ephemeral-transition-resource-released-before-publication",
  ordering: "drain-snapshot-migrate-validate-restore-health-publish",
  failure: "candidate-rollback-old-generation-remains-active",
});
assert.deepEqual(model.state_contract.sticky_restart, {
  graph_identity: "exact-fail-closed-or-reset-on-restart-disposition",
  default: "no-implicit-disposition-accepted",
  reset_operation: "reset-state-v1-over-fixed-host-boundary",
  ordering: "reset-validate-health-before-runtime-available",
  failure: "runtime-unavailable-control-remains-connected",
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
  "migration_agent_orientation",
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
const orientationEvidence = Object.fromEntries(await Promise.all(Object.entries(orientation.evidence).map(async ([key, relative]) => [key, await readFile(new URL(`../${relative}`, import.meta.url), "utf8")])));
const migrationEvidence = Object.fromEntries(await Promise.all(Object.entries(migrationOrientation.evidence).map(async ([key, relative]) => [key, await readFile(new URL(`../${relative}`, import.meta.url), "utf8")])));
assert.match(orientationEvidence.client, /active-state-checkpointed/);
assert.match(orientationEvidence.client, /inflight_result/);
assert.match(orientationEvidence.graph, /restoreFailed = true/);
assert.match(orientationEvidence.graph, /migrate-state-v1/);
assert.match(orientationEvidence.graph, /reset-state-v1/);
assert.match(orientationEvidence.package_spec, /dynamic-lib-state-migration-plan\/v1/);
assert.match(orientationEvidence.gateway, /invalid client state checkpoint summary/);
assert.match(orientationEvidence.focused_test, /partial_checkpoint_restore_poisoned_until_close: true/);
assert.match(orientationEvidence.focused_test, /sticky_explicit_reset_restart: "STICKY-RESET:0"/);
for (const claim of [
  "stateful_active_checkpoint_restart",
  "invoke_checkpoint_crash_recovered_without_replay",
  "gateway_observed_checkpoint_identity",
  "missing_or_corrupt_checkpoint_failed_closed",
  "sticky_explicit_reset_client_restart",
]) assert.match(orientationEvidence.integrated_test, new RegExp(`${claim}:`));
assert.match(orientationEvidence.crash_fixture, /process\.exit\(87\)/);
assert.match(orientationEvidence.host_cli_guard, /fixed Host or minimal CLI changed/);
assert.match(migrationEvidence.package_and_plan, /dynamic-lib-state-migration-plan\/v1/);
assert.match(migrationEvidence.engine, /migrate-state-v1/);
assert.match(migrationEvidence.client, /describeStateMigrations/);
assert.match(migrationEvidence.gateway, /migration bundle contract mismatch/);
assert.match(migrationEvidence.focused_test, /cross_schema_broken_migration_rolled_back: true/);
assert.match(migrationEvidence.integrated_test, /stateful_cross_schema_gateway_migration: "SV2:2->SV3:2"/);
assert.match(migrationEvidence.integrated_test, /stateful_cross_schema_restart: "SV3:2"/);
assert.deepEqual(orientation.qualified_observations, {
  active_checkpoint_restored: "SV2:2",
  invoke_checkpoint_crash_recovered_without_replay: true,
  gateway_observed_checkpoint_identity: true,
  missing_or_corrupt_checkpoint_failed_closed: true,
  partial_checkpoint_restore_poisoned_until_close: true,
  cross_schema_gateway_migration: "SV2:2->SV3:2",
  cross_schema_restart: "SV3:2",
  forged_migration_contract_rejected_at_gateway: true,
  sticky_explicit_reset_client_restart: "STICKY:1->STICKY:0",
  external_effect_exactly_once_claimed: false,
  fixed_host_api_changed: false,
  minimal_cli_changed: false,
});
assert.deepEqual(model.white_box_evidence.commands, [
  "node scripts/test-dynamic-lib-stateful-v1.mjs",
  "node scripts/validate-dynamic-lib-graph-model-v1.mjs",
  "node scripts/test-dynamic-client-foundation-gateway-v1.mjs",
]);
assert.equal(model.white_box_evidence.protected_change_scope_base, "bed1e4d236bb78a992355321deca8968a6400a0d");
assert.equal(model.white_box_evidence.protected_change_scope_command, "git diff --name-only bed1e4d236bb78a992355321deca8968a6400a0d HEAD -- host current runtime/client-foundation-gateway-v1/cli.mjs");
assert.equal(model.current_implementation_profile.graph_shape, "serial-pipeline-and-general-dag-client-gateway");
assert.equal(model.current_implementation_profile.state_policy, "stateless-sticky-explicit-restart-disposition-and-snapshot-v1-with-exact-cross-schema-migration");
assert.equal(model.current_implementation_profile.graph_identity, "canonical-json-sha256");
assert.equal(model.current_implementation_profile.configuration, "canonical-json-sha256");
assert.equal(model.current_implementation_profile.wit_contract_identity, "wasm-tools-derived-port-type-sha256-bound-to-exact-wit");
assert.equal(model.current_implementation_profile.retired_cleanup, "durable-publication-ledger-and-process-owner-fence");
assert.equal(model.current_implementation_profile.stateful_restart, "snapshot-v1-checkpoint-restore-and-sticky-explicit-reset-or-fail-closed");
assert.deepEqual(model.current_implementation_profile.open_gates, []);

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
  "restart behavior is explicit and identity-bound",
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
