import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";

const run = (script) => execFileSync(process.execPath, [script], { encoding: "utf8" }).trim();
const focused = [
  "scripts/validate-host-layout.mjs",
  "scripts/test-host-lib-defined-boundary.mjs",
  "scripts/validate-host-camera-model.mjs",
  "scripts/validate-release-surfaces.mjs",
  "scripts/test-lib-defined-boundary-runtime.mjs",
  "scripts/validate-libsrc.mjs",
  "scripts/validate-android-agent-computer.mjs",
  "scripts/validate-ios-simulator-observation.mjs",
  "scripts/validate-ios-app-capability.mjs",
  "scripts/validate-ios-app-surface-control.mjs",
  "scripts/validate-system-agent-lab.mjs",
  "scripts/validate-android-system-agent-lab.mjs",
  "scripts/test-platform-profile-resolver.mjs",
];
for (const script of focused) run(script);
const digest = (relative) => createHash("sha256").update(fs.readFileSync(relative)).digest("hex");
const digestAt = (revision, relative) => createHash("sha256")
  .update(execFileSync("git", ["show", `${revision}:${relative}`]))
  .digest("hex");

const iosAppReceipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v1.json", "utf8",
));
assert.equal(iosAppReceipt.schema, "wasmc.host-lib-defined-boundary-ios-app-qualification/v1");
assert.equal(iosAppReceipt.status, "ios-26.5-arm64-simulator-app-internal-qualified-not-admitted-not-released");
assert.equal(iosAppReceipt.qualified, true);
assert.equal(iosAppReceipt.admitted, false);
assert.equal(iosAppReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${iosAppReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosAppReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosAppReceipt.source)) {
  assert.equal(digestAt(iosAppReceipt.implementation_commit, relative), expected,
    `${relative}: retained iOS app qualification source drift`);
}
assert.equal(iosAppReceipt.evidence.status, "PASS");
assert.equal(iosAppReceipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosAppReceipt.evidence.statically_registered_lib_providers, 6);
assert.deepEqual(iosAppReceipt.evidence.host_negative_controls, {
  duplicate_identity_rejected: true,
  invalid_descriptor_rejected: true,
  output_limit_rejected: true,
});
assert.equal(iosAppReceipt.evidence.keychain_add_read_delete, true);
assert.equal(iosAppReceipt.evidence.foreground_semantic_ui, true);
assert.equal(iosAppReceipt.evidence.metal_command_buffer_copy, true);
assert.equal(iosAppReceipt.evidence.physical_device_qualification, false);
assert.equal(iosAppReceipt.evidence.wasm_lowering, false);

const iosAppV2Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v2.json", "utf8",
));
assert.equal(iosAppV2Receipt.schema, "wasmc.host-lib-defined-boundary-ios-app-qualification/v2");
assert.equal(iosAppV2Receipt.status, "ios-26.5-arm64-simulator-app-internal-v2-qualified-not-admitted-not-released");
assert.equal(iosAppV2Receipt.qualified, true);
assert.equal(iosAppV2Receipt.admitted, false);
assert.equal(iosAppV2Receipt.released, false);
execFileSync("git", ["cat-file", "-e", `${iosAppV2Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosAppV2Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosAppV2Receipt.source)) {
  assert.equal(digestAt(iosAppV2Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS app v2 qualification source drift`);
}
assert.equal(iosAppV2Receipt.evidence.status, "PASS");
assert.equal(iosAppV2Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosAppV2Receipt.evidence.fixed_host_byte_identical_to_v1, true);
assert.equal(iosAppV2Receipt.evidence.fixed_host_sha256, iosAppReceipt.source[
  "host/tests/ios-app-capability/Host/FixedHost.swift"
]);
assert.equal(iosAppV2Receipt.evidence.statically_registered_lib_providers, 11);
assert.equal(iosAppV2Receipt.evidence.sqlite_wal_transaction_prepared_roundtrip, true);
assert.equal(iosAppV2Receipt.evidence.aes_gcm_roundtrip, true);
assert.equal(iosAppV2Receipt.evidence.offline_audio_render.non_silent, true);
assert.equal(iosAppV2Receipt.evidence.webkit_html_dom_javascript, true);
assert.equal(iosAppV2Receipt.evidence.protected_capabilities_permission_requested, false);
assert.equal(iosAppV2Receipt.evidence.physical_device_qualification, false);
assert.equal(iosAppV2Receipt.evidence.wasm_lowering, false);

const iosAppV3Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v3.json", "utf8",
));
assert.equal(iosAppV3Receipt.schema, "wasmc.host-lib-defined-boundary-ios-app-qualification/v3");
assert.equal(iosAppV3Receipt.status, "ios-26.5-arm64-simulator-app-internal-v3-qualified-not-admitted-not-released");
assert.equal(iosAppV3Receipt.qualified, true);
assert.equal(iosAppV3Receipt.admitted, false);
assert.equal(iosAppV3Receipt.released, false);
execFileSync("git", ["cat-file", "-e", `${iosAppV3Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosAppV3Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosAppV3Receipt.source)) {
  assert.equal(digestAt(iosAppV3Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS app v3 qualification source drift`);
}
assert.equal(iosAppV3Receipt.evidence.status, "PASS");
assert.equal(iosAppV3Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosAppV3Receipt.evidence.fixed_host_byte_identical_to_v1_and_v2, true);
assert.equal(iosAppV3Receipt.evidence.fixed_host_sha256, iosAppReceipt.source[
  "host/tests/ios-app-capability/Host/FixedHost.swift"
]);
assert.equal(iosAppV3Receipt.evidence.statically_registered_lib_providers, 12);
assert.equal(iosAppV3Receipt.evidence.permission_free_capabilities, 13);
assert.equal(iosAppV3Receipt.evidence.protected_categories_observed, 10);
assert.equal(iosAppV3Receipt.evidence.discovery_prompt_count, 0);
assert.equal(iosAppV3Receipt.evidence.persistent_attempt_ledger_roundtrip, true);
assert.equal(iosAppV3Receipt.evidence.policy_state_machine_tests, true);
assert.equal(iosAppV3Receipt.evidence.os_prompts_coalesced_across_categories, false);
assert.equal(iosAppV3Receipt.evidence.physical_device_prompt_callbacks, false);
assert.equal(iosAppV3Receipt.evidence.wasm_lowering, false);

const iosAppV4Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v4.json", "utf8",
));
assert.equal(iosAppV4Receipt.schema, "wasmc.host-lib-defined-boundary-ios-app-qualification/v4");
assert.equal(iosAppV4Receipt.status, "ios-26.5-arm64-simulator-app-internal-v4-qualified-not-admitted-not-released");
assert.equal(iosAppV4Receipt.qualified, true);
assert.equal(iosAppV4Receipt.admitted, false);
assert.equal(iosAppV4Receipt.released, false);
assert.equal(iosAppV4Receipt.discoverable, false);
assert.equal(iosAppV4Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosAppV4Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosAppV4Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosAppV4Receipt.source)) {
  assert.equal(digestAt(iosAppV4Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS app v4 qualification source drift`);
}
assert.equal(iosAppV4Receipt.evidence.status, "PASS");
assert.equal(iosAppV4Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosAppV4Receipt.evidence.fixed_host_byte_identical_to_v1_v2_and_v3, true);
assert.equal(iosAppV4Receipt.evidence.fixed_host_sha256, iosAppReceipt.source[
  "host/tests/ios-app-capability/Host/FixedHost.swift"
]);
assert.equal(iosAppV4Receipt.evidence.statically_registered_lib_providers, 12);
assert.equal(iosAppV4Receipt.evidence.authorization_policy_candidate,
  "wasmc-app-authorization-policy@0.0.1-dev.2");
assert.equal(iosAppV4Receipt.evidence.discovery_prompt_count, 0);
assert.equal(iosAppV4Receipt.evidence.repeat_request_after_unsuccessful_attempt, true);
assert.equal(iosAppV4Receipt.evidence.in_flight_request_deduplicated, true);
assert.equal(iosAppV4Receipt.evidence.denied_routes_to_settings_and_can_be_reoffered, true);
assert.equal(iosAppV4Receipt.evidence.persistent_attempt_history_roundtrip, true);
assert.equal(iosAppV4Receipt.evidence.physical_device_prompt_callbacks, false);
assert.equal(iosAppV4Receipt.evidence.wasm_lowering, false);

const iosAppV5Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v5.json", "utf8",
));
assert.equal(iosAppV5Receipt.schema, "wasmc.host-lib-defined-boundary-ios-app-qualification/v5");
assert.equal(iosAppV5Receipt.status, "ios-26.5-arm64-simulator-app-internal-v5-qualified-not-admitted-not-released");
assert.equal(iosAppV5Receipt.qualified, true);
assert.equal(iosAppV5Receipt.admitted, false);
assert.equal(iosAppV5Receipt.released, false);
assert.equal(iosAppV5Receipt.discoverable, false);
assert.equal(iosAppV5Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosAppV5Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosAppV5Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosAppV5Receipt.source)) {
  assert.equal(digestAt(iosAppV5Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS app v5 qualification source drift`);
}
assert.equal(iosAppV5Receipt.evidence.status, "PASS");
assert.equal(iosAppV5Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosAppV5Receipt.evidence.fixed_host_byte_identical_to_v1_v2_v3_and_v4, true);
assert.equal(iosAppV5Receipt.evidence.fixed_host_sha256, iosAppReceipt.source[
  "host/tests/ios-app-capability/Host/FixedHost.swift"
]);
assert.equal(iosAppV5Receipt.evidence.statically_registered_lib_providers, 13);
assert.equal(iosAppV5Receipt.evidence.wit_packages_parsed, 13);
assert.equal(iosAppV5Receipt.evidence.authorization_lib_observed_contacts_authorized, true);
assert.equal(iosAppV5Receipt.evidence.authorization_lib_plan_after_grant, "no-request");
assert.equal(iosAppV5Receipt.evidence.contacts_create_fetch_delete_roundtrip, true);
assert.equal(iosAppV5Receipt.evidence.contacts_cleanup_confirmed, true);
assert.equal(iosAppV5Receipt.evidence.contacts_reset_control_use_attempted, false);
assert.equal(iosAppV5Receipt.evidence.real_user_prompt_flow, false);
assert.equal(iosAppV5Receipt.evidence.wasm_lowering, false);

const iosAppV6Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v6.json", "utf8",
));
assert.equal(iosAppV6Receipt.schema, "wasmc.host-lib-defined-boundary-ios-app-qualification/v6");
assert.equal(iosAppV6Receipt.status, "ios-26.5-arm64-simulator-app-internal-v6-qualified-not-admitted-not-released");
assert.equal(iosAppV6Receipt.qualified, true);
assert.equal(iosAppV6Receipt.admitted, false);
assert.equal(iosAppV6Receipt.released, false);
assert.equal(iosAppV6Receipt.discoverable, false);
assert.equal(iosAppV6Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosAppV6Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosAppV6Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosAppV6Receipt.source)) {
  assert.equal(digestAt(iosAppV6Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS app v6 qualification source drift`);
}
assert.equal(iosAppV6Receipt.evidence.status, "PASS");
assert.equal(iosAppV6Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosAppV6Receipt.evidence.fixed_host_byte_identical_to_v1_v2_v3_v4_and_v5, true);
assert.equal(iosAppV6Receipt.evidence.fixed_host_sha256, iosAppReceipt.source[
  "host/tests/ios-app-capability/Host/FixedHost.swift"
]);
assert.equal(iosAppV6Receipt.evidence.full_profile_statically_registered_lib_providers, 13);
assert.equal(iosAppV6Receipt.evidence.authorization_flow_profile_lib_providers, 3);
assert.equal(iosAppV6Receipt.evidence.real_localized_system_prompt_driven_by_xcuitest, true);
assert.equal(iosAppV6Receipt.evidence.allow_request_attempt_count, 1);
assert.equal(iosAppV6Receipt.evidence.allow_resulting_state, "authorized");
assert.equal(iosAppV6Receipt.evidence.allow_resulting_plan, "no-request");
assert.equal(iosAppV6Receipt.evidence.allow_contacts_create_fetch_delete_roundtrip, true);
assert.equal(iosAppV6Receipt.evidence.deny_request_attempt_count, 1);
assert.equal(iosAppV6Receipt.evidence.deny_resulting_state, "denied");
assert.equal(iosAppV6Receipt.evidence.deny_resulting_plan, "open-settings");
assert.equal(iosAppV6Receipt.evidence.deny_contacts_use_attempted, false);
assert.equal(iosAppV6Receipt.evidence.post_authorization_active_state_resumption, true);
assert.equal(iosAppV6Receipt.evidence.webkit_nonpersistent_data_store, true);
assert.equal(iosAppV6Receipt.evidence.settings_return_reconciliation, false);
assert.equal(iosAppV6Receipt.evidence.physical_device_qualification, false);
assert.equal(iosAppV6Receipt.evidence.wasm_lowering, false);

const iosSurfaceReceipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v1.json", "utf8",
));
assert.equal(iosSurfaceReceipt.schema,
  "wasmc.host-lib-defined-boundary-ios-app-surface-control-qualification/v1");
assert.equal(iosSurfaceReceipt.status,
  "ios-26.5-arm64-simulator-app-surface-control-v1-qualified-not-admitted-not-released");
assert.equal(iosSurfaceReceipt.qualified, true);
assert.equal(iosSurfaceReceipt.admitted, false);
assert.equal(iosSurfaceReceipt.released, false);
assert.equal(iosSurfaceReceipt.discoverable, false);
assert.equal(iosSurfaceReceipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosSurfaceReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosSurfaceReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosSurfaceReceipt.source)) {
  assert.equal(digestAt(iosSurfaceReceipt.implementation_commit, relative), expected,
    `${relative}: retained iOS surface-control qualification source drift`);
}
assert.equal(iosSurfaceReceipt.evidence.status, "PASS");
assert.equal(iosSurfaceReceipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosSurfaceReceipt.evidence.fixed_host_sha256, iosAppReceipt.source[
  "host/tests/ios-app-capability/Host/FixedHost.swift"
]);
assert.equal(iosSurfaceReceipt.evidence.surface_count, 5);
assert.equal(iosSurfaceReceipt.evidence.qualified_surface_kind, "native");
assert.equal(iosSurfaceReceipt.evidence.all_qualified_surfaces_are_uikit_views, true);
assert.equal(iosSurfaceReceipt.evidence.agent_physical_input_injection, false);
assert.equal(iosSurfaceReceipt.evidence.real_human_input_via_xcuitest, true);
assert.ok(iosSurfaceReceipt.evidence.blocked_agent_actions_during_handoff > 0);
assert.equal(iosSurfaceReceipt.evidence.agent_mutations_committed_to_human_owned_surface, 0);
assert.equal(iosSurfaceReceipt.evidence.background_surfaces_progressed_during_handoff, true);
assert.equal(iosSurfaceReceipt.evidence.same_surface_instance_preserved_across_expand_contract, true);
assert.equal(iosSurfaceReceipt.evidence.agent_resumed_after_handoff, true);
assert.equal(iosSurfaceReceipt.evidence.wkwebview_surface_qualification, false);
assert.equal(iosSurfaceReceipt.evidence.dom_or_frame_qualification, false);
assert.equal(iosSurfaceReceipt.evidence.physical_device_qualification, false);
assert.equal(iosSurfaceReceipt.evidence.wasm_lowering, false);

const iosSurfaceV2Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v2.json", "utf8",
));
assert.equal(iosSurfaceV2Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-app-surface-control-qualification/v2");
assert.equal(iosSurfaceV2Receipt.status,
  "ios-26.5-arm64-simulator-app-surface-control-v2-qualified-not-admitted-not-released");
assert.equal(iosSurfaceV2Receipt.predecessor,
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v1.json");
assert.equal(iosSurfaceV2Receipt.qualified, true);
assert.equal(iosSurfaceV2Receipt.admitted, false);
assert.equal(iosSurfaceV2Receipt.released, false);
assert.equal(iosSurfaceV2Receipt.discoverable, false);
assert.equal(iosSurfaceV2Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosSurfaceV2Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosSurfaceV2Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosSurfaceV2Receipt.source)) {
  assert.equal(digestAt(iosSurfaceV2Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS surface-control v2 qualification source drift`);
}
assert.equal(iosSurfaceV2Receipt.evidence.status, "PASS");
assert.equal(iosSurfaceV2Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosSurfaceV2Receipt.evidence.fixed_host_sha256, iosAppReceipt.source[
  "host/tests/ios-app-capability/Host/FixedHost.swift"
]);
assert.equal(iosSurfaceV2Receipt.evidence.surface_count, 5);
assert.equal(iosSurfaceV2Receipt.evidence.qualified_surface_kind, "native");
assert.equal(iosSurfaceV2Receipt.evidence.all_qualified_surfaces_are_uikit_views, true);
assert.equal(iosSurfaceV2Receipt.evidence.agent_physical_input_injection, false);
assert.equal(iosSurfaceV2Receipt.evidence.agent_surfaces_locked_against_direct_user_activation, true);
assert.equal(iosSurfaceV2Receipt.evidence.edge_dock_cycle_completed, true);
assert.equal(iosSurfaceV2Receipt.evidence.surfaces_progressed_while_docked, true);
assert.equal(iosSurfaceV2Receipt.evidence.takeover_confirmation_required, true);
assert.equal(iosSurfaceV2Receipt.evidence.real_human_input_via_xcuitest, true);
assert.ok(iosSurfaceV2Receipt.evidence.blocked_agent_actions_during_handoff > 0);
assert.equal(iosSurfaceV2Receipt.evidence.agent_mutations_committed_to_human_owned_surface, 0);
assert.equal(iosSurfaceV2Receipt.evidence.background_surfaces_progressed_during_handoff, true);
assert.equal(iosSurfaceV2Receipt.evidence.same_surface_instance_preserved_across_expand_contract, true);
assert.equal(iosSurfaceV2Receipt.evidence.agent_resumed_after_handoff, true);
assert.equal(iosSurfaceV2Receipt.evidence.wkwebview_surface_qualification, false);
assert.equal(iosSurfaceV2Receipt.evidence.dom_or_frame_qualification, false);
assert.equal(iosSurfaceV2Receipt.evidence.physical_device_qualification, false);
assert.equal(iosSurfaceV2Receipt.evidence.wasm_lowering, false);

const iosSurfaceV3Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v3.json", "utf8",
));
assert.equal(iosSurfaceV3Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-app-surface-control-qualification/v3");
assert.equal(iosSurfaceV3Receipt.status,
  "ios-26.5-arm64-ipad-simulator-pip-lifecycle-v3-qualified-not-admitted-not-released");
assert.equal(iosSurfaceV3Receipt.predecessor,
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v2.json");
assert.equal(iosSurfaceV3Receipt.qualified, true);
assert.equal(iosSurfaceV3Receipt.admitted, false);
assert.equal(iosSurfaceV3Receipt.released, false);
assert.equal(iosSurfaceV3Receipt.discoverable, false);
assert.equal(iosSurfaceV3Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosSurfaceV3Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosSurfaceV3Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosSurfaceV3Receipt.source)) {
  assert.equal(digestAt(iosSurfaceV3Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS surface-control v3 qualification source drift`);
}
assert.equal(iosSurfaceV3Receipt.evidence.status, "PASS");
assert.equal(iosSurfaceV3Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosSurfaceV3Receipt.evidence.fixed_host_sha256, iosAppReceipt.source[
  "host/tests/ios-app-capability/Host/FixedHost.swift"
]);
assert.equal(iosSurfaceV3Receipt.evidence.background_mode, "audio");
assert.equal(iosSurfaceV3Receipt.evidence.pip_content_source, "AVSampleBufferDisplayLayer");
assert.equal(iosSurfaceV3Receipt.evidence.pip_supported, true);
assert.equal(iosSurfaceV3Receipt.evidence.pip_became_possible, true);
assert.equal(iosSurfaceV3Receipt.evidence.pip_user_initiated, true);
assert.equal(iosSurfaceV3Receipt.evidence.pip_started, true);
assert.equal(iosSurfaceV3Receipt.evidence.pip_stopped, true);
assert.equal(iosSurfaceV3Receipt.evidence.pip_restore_requested, true);
assert.ok(iosSurfaceV3Receipt.evidence.pip_frames_enqueued > 0);
assert.equal(iosSurfaceV3Receipt.evidence.pip_agent_progressed_while_active, true);
assert.equal(iosSurfaceV3Receipt.evidence.pip_system_window_captured, true);
assert.equal(iosSurfaceV3Receipt.evidence.pip_visual_pixels_capture_qualified, false);
assert.equal(iosSurfaceV3Receipt.evidence.surface_count, 5);
assert.equal(iosSurfaceV3Receipt.evidence.agent_physical_input_injection, false);
assert.equal(iosSurfaceV3Receipt.evidence.agent_surfaces_locked_against_direct_user_activation, true);
assert.equal(iosSurfaceV3Receipt.evidence.takeover_confirmation_required, true);
assert.equal(iosSurfaceV3Receipt.evidence.physical_device_pip_qualification, false);
assert.equal(iosSurfaceV3Receipt.evidence.wasm_lowering, false);

const iosSurfaceV4Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v4.json", "utf8",
));
assert.equal(iosSurfaceV4Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-app-surface-control-qualification/v4");
assert.equal(iosSurfaceV4Receipt.status,
  "ios-26.5-arm64-ipad-simulator-structured-platform-lib-v4-qualified-not-admitted-not-released");
assert.equal(iosSurfaceV4Receipt.predecessor,
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v3.json");
assert.equal(iosSurfaceV4Receipt.qualified, true);
assert.equal(iosSurfaceV4Receipt.admitted, false);
assert.equal(iosSurfaceV4Receipt.released, false);
assert.equal(iosSurfaceV4Receipt.discoverable, false);
assert.equal(iosSurfaceV4Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosSurfaceV4Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosSurfaceV4Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosSurfaceV4Receipt.source)) {
  assert.equal(digestAt(iosSurfaceV4Receipt.implementation_commit, relative), expected,
    `${relative}: retained structured iOS surface-control v4 source drift`);
}
assert.equal(iosSurfaceV4Receipt.evidence.status, "PASS");
assert.equal(iosSurfaceV4Receipt.evidence.package_layout, "wasmc.system-lib-package-layout/v1");
assert.equal(iosSurfaceV4Receipt.evidence.artifact_format, "embedded-source");
assert.equal(iosSurfaceV4Receipt.evidence.platform_source_owned_by_lib_package, true);
assert.equal(iosSurfaceV4Receipt.evidence.qualification_app_owns_provider_source, false);
assert.equal(iosSurfaceV4Receipt.evidence.exact_profile_regeneration, true);
assert.equal(iosSurfaceV4Receipt.evidence.missing_cross_platform_binding_rejected, true);
assert.equal(iosSurfaceV4Receipt.evidence.native_adapter_profile_regression_passed, true);
assert.equal(iosSurfaceV4Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosSurfaceV4Receipt.evidence.fixed_host_sha256,
  iosSurfaceV3Receipt.evidence.fixed_host_sha256);
assert.equal(iosSurfaceV4Receipt.evidence.pip_started, true);
assert.equal(iosSurfaceV4Receipt.evidence.pip_stopped, true);
assert.equal(iosSurfaceV4Receipt.evidence.pip_restore_requested, true);
assert.equal(iosSurfaceV4Receipt.evidence.surface_count, 5);
assert.ok(iosSurfaceV4Receipt.evidence.blocked_agent_actions_during_handoff > 0);
assert.equal(iosSurfaceV4Receipt.evidence.agent_mutations_committed_to_human_owned_surface, 0);
assert.equal(iosSurfaceV4Receipt.evidence.physical_device_pip_qualification, false);
assert.equal(iosSurfaceV4Receipt.evidence.wasm_lowering, false);

const iosSurfaceV5Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v5.json", "utf8",
));
assert.equal(iosSurfaceV5Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-app-surface-control-qualification/v5");
assert.equal(iosSurfaceV5Receipt.predecessor,
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v4.json");
assert.equal(iosSurfaceV5Receipt.qualified, true);
assert.equal(iosSurfaceV5Receipt.admitted, false);
assert.equal(iosSurfaceV5Receipt.released, false);
assert.equal(iosSurfaceV5Receipt.discoverable, false);
assert.equal(iosSurfaceV5Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosSurfaceV5Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosSurfaceV5Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosSurfaceV5Receipt.source)) {
  assert.equal(digestAt(iosSurfaceV5Receipt.implementation_commit, relative), expected,
    `${relative}: retained Lib-owned example v5 source drift`);
}
assert.equal(iosSurfaceV5Receipt.evidence.status, "PASS");
assert.equal(iosSurfaceV5Receipt.evidence.example_owned_by_lib_package, true);
assert.equal(iosSurfaceV5Receipt.evidence.host_test_copy_present, false);
assert.equal(iosSurfaceV5Receipt.evidence.provider_source_copied_into_example, false);
assert.equal(iosSurfaceV5Receipt.evidence.example_consumes_lib_owned_platform_provider, true);
assert.equal(iosSurfaceV5Receipt.evidence.xcode_project_generation, true);
assert.equal(iosSurfaceV5Receipt.evidence.generic_ios_simulator_build, true);
assert.equal(iosSurfaceV5Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosSurfaceV5Receipt.evidence.fixed_host_sha256,
  iosSurfaceV4Receipt.evidence.fixed_host_sha256);
assert.equal(iosSurfaceV5Receipt.evidence.pip_started, true);
assert.equal(iosSurfaceV5Receipt.evidence.pip_stopped, true);
assert.equal(iosSurfaceV5Receipt.evidence.surface_count, 5);
assert.ok(iosSurfaceV5Receipt.evidence.blocked_agent_actions_during_handoff > 0);
assert.equal(iosSurfaceV5Receipt.evidence.agent_mutations_committed_to_human_owned_surface, 0);
assert.equal(iosSurfaceV5Receipt.evidence.physical_device_pip_qualification, false);

const iosSurfaceV6Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v6.json", "utf8",
));
assert.equal(iosSurfaceV6Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-app-surface-control-qualification/v6");
assert.equal(iosSurfaceV6Receipt.predecessor,
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v5.json");
assert.equal(iosSurfaceV6Receipt.qualified, true);
assert.equal(iosSurfaceV6Receipt.admitted, false);
assert.equal(iosSurfaceV6Receipt.released, false);
assert.equal(iosSurfaceV6Receipt.discoverable, false);
assert.equal(iosSurfaceV6Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosSurfaceV6Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosSurfaceV6Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosSurfaceV6Receipt.source)) {
  assert.equal(digestAt(iosSurfaceV6Receipt.implementation_commit, relative), expected,
    `${relative}: retained real WKWebView isolation v6 source drift`);
}
assert.equal(iosSurfaceV6Receipt.evidence.status, "PASS");
assert.equal(iosSurfaceV6Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosSurfaceV6Receipt.evidence.fixed_host_sha256,
  iosSurfaceV5Receipt.evidence.fixed_host_sha256);
assert.equal(iosSurfaceV6Receipt.evidence.host_source_changes_required, 0);
assert.equal(iosSurfaceV6Receipt.evidence.real_wkwebview_surfaces, true);
assert.equal(iosSurfaceV6Receipt.evidence.surface_count, 2);
assert.equal(iosSurfaceV6Receipt.evidence.semantic_dom_snapshot, true);
assert.deepEqual(iosSurfaceV6Receipt.evidence.stable_element_ids,
  ["count", "increment", "note"]);
assert.equal(iosSurfaceV6Receipt.evidence.generation_checked_action, true);
assert.equal(iosSurfaceV6Receipt.evidence.element_id_json_encoded_before_javascript, true);
assert.equal(iosSurfaceV6Receipt.evidence.agent_uses_physical_input, false);
assert.equal(iosSurfaceV6Receipt.evidence.user_input_overlapped_agent_action, true);
assert.ok(iosSurfaceV6Receipt.evidence.user_input_first_unix_ms
  <= iosSurfaceV6Receipt.evidence.agent_action_completed_unix_ms);
assert.ok(iosSurfaceV6Receipt.evidence.agent_action_completed_unix_ms
  <= iosSurfaceV6Receipt.evidence.user_input_last_unix_ms);
assert.equal(iosSurfaceV6Receipt.evidence.agent_surface_count_after, "1");
assert.equal(iosSurfaceV6Receipt.evidence.user_surface_count_after, "0");
assert.equal(iosSurfaceV6Receipt.evidence.user_text_after, "human-owned");
assert.equal(iosSurfaceV6Receipt.evidence.agent_generation_after, 1);
assert.equal(iosSurfaceV6Receipt.evidence.user_generation_after, 0);
assert.equal(iosSurfaceV6Receipt.evidence.existing_five_surface_regression_passed, true);
assert.equal(iosSurfaceV6Receipt.evidence.existing_pip_regression_environment_pinned_to_predecessor_ipad, true);
assert.equal(iosSurfaceV6Receipt.evidence.pip_started, true);
assert.equal(iosSurfaceV6Receipt.evidence.pip_stopped, true);
assert.equal(iosSurfaceV6Receipt.evidence.physical_device_qualification, false);
assert.equal(iosSurfaceV6Receipt.evidence.wasm_lowering, false);
assert.equal(iosSurfaceV6Receipt.evidence.dynamic_component_loading, false);

const iosSystemAgentLabV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-system-agent-lab-v1.json", "utf8",
));
assert.equal(iosSystemAgentLabV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-system-agent-lab-qualification/v1");
assert.equal(iosSystemAgentLabV1Receipt.qualified, true);
assert.equal(iosSystemAgentLabV1Receipt.admitted, false);
assert.equal(iosSystemAgentLabV1Receipt.released, false);
assert.equal(iosSystemAgentLabV1Receipt.discoverable, false);
assert.equal(iosSystemAgentLabV1Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosSystemAgentLabV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor",
  iosSystemAgentLabV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosSystemAgentLabV1Receipt.source)) {
  assert.equal(digestAt(iosSystemAgentLabV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS System Agent Lab v1 source drift`);
}
assert.equal(iosSystemAgentLabV1Receipt.evidence.status, "PASS");
assert.equal(iosSystemAgentLabV1Receipt.evidence.focused_lib_examples_preserved, true);
assert.equal(iosSystemAgentLabV1Receipt.evidence.shared_platform_shell, true);
assert.equal(iosSystemAgentLabV1Receipt.evidence.provider_source_copied_into_shell, false);
assert.equal(iosSystemAgentLabV1Receipt.evidence.manifest_selected_exact_candidates, true);
assert.equal(iosSystemAgentLabV1Receipt.evidence.provider_count, 2);
assert.deepEqual(iosSystemAgentLabV1Receipt.evidence.merged_frameworks,
  ["Foundation", "Network", "WebKit"]);
assert.equal(iosSystemAgentLabV1Receipt.evidence.duplicate_provider_rejected, true);
assert.equal(iosSystemAgentLabV1Receipt.evidence.plist_conflict_rejected, true);
assert.equal(iosSystemAgentLabV1Receipt.evidence.exclusive_resource_conflict_rejected, true);
assert.equal(iosSystemAgentLabV1Receipt.evidence.generic_ios_simulator_build, true);
assert.equal(iosSystemAgentLabV1Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosSystemAgentLabV1Receipt.evidence.fixed_host_sha256,
  iosSurfaceV6Receipt.evidence.fixed_host_sha256);
assert.equal(iosSystemAgentLabV1Receipt.evidence.web_semantic_action, true);
assert.equal(iosSystemAgentLabV1Receipt.evidence.web_generation, 1);
assert.equal(iosSystemAgentLabV1Receipt.evidence.web_count, "1");
assert.equal(iosSystemAgentLabV1Receipt.evidence.network_status, "satisfied");
assert.ok(iosSystemAgentLabV1Receipt.evidence.network_generation >= 1);
assert.equal(iosSystemAgentLabV1Receipt.evidence.physical_device_qualification, false);
assert.equal(iosSystemAgentLabV1Receipt.evidence.wasm_lowering, false);
assert.equal(iosSystemAgentLabV1Receipt.evidence.dynamic_component_loading, false);

const iosLifecycleV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-app-lifecycle-v1.json", "utf8",
));
assert.equal(iosLifecycleV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-app-lifecycle-qualification/v1");
assert.equal(iosLifecycleV1Receipt.qualified, true);
assert.equal(iosLifecycleV1Receipt.admitted, false);
assert.equal(iosLifecycleV1Receipt.released, false);
assert.equal(iosLifecycleV1Receipt.discoverable, false);
assert.equal(iosLifecycleV1Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosLifecycleV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosLifecycleV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosLifecycleV1Receipt.source)) {
  assert.equal(digestAt(iosLifecycleV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS App lifecycle v1 source drift`);
}
assert.equal(iosLifecycleV1Receipt.evidence.status, "PASS");
assert.equal(iosLifecycleV1Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosLifecycleV1Receipt.evidence.fixed_host_sha256,
  iosSurfaceV5Receipt.evidence.fixed_host_sha256);
assert.equal(iosLifecycleV1Receipt.evidence.home_background_foreground_cycle, true);
assert.ok(iosLifecycleV1Receipt.evidence.finite_work_background_ticks > 0);
assert.equal(iosLifecycleV1Receipt.evidence.finite_work_completed_before_foreground, true);
assert.equal(iosLifecycleV1Receipt.evidence.cold_relaunch_journal_recovered, true);
assert.ok(iosLifecycleV1Receipt.evidence.launch_count >= 2);
assert.equal(iosLifecycleV1Receipt.evidence.simulator_suspension_qualified, false);
assert.equal(iosLifecycleV1Receipt.evidence.background_task_expiration_qualified, false);
assert.equal(iosLifecycleV1Receipt.evidence.bgtaskscheduler_delivery_qualified, false);
assert.equal(iosLifecycleV1Receipt.evidence.background_urlsession_delivery_qualified, false);
assert.equal(iosLifecycleV1Receipt.evidence.physical_device, false);

const iosFiniteBackgroundWindowV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-finite-background-window-v1.json", "utf8",
));
assert.equal(iosFiniteBackgroundWindowV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-finite-background-window-qualification/v1");
assert.equal(iosFiniteBackgroundWindowV1Receipt.qualified, true);
assert.equal(iosFiniteBackgroundWindowV1Receipt.admitted, false);
assert.equal(iosFiniteBackgroundWindowV1Receipt.released, false);
assert.equal(iosFiniteBackgroundWindowV1Receipt.discoverable, false);
assert.equal(iosFiniteBackgroundWindowV1Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosFiniteBackgroundWindowV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosFiniteBackgroundWindowV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosFiniteBackgroundWindowV1Receipt.source)) {
  assert.equal(digestAt(iosFiniteBackgroundWindowV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS finite-background-window source drift`);
}
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.status, "PASS");
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.fixed_host_sha256,
  iosLifecycleV1Receipt.evidence.fixed_host_sha256);
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.requested_ms, 8000);
assert.ok(iosFiniteBackgroundWindowV1Receipt.evidence.elapsed_ms >= 7500);
assert.ok(iosFiniteBackgroundWindowV1Receipt.evidence.elapsed_ms < 15000);
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.background_ticks, 8);
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.completed_before_foreground, true);
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.background_time_remaining_available, false);
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.background_time_remaining_sample_count, 0);
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.expiration_observed, false);
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.maximum_duration_qualified, false);
assert.equal(iosFiniteBackgroundWindowV1Receipt.evidence.physical_device, false);
execFileSync(process.execPath, ["scripts/validate-ios-app-lifecycle.mjs"], { stdio: "ignore" });

const iosFiniteBackgroundWindowMatrixV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-finite-background-window-matrix-v1.json", "utf8",
));
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-finite-background-window-matrix-qualification/v1");
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.qualified, true);
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.admitted, false);
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.released, false);
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.discoverable, false);
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosFiniteBackgroundWindowMatrixV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosFiniteBackgroundWindowMatrixV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosFiniteBackgroundWindowMatrixV1Receipt.source)) {
  assert.equal(digestAt(iosFiniteBackgroundWindowMatrixV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS finite-background-window matrix source drift`);
}
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.evidence.status, "PASS");
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.evidence.fixed_host_sha256,
  iosLifecycleV1Receipt.evidence.fixed_host_sha256);
assert.deepEqual(iosFiniteBackgroundWindowMatrixV1Receipt.evidence.results.map((row) => row.requested_ms),
  [15000, 30000, 60000]);
for (const row of iosFiniteBackgroundWindowMatrixV1Receipt.evidence.results) {
  assert.ok(row.elapsed_ms >= row.requested_ms);
  assert.equal(row.completed_before_foreground, true);
  assert.equal(row.expiration_observed, false);
  assert.equal(row.remaining_time_available, false);
}
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.evidence.proven_lower_bound_ms, 60000);
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.evidence.expiration_observed, false);
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.evidence.maximum_duration_qualified, false);
assert.equal(iosFiniteBackgroundWindowMatrixV1Receipt.evidence.physical_device, false);

const iosBackgroundTransferV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-background-transfer-v1.json", "utf8",
));
assert.equal(iosBackgroundTransferV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-background-transfer-qualification/v1");
assert.equal(iosBackgroundTransferV1Receipt.qualified, true);
assert.equal(iosBackgroundTransferV1Receipt.admitted, false);
assert.equal(iosBackgroundTransferV1Receipt.released, false);
assert.equal(iosBackgroundTransferV1Receipt.discoverable, false);
assert.equal(iosBackgroundTransferV1Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosBackgroundTransferV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosBackgroundTransferV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosBackgroundTransferV1Receipt.source)) {
  assert.equal(digestAt(iosBackgroundTransferV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS background-transfer v1 source drift`);
}
assert.equal(iosBackgroundTransferV1Receipt.evidence.status, "PASS");
assert.equal(iosBackgroundTransferV1Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosBackgroundTransferV1Receipt.evidence.fixed_host_sha256,
  iosLifecycleV1Receipt.evidence.fixed_host_sha256);
assert.equal(iosBackgroundTransferV1Receipt.evidence.bytes, 8 * 1024 * 1024);
assert.equal(iosBackgroundTransferV1Receipt.evidence.completion_phase, "background");
assert.equal(iosBackgroundTransferV1Receipt.evidence.sha256,
  iosBackgroundTransferV1Receipt.evidence.durable_result_sha256);
assert.equal(iosBackgroundTransferV1Receipt.evidence.process_relaunch_delivery_qualified, false);
assert.equal(iosBackgroundTransferV1Receipt.evidence.physical_device, false);

const iosBackgroundTransferV2Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-background-transfer-v2.json", "utf8",
));
assert.equal(iosBackgroundTransferV2Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-background-transfer-qualification/v2");
assert.equal(iosBackgroundTransferV2Receipt.predecessor,
  "admission/host-lib-defined-boundary-v1/ios-arm64-background-transfer-v1.json");
assert.equal(iosBackgroundTransferV2Receipt.qualified, true);
assert.equal(iosBackgroundTransferV2Receipt.admitted, false);
assert.equal(iosBackgroundTransferV2Receipt.released, false);
assert.equal(iosBackgroundTransferV2Receipt.discoverable, false);
assert.equal(iosBackgroundTransferV2Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosBackgroundTransferV2Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosBackgroundTransferV2Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosBackgroundTransferV2Receipt.source)) {
  assert.equal(digestAt(iosBackgroundTransferV2Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS background-transfer v2 source drift`);
}
assert.equal(iosBackgroundTransferV2Receipt.evidence.status, "PASS");
assert.equal(iosBackgroundTransferV2Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosBackgroundTransferV2Receipt.evidence.fixed_host_sha256,
  iosBackgroundTransferV1Receipt.evidence.fixed_host_sha256);
assert.equal(iosBackgroundTransferV2Receipt.evidence.background_download_bytes, 8 * 1024 * 1024);
assert.equal(iosBackgroundTransferV2Receipt.evidence.download_sha256,
  iosBackgroundTransferV2Receipt.evidence.durable_result_sha256);
assert.equal(iosBackgroundTransferV2Receipt.evidence.cancellation_terminal_domain, "NSURLErrorDomain");
assert.equal(iosBackgroundTransferV2Receipt.evidence.cancellation_terminal_code, -999);
assert.equal(iosBackgroundTransferV2Receipt.evidence.cancelled_result_published, false);
assert.equal(iosBackgroundTransferV2Receipt.evidence.cancelled_durable_result_present, false);
assert.equal(iosBackgroundTransferV2Receipt.evidence.automatic_background_relaunch_observed, false);
assert.equal(iosBackgroundTransferV2Receipt.evidence.background_session_reconnected, false);
assert.equal(iosBackgroundTransferV2Receipt.evidence.process_relaunch_delivery_qualified, false);

const iosDeferredWorkRejectionV1 = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-deferred-work-simulator-rejection-v1.json", "utf8",
));
assert.equal(iosDeferredWorkRejectionV1.schema,
  "wasmc.host-lib-defined-boundary-ios-deferred-work-rejection/v1");
assert.equal(iosDeferredWorkRejectionV1.qualified, false);
assert.equal(iosDeferredWorkRejectionV1.admitted, false);
assert.equal(iosDeferredWorkRejectionV1.released, false);
assert.equal(iosDeferredWorkRejectionV1.discoverable, false);
assert.equal(iosDeferredWorkRejectionV1.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosDeferredWorkRejectionV1.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosDeferredWorkRejectionV1.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosDeferredWorkRejectionV1.source)) {
  assert.equal(digestAt(iosDeferredWorkRejectionV1.implementation_commit, relative), expected,
    `${relative}: retained iOS deferred-work rejection source drift`);
}
assert.equal(iosDeferredWorkRejectionV1.evidence.status, "REJECTED_UNAVAILABLE");
assert.equal(iosDeferredWorkRejectionV1.evidence.registration_accepted, true);
assert.equal(iosDeferredWorkRejectionV1.evidence.submission_accepted, false);
assert.equal(iosDeferredWorkRejectionV1.evidence.error_domain, "BGTaskSchedulerErrorDomain");
assert.equal(iosDeferredWorkRejectionV1.evidence.error_code, 1);
assert.equal(iosDeferredWorkRejectionV1.evidence.pending_count, 0);
assert.equal(iosDeferredWorkRejectionV1.evidence.system_delivery_qualified, false);

const iosBackgroundAudioV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-background-audio-v1.json", "utf8",
));
assert.equal(iosBackgroundAudioV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-background-audio-qualification/v1");
assert.equal(iosBackgroundAudioV1Receipt.qualified, true);
assert.equal(iosBackgroundAudioV1Receipt.admitted, false);
assert.equal(iosBackgroundAudioV1Receipt.released, false);
assert.equal(iosBackgroundAudioV1Receipt.discoverable, false);
assert.equal(iosBackgroundAudioV1Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosBackgroundAudioV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosBackgroundAudioV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosBackgroundAudioV1Receipt.source)) {
  assert.equal(digestAt(iosBackgroundAudioV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS background-audio v1 source drift`);
}
assert.equal(iosBackgroundAudioV1Receipt.evidence.status, "PASS");
assert.equal(iosBackgroundAudioV1Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosBackgroundAudioV1Receipt.evidence.fixed_host_sha256,
  iosBackgroundTransferV2Receipt.evidence.fixed_host_sha256);
assert.ok(iosBackgroundAudioV1Receipt.evidence.background_samples >= 5);
assert.ok(iosBackgroundAudioV1Receipt.evidence.background_position_delta_ms >= 1500);
assert.equal(iosBackgroundAudioV1Receipt.evidence.all_background_samples_playing, true);
assert.equal(iosBackgroundAudioV1Receipt.evidence.physical_output_qualified, false);
assert.equal(iosBackgroundAudioV1Receipt.evidence.lock_screen_qualified, false);
assert.equal(iosBackgroundAudioV1Receipt.evidence.route_change_qualified, false);
assert.equal(iosBackgroundAudioV1Receipt.evidence.interruption_qualified, false);

const iosLocalNotificationV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-local-notification-v1.json", "utf8",
));
assert.equal(iosLocalNotificationV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-local-notification-qualification/v1");
assert.equal(iosLocalNotificationV1Receipt.qualified, true);
assert.equal(iosLocalNotificationV1Receipt.admitted, false);
assert.equal(iosLocalNotificationV1Receipt.released, false);
assert.equal(iosLocalNotificationV1Receipt.discoverable, false);
assert.equal(iosLocalNotificationV1Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosLocalNotificationV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosLocalNotificationV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosLocalNotificationV1Receipt.source)) {
  assert.equal(digestAt(iosLocalNotificationV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS local-notification v1 source drift`);
}
assert.equal(iosLocalNotificationV1Receipt.evidence.status, "PASS");
assert.equal(iosLocalNotificationV1Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosLocalNotificationV1Receipt.evidence.fixed_host_sha256,
  iosBackgroundAudioV1Receipt.evidence.fixed_host_sha256);
assert.equal(iosLocalNotificationV1Receipt.evidence.system_authorization_prompt, true);
assert.equal(iosLocalNotificationV1Receipt.evidence.authorization, "authorized");
assert.equal(iosLocalNotificationV1Receipt.evidence.authorization_request_attempts, 1);
assert.equal(iosLocalNotificationV1Receipt.evidence.scheduled, true);
assert.equal(iosLocalNotificationV1Receipt.evidence.system_banner_observed, true);
assert.equal(iosLocalNotificationV1Receipt.evidence.delivered, true);
assert.equal(iosLocalNotificationV1Receipt.evidence.exact_identifier, true);
assert.equal(iosLocalNotificationV1Receipt.evidence.exact_title, true);
assert.equal(iosLocalNotificationV1Receipt.evidence.exact_body, true);
assert.equal(iosLocalNotificationV1Receipt.evidence.exact_payload, true);
assert.ok(iosLocalNotificationV1Receipt.evidence.background_unix_ms
  < iosLocalNotificationV1Receipt.evidence.delivery_unix_ms);
assert.ok(iosLocalNotificationV1Receipt.evidence.delivery_unix_ms
  < iosLocalNotificationV1Receipt.evidence.foreground_return_unix_ms);
assert.equal(iosLocalNotificationV1Receipt.evidence.delivery_between_background_boundaries, true);
assert.equal(iosLocalNotificationV1Receipt.evidence.remote_push_qualified, false);
assert.equal(iosLocalNotificationV1Receipt.evidence.silent_push_qualified, false);
assert.equal(iosLocalNotificationV1Receipt.evidence.notification_extension_qualified, false);
assert.equal(iosLocalNotificationV1Receipt.evidence.physical_device, false);
execFileSync(process.execPath, ["scripts/validate-ios-local-notification.mjs"], { stdio: "ignore" });

const iosWebSocketV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-websocket-v1.json", "utf8",
));
assert.equal(iosWebSocketV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-websocket-qualification/v1");
assert.equal(iosWebSocketV1Receipt.qualified, true);
assert.equal(iosWebSocketV1Receipt.admitted, false);
assert.equal(iosWebSocketV1Receipt.released, false);
assert.equal(iosWebSocketV1Receipt.discoverable, false);
assert.equal(iosWebSocketV1Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosWebSocketV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosWebSocketV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosWebSocketV1Receipt.source)) {
  assert.equal(digestAt(iosWebSocketV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS WebSocket v1 source drift`);
}
assert.equal(iosWebSocketV1Receipt.evidence.status, "PASS");
assert.equal(iosWebSocketV1Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosWebSocketV1Receipt.evidence.fixed_host_sha256,
  iosLocalNotificationV1Receipt.evidence.fixed_host_sha256);
assert.equal(iosWebSocketV1Receipt.evidence.transport, "URLSessionWebSocketTask");
assert.equal(iosWebSocketV1Receipt.evidence.foreground_send, true);
assert.equal(iosWebSocketV1Receipt.evidence.foreground_receive, true);
assert.equal(iosWebSocketV1Receipt.evidence.foreground_reply, "server-foreground");
assert.equal(iosWebSocketV1Receipt.evidence.background_send, true);
assert.equal(iosWebSocketV1Receipt.evidence.background_receive, true);
assert.equal(iosWebSocketV1Receipt.evidence.background_reply, "server-background");
assert.equal(iosWebSocketV1Receipt.evidence.background_receive_phase, "background");
assert.equal(iosWebSocketV1Receipt.evidence.background_scope, "finite-background-task-only");
assert.equal(iosWebSocketV1Receipt.evidence.wss_qualified, false);
assert.equal(iosWebSocketV1Receipt.evidence.internet_route_qualified, false);
assert.equal(iosWebSocketV1Receipt.evidence.suspension_receive_qualified, false);
assert.equal(iosWebSocketV1Receipt.evidence.process_relaunch_reconnect_qualified, false);
assert.equal(iosWebSocketV1Receipt.evidence.physical_device, false);
execFileSync(process.execPath, ["scripts/validate-ios-websocket.mjs"], { stdio: "ignore" });

const iosWebSocketV2Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-websocket-v2.json", "utf8",
));
assert.equal(iosWebSocketV2Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-websocket-qualification/v2");
assert.equal(iosWebSocketV2Receipt.supersedes,
  "admission/host-lib-defined-boundary-v1/ios-arm64-websocket-v1.json");
assert.equal(iosWebSocketV2Receipt.qualified, true);
assert.equal(iosWebSocketV2Receipt.admitted, false);
assert.equal(iosWebSocketV2Receipt.released, false);
assert.equal(iosWebSocketV2Receipt.discoverable, false);
assert.equal(iosWebSocketV2Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosWebSocketV2Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosWebSocketV2Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosWebSocketV2Receipt.source)) {
  assert.equal(digestAt(iosWebSocketV2Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS WebSocket v2 source drift`);
}
assert.equal(iosWebSocketV2Receipt.evidence.status, "PASS");
assert.equal(iosWebSocketV2Receipt.evidence.provider,
  "wasmc:system-ios-websocket@0.0.1-dev.2");
assert.equal(iosWebSocketV2Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosWebSocketV2Receipt.evidence.fixed_host_sha256,
  iosWebSocketV1Receipt.evidence.fixed_host_sha256);
assert.equal(iosWebSocketV2Receipt.evidence.transport, "URLSessionWebSocketTask");
assert.equal(iosWebSocketV2Receipt.evidence.tls_fixture_scope,
  "repository-local-self-signed-test-only");
assert.equal(iosWebSocketV2Receipt.evidence.tls_server_trust_challenge, true);
assert.equal(iosWebSocketV2Receipt.evidence.certificate_sha256,
  "f115cf8cfd0c513ba2301bfe8b45c0de198de875ba24db0a79fc85362e611572");
assert.equal(iosWebSocketV2Receipt.evidence.certificate_pin_match, true);
assert.equal(iosWebSocketV2Receipt.evidence.foreground_send, true);
assert.equal(iosWebSocketV2Receipt.evidence.foreground_receive, true);
assert.equal(iosWebSocketV2Receipt.evidence.foreground_reply, "server-foreground");
assert.equal(iosWebSocketV2Receipt.evidence.background_send, true);
assert.equal(iosWebSocketV2Receipt.evidence.background_receive, true);
assert.equal(iosWebSocketV2Receipt.evidence.background_reply, "server-background");
assert.equal(iosWebSocketV2Receipt.evidence.background_receive_phase, "background");
assert.equal(iosWebSocketV2Receipt.evidence.background_scope, "finite-background-task-only");
assert.deepEqual(iosWebSocketV2Receipt.evidence.negative_pin_control, {
  accepted: false,
  tls_server_trust_challenge: true,
  certificate_pin_match: false,
  error: "certificate-pin-mismatch",
  connected: false,
});
assert.equal(iosWebSocketV2Receipt.evidence.local_pinned_wss_qualified, true);
assert.equal(iosWebSocketV2Receipt.evidence.public_ca_wss_qualified, false);
assert.equal(iosWebSocketV2Receipt.evidence.internet_route_qualified, false);
assert.equal(iosWebSocketV2Receipt.evidence.network_transition_reconnect_qualified, false);
assert.equal(iosWebSocketV2Receipt.evidence.suspension_receive_qualified, false);
assert.equal(iosWebSocketV2Receipt.evidence.process_relaunch_reconnect_qualified, false);
assert.equal(iosWebSocketV2Receipt.evidence.physical_device, false);

const iosWebSocketV3Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-websocket-v3.json", "utf8",
));
assert.equal(iosWebSocketV3Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-websocket-qualification/v3");
assert.equal(iosWebSocketV3Receipt.supersedes,
  "admission/host-lib-defined-boundary-v1/ios-arm64-websocket-v2.json");
assert.equal(iosWebSocketV3Receipt.qualified, true);
assert.equal(iosWebSocketV3Receipt.admitted, false);
assert.equal(iosWebSocketV3Receipt.released, false);
assert.equal(iosWebSocketV3Receipt.discoverable, false);
assert.equal(iosWebSocketV3Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosWebSocketV3Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosWebSocketV3Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosWebSocketV3Receipt.source)) {
  assert.equal(digestAt(iosWebSocketV3Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS WebSocket v3 source drift`);
}
assert.equal(iosWebSocketV3Receipt.evidence.status, "PASS");
assert.equal(iosWebSocketV3Receipt.evidence.provider,
  "wasmc:system-ios-websocket@0.0.1-dev.3");
assert.equal(iosWebSocketV3Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosWebSocketV3Receipt.evidence.fixed_host_sha256,
  iosWebSocketV2Receipt.evidence.fixed_host_sha256);
assert.equal(iosWebSocketV3Receipt.evidence.transport, "URLSessionWebSocketTask");
assert.equal(iosWebSocketV3Receipt.evidence.certificate_pin_match, true);
assert.deepEqual(iosWebSocketV3Receipt.evidence.service_restart, {
  accepted: true,
  connection_generation: 2,
  reconnect_attempts: 2,
  reconnect_exhausted: false,
  recovery_prime_receive: true,
  service_interruption_observed: true,
  outbox_enqueued: true,
  outbox_delivered: true,
  recovery_reply: "server-after-restart",
});
assert.deepEqual(iosWebSocketV3Receipt.evidence.bounded_retry_negative_control, {
  accepted: false,
  connection_generation: 1,
  reconnect_attempts: 8,
  reconnect_exhausted: true,
  outbox_enqueued: true,
  outbox_delivered: false,
});
assert.equal(iosWebSocketV3Receipt.evidence.reconnect_policy, "350ms-fixed-max-8");
assert.equal(iosWebSocketV3Receipt.evidence.outbox_scope,
  "process-memory-single-message-fixture");
assert.equal(iosWebSocketV3Receipt.evidence.service_restart_reconnect_qualified, true);
assert.equal(iosWebSocketV3Receipt.evidence.public_ca_wss_qualified, false);
assert.equal(iosWebSocketV3Receipt.evidence.internet_route_qualified, false);
assert.equal(iosWebSocketV3Receipt.evidence.network_transition_reconnect_qualified, false);
assert.equal(iosWebSocketV3Receipt.evidence.suspension_receive_qualified, false);
assert.equal(iosWebSocketV3Receipt.evidence.process_relaunch_reconnect_qualified, false);
assert.equal(iosWebSocketV3Receipt.evidence.physical_device, false);

const iosWebSocketV4Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-websocket-v4.json", "utf8",
));
assert.equal(iosWebSocketV4Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-websocket-qualification/v4");
assert.equal(iosWebSocketV4Receipt.supersedes,
  "admission/host-lib-defined-boundary-v1/ios-arm64-websocket-v3.json");
assert.equal(iosWebSocketV4Receipt.qualified, true);
assert.equal(iosWebSocketV4Receipt.admitted, false);
assert.equal(iosWebSocketV4Receipt.released, false);
assert.equal(iosWebSocketV4Receipt.discoverable, false);
assert.equal(iosWebSocketV4Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosWebSocketV4Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosWebSocketV4Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosWebSocketV4Receipt.source)) {
  assert.equal(digestAt(iosWebSocketV4Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS WebSocket v4 source drift`);
}
assert.equal(iosWebSocketV4Receipt.evidence.status, "PASS");
assert.equal(iosWebSocketV4Receipt.evidence.provider,
  "wasmc:system-ios-websocket@0.0.1-dev.4");
assert.equal(iosWebSocketV4Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosWebSocketV4Receipt.evidence.fixed_host_sha256,
  iosWebSocketV3Receipt.evidence.fixed_host_sha256);
assert.equal(iosWebSocketV4Receipt.evidence.transport, "URLSessionWebSocketTask");
assert.equal(iosWebSocketV4Receipt.evidence.certificate_pin_match, true);
assert.deepEqual(iosWebSocketV4Receipt.evidence.durable_outbox, {
  format: "json-atomic-two-message-ordered-ack-drain",
  seed_and_drain_process_ids_distinct: true,
  loaded_count: 2,
  ack_order: ["ack-durable-1", "ack-durable-2"],
  remaining_count: 0,
  retained_file_messages: [],
  drained: true,
});
assert.equal(iosWebSocketV4Receipt.evidence.process_relaunch_reconnect_qualified, true);
assert.equal(iosWebSocketV4Receipt.evidence.service_restart_reconnect_regression, true);
assert.equal(iosWebSocketV4Receipt.evidence.bounded_retry_exhaustion_regression, true);
assert.equal(iosWebSocketV4Receipt.evidence.plain_ws_regression, true);
assert.equal(iosWebSocketV4Receipt.evidence.pinned_wss_regression, true);
assert.equal(iosWebSocketV4Receipt.evidence.wrong_pin_rejection_regression, true);
assert.equal(iosWebSocketV4Receipt.evidence.public_ca_wss_qualified, false);
assert.equal(iosWebSocketV4Receipt.evidence.internet_route_qualified, false);
assert.equal(iosWebSocketV4Receipt.evidence.network_transition_reconnect_qualified, false);
assert.equal(iosWebSocketV4Receipt.evidence.suspension_receive_qualified, false);
assert.equal(iosWebSocketV4Receipt.evidence.general_queue_capacity_qualified, false);
assert.equal(iosWebSocketV4Receipt.evidence.crash_between_send_and_ack_deduplication_qualified, false);
assert.equal(iosWebSocketV4Receipt.evidence.physical_device, false);

const iosWebSocketV5Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-websocket-v5.json", "utf8",
));
assert.equal(iosWebSocketV5Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-websocket-qualification/v5");
assert.equal(iosWebSocketV5Receipt.supersedes,
  "admission/host-lib-defined-boundary-v1/ios-arm64-websocket-v4.json");
assert.equal(iosWebSocketV5Receipt.qualified, true);
assert.equal(iosWebSocketV5Receipt.admitted, false);
assert.equal(iosWebSocketV5Receipt.released, false);
assert.equal(iosWebSocketV5Receipt.discoverable, false);
assert.equal(iosWebSocketV5Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosWebSocketV5Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosWebSocketV5Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosWebSocketV5Receipt.source)) {
  assert.equal(digestAt(iosWebSocketV5Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS WebSocket v5 source drift`);
}
assert.equal(iosWebSocketV5Receipt.evidence.status, "PASS");
assert.equal(iosWebSocketV5Receipt.evidence.provider,
  "wasmc:system-ios-websocket@0.0.1-dev.5");
assert.equal(iosWebSocketV5Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosWebSocketV5Receipt.evidence.fixed_host_sha256,
  iosWebSocketV4Receipt.evidence.fixed_host_sha256);
assert.equal(iosWebSocketV5Receipt.evidence.transport, "URLSessionWebSocketTask");
assert.equal(iosWebSocketV5Receipt.evidence.certificate_pin_match, true);
assert.deepEqual(iosWebSocketV5Receipt.evidence.idempotent_replay, {
  process_count: 3,
  process_ids_distinct: true,
  loaded_count: 2,
  crash_receipt_persisted: true,
  ack_outcomes: ["durable-1:duplicate:1", "durable-2:applied:1"],
  first_message_effect_count: 1,
  second_message_effect_count: 1,
  remaining_count: 0,
  retained_file_messages: [],
  drained: true,
});
assert.equal(iosWebSocketV5Receipt.evidence.crash_before_ack_replay_qualified, true);
assert.equal(iosWebSocketV5Receipt.evidence.idempotent_effect_once_qualified, true);
assert.equal(iosWebSocketV5Receipt.evidence.process_relaunch_reconnect_qualified, true);
assert.equal(iosWebSocketV5Receipt.evidence.durable_ordered_outbox_regression, true);
assert.equal(iosWebSocketV5Receipt.evidence.service_restart_reconnect_regression, true);
assert.equal(iosWebSocketV5Receipt.evidence.bounded_retry_exhaustion_regression, true);
assert.equal(iosWebSocketV5Receipt.evidence.plain_ws_regression, true);
assert.equal(iosWebSocketV5Receipt.evidence.pinned_wss_regression, true);
assert.equal(iosWebSocketV5Receipt.evidence.wrong_pin_rejection_regression, true);
assert.equal(iosWebSocketV5Receipt.evidence.public_ca_wss_qualified, false);
assert.equal(iosWebSocketV5Receipt.evidence.internet_route_qualified, false);
assert.equal(iosWebSocketV5Receipt.evidence.network_transition_reconnect_qualified, false);
assert.equal(iosWebSocketV5Receipt.evidence.suspension_receive_qualified, false);
assert.equal(iosWebSocketV5Receipt.evidence.general_queue_capacity_and_compaction_qualified, false);
assert.equal(iosWebSocketV5Receipt.evidence.server_idempotency_persistence_across_server_restart_qualified, false);
assert.equal(iosWebSocketV5Receipt.evidence.physical_device, false);

const iosNetworkPathV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-arm64-network-path-v1.json", "utf8",
));
assert.equal(iosNetworkPathV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-network-path-qualification/v1");
assert.equal(iosNetworkPathV1Receipt.qualified, true);
assert.equal(iosNetworkPathV1Receipt.admitted, false);
assert.equal(iosNetworkPathV1Receipt.released, false);
assert.equal(iosNetworkPathV1Receipt.discoverable, false);
assert.equal(iosNetworkPathV1Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosNetworkPathV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosNetworkPathV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosNetworkPathV1Receipt.source)) {
  assert.equal(digestAt(iosNetworkPathV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS network-path v1 source drift`);
}
assert.equal(iosNetworkPathV1Receipt.evidence.status, "PASS");
assert.equal(iosNetworkPathV1Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(iosNetworkPathV1Receipt.evidence.fixed_host_sha256,
  iosWebSocketV1Receipt.evidence.fixed_host_sha256);
assert.equal(iosNetworkPathV1Receipt.evidence.path_status, "satisfied");
assert.deepEqual(iosNetworkPathV1Receipt.evidence.interfaces, ["wifi"]);
assert.equal(iosNetworkPathV1Receipt.evidence.expensive, false);
assert.equal(iosNetworkPathV1Receipt.evidence.constrained, false);
assert.equal(iosNetworkPathV1Receipt.evidence.supports_ipv4, false);
assert.equal(iosNetworkPathV1Receipt.evidence.supports_ipv6, false);
assert.equal(iosNetworkPathV1Receipt.evidence.supports_dns, false);
assert.equal(iosNetworkPathV1Receipt.evidence.generation, 1);
assert.equal(iosNetworkPathV1Receipt.evidence.transition_qualified, false);
assert.equal(iosNetworkPathV1Receipt.evidence.server_reachability_qualified, false);
assert.equal(iosNetworkPathV1Receipt.evidence.physical_device, false);
execFileSync(process.execPath, ["scripts/validate-ios-network-path.mjs"], { stdio: "ignore" });

const iosQualificationPolicyV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/ios-simulator-first-qualification-policy-v1.json", "utf8",
));
assert.equal(iosQualificationPolicyV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-ios-qualification-policy/v1");
assert.equal(iosQualificationPolicyV1Receipt.qualified, true);
assert.equal(iosQualificationPolicyV1Receipt.admitted, false);
assert.equal(iosQualificationPolicyV1Receipt.released, false);
execFileSync("git", ["cat-file", "-e", `${iosQualificationPolicyV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosQualificationPolicyV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosQualificationPolicyV1Receipt.source)) {
  assert.equal(digestAt(iosQualificationPolicyV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained iOS Simulator-first policy source drift`);
}
assert.equal(iosQualificationPolicyV1Receipt.evidence.status, "PASS");
assert.deepEqual(iosQualificationPolicyV1Receipt.evidence.primary_target, {
  os: "ios", architecture: "aarch64", environment: "simulator", embedding: "native",
});
assert.equal(iosQualificationPolicyV1Receipt.evidence.release_eligibility_requires_physical_device, false);
assert.equal(iosQualificationPolicyV1Receipt.evidence.admission_eligibility_requires_physical_device, false);
assert.equal(iosQualificationPolicyV1Receipt.evidence.fixed_host_api_change, false);
execFileSync(process.execPath, ["scripts/validate-ios-qualification-policy.mjs"], { stdio: "ignore" });

const frozenIdentityFiles = [
  "release.json",
  "channels/prod.json",
  "channels/candidates/0.0.15.json",
];
for (const relative of frozenIdentityFiles) {
  const tagged = execFileSync("git", ["show", `v0.0.15:${relative}`]);
  const current = fs.readFileSync(relative);
  assert.deepEqual(current, tagged, `${relative} must remain byte-identical to v0.0.15`);
}

const receipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/local-qualification.json", "utf8"));
assert.equal(receipt.schema, "wasmc.host-lib-defined-boundary-local-qualification/v1");
assert.equal(receipt.status, "local-node-qualified-not-admitted-not-released");
assert.equal(receipt.admitted, false);
assert.equal(receipt.released, false);
execFileSync("git", ["cat-file", "-e", `${receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", receipt.implementation_commit, "HEAD"]);
assert.equal(digest(receipt.executor.path), receipt.executor.sha256);
for (const lib of receipt.system_libs) {
  assert.equal(digest(`${lib.root}/lib.wit`), lib.wit_sha256);
  assert.equal(digest(`${lib.root}/native-boundary.json`), lib.descriptor_sha256);
  assert.equal(digest(`${lib.root}/native-adapter.mjs`), lib.adapter_sha256);
}
assert.equal(receipt.evidence.status, "PASS");
assert.equal(receipt.evidence.unchanged_executor_domains, 3);
assert.deepEqual(receipt.evidence.final_counts, { resources: 0, windows: 0, operations: 0 });

const linuxReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-qualification.json", "utf8"));
assert.equal(linuxReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v1");
assert.equal(linuxReceipt.status, "linux-aarch64-local-qualified-not-admitted-not-released");
assert.equal(linuxReceipt.admitted, false);
assert.equal(linuxReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxReceipt.source)) {
  assert.equal(
    digestAt(linuxReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained Linux qualification source drift`,
  );
}
assert.equal(linuxReceipt.evidence.status, "PASS");
assert.equal(linuxReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxReceipt.evidence.adapter_device_path_literals, 0);
assert.deepEqual(linuxReceipt.evidence.real_linux_endpoints, {
  dev_zero: true,
  dev_null: true,
  proc_self_stat: true,
  sys_cpu_online: true,
});
assert.equal(linuxReceipt.evidence.adapter_identity_rejection, true);

const linuxX86Receipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-qualification.json", "utf8"));
assert.equal(linuxX86Receipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v1");
assert.equal(linuxX86Receipt.status, "linux-x86_64-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86Receipt.workflow.run_id, 36298739381);
assert.equal(linuxX86Receipt.workflow.conclusion, "success");
assert.equal(linuxX86Receipt.admitted, false);
assert.equal(linuxX86Receipt.released, false);
for (const revision of [linuxX86Receipt.implementation_commit, linuxX86Receipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
assert.equal(linuxX86Receipt.evidence.status, "PASS");
assert.equal(linuxX86Receipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxX86Receipt.evidence.adapter_device_path_literals, 0);
assert.deepEqual(linuxX86Receipt.evidence.real_linux_endpoints, linuxReceipt.evidence.real_linux_endpoints);
assert.equal(linuxX86Receipt.evidence.adapter_identity_rejection, true);

const linuxPersistentReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-persistent-v2.json", "utf8"));
assert.equal(linuxPersistentReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v2");
assert.equal(linuxPersistentReceipt.status, "linux-aarch64-persistent-session-qualified-not-admitted-not-released");
assert.equal(linuxPersistentReceipt.admitted, false);
assert.equal(linuxPersistentReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxPersistentReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxPersistentReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxPersistentReceipt.source)) {
  assert.equal(
    digestAt(linuxPersistentReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained persistent Linux qualification source drift`,
  );
}
assert.equal(linuxPersistentReceipt.evidence.status, "PASS");
assert.equal(linuxPersistentReceipt.evidence.persistent_fd_resources, true);
assert.equal(linuxPersistentReceipt.evidence.generation_checked_stale_handle_rejection, true);
assert.equal(linuxPersistentReceipt.evidence.real_ioctl, "TIOCGPTN");
assert.equal(linuxPersistentReceipt.evidence.real_poll, true);
assert.ok(linuxPersistentReceipt.evidence.performance.read_mib_per_second >= linuxPersistentReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxPersistentReceipt.evidence.performance.write_mib_per_second >= linuxPersistentReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxPersistentReceipt.evidence.performance.persistent_speedup >= linuxPersistentReceipt.evidence.performance.minimum_speedup);

const linuxX86PersistentReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-persistent-v2.json", "utf8"));
assert.equal(linuxX86PersistentReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v2");
assert.equal(linuxX86PersistentReceipt.status, "linux-x86_64-persistent-session-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86PersistentReceipt.workflow.run_id, 36299428864);
assert.equal(linuxX86PersistentReceipt.workflow.conclusion, "success");
assert.equal(linuxX86PersistentReceipt.admitted, false);
assert.equal(linuxX86PersistentReceipt.released, false);
for (const revision of [linuxX86PersistentReceipt.implementation_commit, linuxX86PersistentReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
assert.equal(linuxX86PersistentReceipt.evidence.status, "PASS");
assert.equal(linuxX86PersistentReceipt.evidence.persistent_fd_resources, true);
assert.equal(linuxX86PersistentReceipt.evidence.generation_checked_stale_handle_rejection, true);
assert.equal(linuxX86PersistentReceipt.evidence.real_ioctl, "TIOCGPTN");
assert.equal(linuxX86PersistentReceipt.evidence.real_poll, true);
assert.ok(linuxX86PersistentReceipt.evidence.performance.read_mib_per_second >= linuxX86PersistentReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86PersistentReceipt.evidence.performance.write_mib_per_second >= linuxX86PersistentReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86PersistentReceipt.evidence.performance.persistent_speedup >= linuxX86PersistentReceipt.evidence.performance.minimum_speedup);

const linuxMappedReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-mapped-v3.json", "utf8"));
assert.equal(linuxMappedReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v3");
assert.equal(linuxMappedReceipt.status, "linux-aarch64-mapped-device-window-qualified-not-admitted-not-released");
assert.equal(linuxMappedReceipt.admitted, false);
assert.equal(linuxMappedReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxMappedReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxMappedReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxMappedReceipt.source)) {
  assert.equal(
    digestAt(linuxMappedReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained mapped Linux qualification source drift`,
  );
}
assert.equal(linuxMappedReceipt.evidence.status, "PASS");
assert.equal(linuxMappedReceipt.evidence.mapped_device_window, true);
assert.equal(linuxMappedReceipt.evidence.mapping_write_read_match, true);
assert.equal(linuxMappedReceipt.evidence.mapping_sync, true);
assert.equal(linuxMappedReceipt.evidence.mapping_bounds_rejection, true);
assert.equal(linuxMappedReceipt.evidence.generation_checked_stale_mapping_rejection, true);
assert.ok(linuxMappedReceipt.evidence.performance.mapping_mib_per_second >= linuxMappedReceipt.evidence.performance.minimum_mib_per_second);

const linuxX86MappedReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-mapped-v3.json", "utf8"));
assert.equal(linuxX86MappedReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v3");
assert.equal(linuxX86MappedReceipt.status, "linux-x86_64-mapped-device-window-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86MappedReceipt.workflow.run_id, 36300032417);
assert.equal(linuxX86MappedReceipt.workflow.conclusion, "success");
assert.equal(linuxX86MappedReceipt.admitted, false);
assert.equal(linuxX86MappedReceipt.released, false);
for (const revision of [linuxX86MappedReceipt.implementation_commit, linuxX86MappedReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
assert.equal(linuxX86MappedReceipt.evidence.status, "PASS");
assert.equal(linuxX86MappedReceipt.evidence.mapped_device_window, true);
assert.equal(linuxX86MappedReceipt.evidence.mapping_write_read_match, true);
assert.equal(linuxX86MappedReceipt.evidence.mapping_sync, true);
assert.equal(linuxX86MappedReceipt.evidence.mapping_bounds_rejection, true);
assert.equal(linuxX86MappedReceipt.evidence.generation_checked_stale_mapping_rejection, true);
assert.ok(linuxX86MappedReceipt.evidence.performance.mapping_mib_per_second >= linuxX86MappedReceipt.evidence.performance.minimum_mib_per_second);

const linuxEpollReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-epoll-v4.json", "utf8"));
assert.equal(linuxEpollReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v4");
assert.equal(linuxEpollReceipt.status, "linux-aarch64-epoll-device-readiness-qualified-not-admitted-not-released");
assert.equal(linuxEpollReceipt.admitted, false);
assert.equal(linuxEpollReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxEpollReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxEpollReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxEpollReceipt.source)) {
  assert.equal(
    digestAt(linuxEpollReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained epoll Linux qualification source drift`,
  );
}
assert.equal(linuxEpollReceipt.evidence.status, "PASS");
assert.equal(linuxEpollReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxEpollReceipt.evidence.real_epoll_device_event, true);
assert.equal(linuxEpollReceipt.evidence.epoll_endpoint, "/dev/ptmx");
assert.equal(linuxEpollReceipt.evidence.epoll_add_wait_read_delete, true);
assert.equal(linuxEpollReceipt.evidence.generation_checked_stale_event_set_rejection, true);
assert.equal(linuxEpollReceipt.evidence.fixed_executor_unchanged_from_v3, true);
assert.ok(linuxEpollReceipt.evidence.performance.read_mib_per_second >= linuxEpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxEpollReceipt.evidence.performance.write_mib_per_second >= linuxEpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxEpollReceipt.evidence.performance.mapping_mib_per_second >= linuxEpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxEpollReceipt.evidence.performance.persistent_speedup >= linuxEpollReceipt.evidence.performance.minimum_speedup);

const linuxX86EpollReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-epoll-v4.json", "utf8"));
assert.equal(linuxX86EpollReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v4");
assert.equal(linuxX86EpollReceipt.status, "linux-x86_64-epoll-device-readiness-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86EpollReceipt.workflow.run_id, 36300559026);
assert.equal(linuxX86EpollReceipt.workflow.conclusion, "success");
assert.equal(linuxX86EpollReceipt.admitted, false);
assert.equal(linuxX86EpollReceipt.released, false);
for (const revision of [linuxX86EpollReceipt.implementation_commit, linuxX86EpollReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
for (const [relative, expected] of Object.entries(linuxX86EpollReceipt.source)) {
  assert.equal(
    digestAt(linuxX86EpollReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained x86_64 epoll Linux qualification source drift`,
  );
}
assert.equal(linuxX86EpollReceipt.evidence.status, "PASS");
assert.equal(linuxX86EpollReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxX86EpollReceipt.evidence.real_epoll_device_event, true);
assert.equal(linuxX86EpollReceipt.evidence.epoll_endpoint, linuxEpollReceipt.evidence.epoll_endpoint);
assert.equal(linuxX86EpollReceipt.evidence.epoll_add_wait_read_delete, true);
assert.equal(linuxX86EpollReceipt.evidence.generation_checked_stale_event_set_rejection, true);
assert.equal(linuxX86EpollReceipt.evidence.fixed_executor_unchanged_from_v3, true);
assert.ok(linuxX86EpollReceipt.evidence.performance.read_mib_per_second >= linuxX86EpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86EpollReceipt.evidence.performance.write_mib_per_second >= linuxX86EpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86EpollReceipt.evidence.performance.mapping_mib_per_second >= linuxX86EpollReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86EpollReceipt.evidence.performance.persistent_speedup >= linuxX86EpollReceipt.evidence.performance.minimum_speedup);

const linuxSpliceReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-splice-v5.json", "utf8"));
assert.equal(linuxSpliceReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v5");
assert.equal(linuxSpliceReceipt.status, "linux-aarch64-kernel-splice-device-path-qualified-not-admitted-not-released");
assert.equal(linuxSpliceReceipt.admitted, false);
assert.equal(linuxSpliceReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxSpliceReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxSpliceReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxSpliceReceipt.source)) {
  assert.equal(
    digestAt(linuxSpliceReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained splice Linux qualification source drift`,
  );
}
assert.equal(linuxSpliceReceipt.evidence.status, "PASS");
assert.equal(linuxSpliceReceipt.evidence.wit_parsed, true);
assert.equal(linuxSpliceReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxSpliceReceipt.evidence.kernel_splice_device_path, true);
assert.equal(linuxSpliceReceipt.evidence.splice_path, "/dev/zero -> pipe -> /dev/null");
assert.equal(linuxSpliceReceipt.evidence.payload_enters_executor_window, false);
assert.equal(linuxSpliceReceipt.evidence.generation_checked_stale_pipe_rejection, true);
assert.equal(linuxSpliceReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4, true);
assert.ok(linuxSpliceReceipt.evidence.performance.read_mib_per_second >= linuxSpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxSpliceReceipt.evidence.performance.write_mib_per_second >= linuxSpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxSpliceReceipt.evidence.performance.mapping_mib_per_second >= linuxSpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxSpliceReceipt.evidence.performance.splice_mib_per_second >= linuxSpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxSpliceReceipt.evidence.performance.persistent_speedup >= linuxSpliceReceipt.evidence.performance.minimum_speedup);

const linuxX86SpliceReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-splice-v5.json", "utf8"));
assert.equal(linuxX86SpliceReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v5");
assert.equal(linuxX86SpliceReceipt.status, "linux-x86_64-kernel-splice-device-path-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86SpliceReceipt.workflow.run_id, 36301089197);
assert.equal(linuxX86SpliceReceipt.workflow.conclusion, "success");
assert.equal(linuxX86SpliceReceipt.admitted, false);
assert.equal(linuxX86SpliceReceipt.released, false);
for (const revision of [linuxX86SpliceReceipt.implementation_commit, linuxX86SpliceReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
for (const [relative, expected] of Object.entries(linuxX86SpliceReceipt.source)) {
  assert.equal(
    digestAt(linuxX86SpliceReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained x86_64 splice Linux qualification source drift`,
  );
}
assert.equal(linuxX86SpliceReceipt.evidence.status, "PASS");
assert.equal(linuxX86SpliceReceipt.evidence.wit_parsed, true);
assert.equal(linuxX86SpliceReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxX86SpliceReceipt.evidence.kernel_splice_device_path, true);
assert.equal(linuxX86SpliceReceipt.evidence.splice_path, linuxSpliceReceipt.evidence.splice_path);
assert.equal(linuxX86SpliceReceipt.evidence.payload_enters_executor_window, false);
assert.equal(linuxX86SpliceReceipt.evidence.generation_checked_stale_pipe_rejection, true);
assert.equal(linuxX86SpliceReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4, true);
assert.ok(linuxX86SpliceReceipt.evidence.performance.read_mib_per_second >= linuxX86SpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86SpliceReceipt.evidence.performance.write_mib_per_second >= linuxX86SpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86SpliceReceipt.evidence.performance.mapping_mib_per_second >= linuxX86SpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86SpliceReceipt.evidence.performance.splice_mib_per_second >= linuxX86SpliceReceipt.evidence.performance.minimum_mib_per_second);
assert.ok(linuxX86SpliceReceipt.evidence.performance.persistent_speedup >= linuxX86SpliceReceipt.evidence.performance.minimum_speedup);

const linuxAsyncReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-async-readiness-v6.json", "utf8"));
assert.equal(linuxAsyncReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v6");
assert.equal(linuxAsyncReceipt.status, "linux-aarch64-asynchronous-readiness-lifecycle-qualified-not-admitted-not-released");
assert.equal(linuxAsyncReceipt.admitted, false);
assert.equal(linuxAsyncReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxAsyncReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxAsyncReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxAsyncReceipt.source)) {
  assert.equal(
    digestAt(linuxAsyncReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained async-readiness Linux qualification source drift`,
  );
}
assert.equal(linuxAsyncReceipt.evidence.status, "PASS");
assert.equal(linuxAsyncReceipt.evidence.wit_parsed, true);
assert.equal(linuxAsyncReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(linuxAsyncReceipt.evidence.asynchronous_readiness_lifecycle, true);
assert.equal(linuxAsyncReceipt.evidence.ready, true);
assert.equal(linuxAsyncReceipt.evidence.cancelled, true);
assert.equal(linuxAsyncReceipt.evidence.timed_out, true);
assert.equal(linuxAsyncReceipt.evidence.cancelled_late_readiness_suppressed, true);
assert.equal(linuxAsyncReceipt.evidence.pending_release_rejection, true);
assert.equal(linuxAsyncReceipt.evidence.repeated_terminal_cancel_rejection, true);
assert.equal(linuxAsyncReceipt.evidence.retained_endpoint_lifetime, true);
assert.equal(linuxAsyncReceipt.evidence.concurrent_operations, 64);
assert.equal(linuxAsyncReceipt.evidence.generation_checked_stale_operation_rejection, true);
assert.equal(linuxAsyncReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4_v5, true);
assert.ok(linuxAsyncReceipt.evidence.performance_regression.read_mib_per_second >= linuxAsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncReceipt.evidence.performance_regression.write_mib_per_second >= linuxAsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncReceipt.evidence.performance_regression.mapping_mib_per_second >= linuxAsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncReceipt.evidence.performance_regression.splice_mib_per_second >= linuxAsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncReceipt.evidence.performance_regression.persistent_speedup >= linuxAsyncReceipt.evidence.performance_regression.minimum_speedup);

const linuxX86AsyncRejection = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-async-readiness-v6-compile-rejection.json", "utf8"));
assert.equal(linuxX86AsyncRejection.schema, "wasmc.host-lib-defined-boundary-linux-rejection/v1");
assert.equal(linuxX86AsyncRejection.status, "linux-x86_64-async-readiness-compile-rejected");
assert.equal(linuxX86AsyncRejection.workflow.run_id, 36301745708);
assert.equal(linuxX86AsyncRejection.workflow.conclusion, "failure");
assert.equal(linuxX86AsyncRejection.rejection.stage, "native-adapter-compile");
assert.match(linuxX86AsyncRejection.rejection.diagnostic, /warn_unused_result/);
assert.equal(linuxX86AsyncRejection.qualified, false);
assert.equal(linuxX86AsyncRejection.admitted, false);
assert.equal(linuxX86AsyncRejection.released, false);

const linuxAsyncRemediatedReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-async-readiness-v6-r2.json", "utf8"));
assert.equal(linuxAsyncRemediatedReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v6");
assert.equal(linuxAsyncRemediatedReceipt.status, "linux-aarch64-asynchronous-readiness-remediated-qualified-not-admitted-not-released");
assert.equal(linuxAsyncRemediatedReceipt.remediates_rejection_run, linuxX86AsyncRejection.workflow.run_id);
assert.equal(linuxAsyncRemediatedReceipt.admitted, false);
assert.equal(linuxAsyncRemediatedReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxAsyncRemediatedReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxAsyncRemediatedReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxAsyncRemediatedReceipt.source)) {
  assert.equal(
    digestAt(linuxAsyncRemediatedReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained remediated async-readiness Linux qualification source drift`,
  );
}
assert.equal(linuxAsyncRemediatedReceipt.evidence.status, "PASS");
assert.equal(linuxAsyncRemediatedReceipt.evidence.cleanup_signal_result_consumed, true);
assert.equal(linuxAsyncRemediatedReceipt.evidence.asynchronous_readiness_lifecycle, true);
assert.equal(linuxAsyncRemediatedReceipt.evidence.cancelled_late_readiness_suppressed, true);
assert.equal(linuxAsyncRemediatedReceipt.evidence.concurrent_operations, 64);
assert.equal(linuxAsyncRemediatedReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4_v5, true);
assert.ok(linuxAsyncRemediatedReceipt.evidence.performance_regression.read_mib_per_second >= linuxAsyncRemediatedReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncRemediatedReceipt.evidence.performance_regression.write_mib_per_second >= linuxAsyncRemediatedReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncRemediatedReceipt.evidence.performance_regression.mapping_mib_per_second >= linuxAsyncRemediatedReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncRemediatedReceipt.evidence.performance_regression.splice_mib_per_second >= linuxAsyncRemediatedReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxAsyncRemediatedReceipt.evidence.performance_regression.persistent_speedup >= linuxAsyncRemediatedReceipt.evidence.performance_regression.minimum_speedup);

const linuxX86AsyncReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-async-readiness-v6.json", "utf8"));
assert.equal(linuxX86AsyncReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v6");
assert.equal(linuxX86AsyncReceipt.status, "linux-x86_64-asynchronous-readiness-remediated-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86AsyncReceipt.remediates_rejection_run, linuxX86AsyncRejection.workflow.run_id);
assert.equal(linuxX86AsyncReceipt.workflow.run_id, 36301909558);
assert.equal(linuxX86AsyncReceipt.workflow.conclusion, "success");
assert.equal(linuxX86AsyncReceipt.admitted, false);
assert.equal(linuxX86AsyncReceipt.released, false);
for (const revision of [linuxX86AsyncReceipt.implementation_commit, linuxX86AsyncReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
for (const [relative, expected] of Object.entries(linuxX86AsyncReceipt.source)) {
  assert.equal(
    digestAt(linuxX86AsyncReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained x86_64 async-readiness Linux qualification source drift`,
  );
}
assert.equal(linuxX86AsyncReceipt.evidence.status, "PASS");
assert.equal(linuxX86AsyncReceipt.evidence.strict_compile_remediation, true);
assert.equal(linuxX86AsyncReceipt.evidence.asynchronous_readiness_lifecycle, true);
assert.equal(linuxX86AsyncReceipt.evidence.cancelled_late_readiness_suppressed, true);
assert.equal(linuxX86AsyncReceipt.evidence.pending_release_rejection, true);
assert.equal(linuxX86AsyncReceipt.evidence.repeated_terminal_cancel_rejection, true);
assert.equal(linuxX86AsyncReceipt.evidence.retained_endpoint_lifetime, true);
assert.equal(linuxX86AsyncReceipt.evidence.concurrent_operations, 64);
assert.equal(linuxX86AsyncReceipt.evidence.generation_checked_stale_operation_rejection, true);
assert.equal(linuxX86AsyncReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4_v5, true);
assert.ok(linuxX86AsyncReceipt.evidence.performance_regression.read_mib_per_second >= linuxX86AsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxX86AsyncReceipt.evidence.performance_regression.write_mib_per_second >= linuxX86AsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxX86AsyncReceipt.evidence.performance_regression.mapping_mib_per_second >= linuxX86AsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxX86AsyncReceipt.evidence.performance_regression.splice_mib_per_second >= linuxX86AsyncReceipt.evidence.performance_regression.minimum_mib_per_second);
assert.ok(linuxX86AsyncReceipt.evidence.performance_regression.persistent_speedup >= linuxX86AsyncReceipt.evidence.performance_regression.minimum_speedup);

const linuxDeviceIoReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-device-io-v7.json", "utf8"));
assert.equal(linuxDeviceIoReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v7");
assert.equal(linuxDeviceIoReceipt.status, "linux-aarch64-ioctl-call-shapes-and-vectored-write-qualified-not-admitted-not-released");
assert.equal(linuxDeviceIoReceipt.admitted, false);
assert.equal(linuxDeviceIoReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxDeviceIoReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxDeviceIoReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxDeviceIoReceipt.source)) {
  assert.equal(
    digestAt(linuxDeviceIoReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained device-I/O Linux qualification source drift`,
  );
}
assert.equal(linuxDeviceIoReceipt.evidence.status, "PASS");
assert.equal(linuxDeviceIoReceipt.evidence.fixed_executor_domain_apis, 0);
assert.deepEqual(linuxDeviceIoReceipt.evidence.ioctl_call_shapes, ["none", "value", "buffer"]);
assert.equal(linuxDeviceIoReceipt.evidence.single_syscall_vectored_write, true);
assert.equal(linuxDeviceIoReceipt.evidence.vectored_write_segments, 64);
assert.equal(linuxDeviceIoReceipt.evidence.malformed_vectored_write_rejection, true);
assert.equal(linuxDeviceIoReceipt.evidence.generation_checked_stale_vectored_write_rejection, true);
assert.equal(linuxDeviceIoReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4_v5_v6, true);
for (const state of Object.values(linuxDeviceIoReceipt.evidence.device_backed_gates)) {
  assert.equal(state, "PENDING-NODE-NOT-EXPOSED");
}
assert.ok(linuxDeviceIoReceipt.evidence.performance_regression.vector_write_mib_per_second >= linuxDeviceIoReceipt.evidence.performance_regression.minimum_mib_per_second);

const linuxX86DeviceIoReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-device-io-v7.json", "utf8"));
assert.equal(linuxX86DeviceIoReceipt.schema, "wasmc.host-lib-defined-boundary-linux-qualification/v7");
assert.equal(linuxX86DeviceIoReceipt.status, "linux-x86_64-ioctl-call-shapes-and-vectored-write-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86DeviceIoReceipt.workflow.run_id, 36302980800);
assert.equal(linuxX86DeviceIoReceipt.workflow.conclusion, "success");
assert.equal(linuxX86DeviceIoReceipt.admitted, false);
assert.equal(linuxX86DeviceIoReceipt.released, false);
for (const revision of [linuxX86DeviceIoReceipt.implementation_commit, linuxX86DeviceIoReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
for (const [relative, expected] of Object.entries(linuxX86DeviceIoReceipt.source)) {
  assert.equal(
    digestAt(linuxX86DeviceIoReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained x86_64 device-I/O Linux qualification source drift`,
  );
}
assert.equal(linuxX86DeviceIoReceipt.evidence.status, "PASS");
assert.equal(linuxX86DeviceIoReceipt.evidence.fixed_executor_domain_apis, 0);
assert.deepEqual(linuxX86DeviceIoReceipt.evidence.ioctl_call_shapes, linuxDeviceIoReceipt.evidence.ioctl_call_shapes);
assert.equal(linuxX86DeviceIoReceipt.evidence.single_syscall_vectored_write, true);
assert.equal(linuxX86DeviceIoReceipt.evidence.vectored_write_segments, 64);
assert.equal(linuxX86DeviceIoReceipt.evidence.malformed_vectored_write_rejection, true);
assert.equal(linuxX86DeviceIoReceipt.evidence.generation_checked_stale_vectored_write_rejection, true);
assert.equal(linuxX86DeviceIoReceipt.evidence.fixed_executor_unchanged_from_v2_v3_v4_v5_v6, true);
assert.ok(linuxX86DeviceIoReceipt.evidence.performance_regression.vector_write_mib_per_second >= linuxX86DeviceIoReceipt.evidence.performance_regression.minimum_mib_per_second);

const linuxSocketReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-socket-v1.json", "utf8"));
assert.equal(linuxSocketReceipt.schema, "wasmc.host-lib-defined-boundary-linux-socket-qualification/v1");
assert.equal(linuxSocketReceipt.status, "linux-aarch64-lib-owned-tcp-socket-qualified-not-admitted-not-released");
assert.equal(linuxSocketReceipt.admitted, false);
assert.equal(linuxSocketReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${linuxSocketReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", linuxSocketReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(linuxSocketReceipt.source)) {
  assert.equal(
    digestAt(linuxSocketReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained Linux socket qualification source drift`,
  );
}
assert.equal(linuxSocketReceipt.evidence.status, "PASS");
assert.equal(linuxSocketReceipt.evidence.fixed_executor_network_apis, 0);
assert.equal(linuxSocketReceipt.evidence.fixed_executor_matches_endpoint_v7, true);
assert.equal(linuxSocketReceipt.evidence.real_loopback_tcp, true);
assert.equal(linuxSocketReceipt.evidence.bind_ephemeral_listen_connect_accept, true);
assert.equal(linuxSocketReceipt.evidence.bidirectional_stream, true);
assert.equal(linuxSocketReceipt.evidence.readiness_poll, true);
assert.equal(linuxSocketReceipt.evidence.write_half_close, true);
assert.equal(linuxSocketReceipt.evidence.concurrent_connections, 64);
assert.equal(linuxSocketReceipt.evidence.https_transport_migrated, false);
assert.ok(linuxSocketReceipt.evidence.performance.mib_per_second >= linuxSocketReceipt.evidence.performance.minimum_mib_per_second);

const linuxX86SocketReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-socket-v1.json", "utf8"));
assert.equal(linuxX86SocketReceipt.schema, "wasmc.host-lib-defined-boundary-linux-socket-qualification/v1");
assert.equal(linuxX86SocketReceipt.status, "linux-x86_64-lib-owned-tcp-socket-ci-qualified-not-admitted-not-released");
assert.equal(linuxX86SocketReceipt.workflow.run_id, 36304676571);
assert.equal(linuxX86SocketReceipt.workflow.conclusion, "success");
assert.equal(linuxX86SocketReceipt.admitted, false);
assert.equal(linuxX86SocketReceipt.released, false);
for (const revision of [linuxX86SocketReceipt.implementation_commit, linuxX86SocketReceipt.qualified_commit]) {
  execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"]);
}
for (const [relative, expected] of Object.entries(linuxX86SocketReceipt.source)) {
  assert.equal(
    digestAt(linuxX86SocketReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained x86_64 Linux socket qualification source drift`,
  );
}
assert.equal(linuxX86SocketReceipt.evidence.status, "PASS");
assert.equal(linuxX86SocketReceipt.evidence.fixed_executor_network_apis, 0);
assert.equal(linuxX86SocketReceipt.evidence.fixed_executor_matches_endpoint_v7, true);
assert.equal(linuxX86SocketReceipt.evidence.real_loopback_tcp, true);
assert.equal(linuxX86SocketReceipt.evidence.bind_ephemeral_listen_connect_accept, true);
assert.equal(linuxX86SocketReceipt.evidence.bidirectional_stream, true);
assert.equal(linuxX86SocketReceipt.evidence.readiness_poll, true);
assert.equal(linuxX86SocketReceipt.evidence.write_half_close, true);
assert.equal(linuxX86SocketReceipt.evidence.concurrent_connections, linuxSocketReceipt.evidence.concurrent_connections);
assert.equal(linuxX86SocketReceipt.evidence.https_transport_migrated, false);
assert.ok(linuxX86SocketReceipt.evidence.performance.mib_per_second >= linuxX86SocketReceipt.evidence.performance.minimum_mib_per_second);

const httpsSocketMigrationReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-https-socket-migration-v1.json", "utf8"));
assert.equal(httpsSocketMigrationReceipt.schema, "wasmc.host-lib-defined-boundary-https-socket-migration/v1");
assert.equal(httpsSocketMigrationReceipt.status, "linux-x86_64-https-lib-socket-qualified-not-admitted-not-released");
assert.equal(httpsSocketMigrationReceipt.workflow.run_id, 36316303486);
assert.equal(httpsSocketMigrationReceipt.workflow.conclusion, "success");
assert.equal(httpsSocketMigrationReceipt.admitted, false);
assert.equal(httpsSocketMigrationReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${httpsSocketMigrationReceipt.qualified_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", httpsSocketMigrationReceipt.qualified_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(httpsSocketMigrationReceipt.source)) {
  assert.equal(
    digestAt(httpsSocketMigrationReceipt.qualified_commit, relative),
    expected,
    `${relative}: retained HTTPS socket migration source drift`,
  );
}
assert.equal(httpsSocketMigrationReceipt.evidence.status, "PASS");
assert.equal(httpsSocketMigrationReceipt.evidence.execution, "in-process-exact-adapter");
assert.equal(httpsSocketMigrationReceipt.evidence.semantic_parity, true);
assert.equal(httpsSocketMigrationReceipt.evidence.host_operations, httpsSocketMigrationReceipt.evidence.host_waits);
assert.equal(httpsSocketMigrationReceipt.evidence.host_operations, httpsSocketMigrationReceipt.evidence.host_claimed);
assert.ok(httpsSocketMigrationReceipt.evidence.host_partial_writes > 0);
assert.ok(
  httpsSocketMigrationReceipt.evidence.performance.paired_rps_ratio_p50 >=
    httpsSocketMigrationReceipt.evidence.performance.minimum_paired_rps_ratio_p50,
);

const linuxUinputReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-aarch64-uinput-v1.json", "utf8"));
const linuxX86UinputReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/linux-x86_64-uinput-v1.json", "utf8"));
for (const [receipt, architecture] of [[linuxUinputReceipt, "aarch64"], [linuxX86UinputReceipt, "x86_64"]]) {
  assert.equal(receipt.schema, "wasmc.host-lib-defined-boundary-uinput-qualification/v1");
  assert.equal(receipt.system_lib_identity, "wasmc:system-linux-uinput@0.0.1-dev.1");
  assert.equal(receipt.environment.architecture, architecture);
  assert.equal(receipt.admitted, false);
  assert.equal(receipt.released, false);
  execFileSync("git", ["cat-file", "-e", `${receipt.implementation_commit}^{commit}`]);
  execFileSync("git", ["merge-base", "--is-ancestor", receipt.implementation_commit, "HEAD"]);
  for (const [relative, expected] of Object.entries(receipt.source)) {
    assert.equal(
      digestAt(receipt.implementation_commit, relative),
      expected,
      `${relative}: retained ${architecture} UInput qualification source drift`,
    );
  }
  assert.equal(receipt.evidence.status, "PASS");
  assert.equal(receipt.evidence.real_uinput_device_created, true);
  assert.equal(receipt.evidence.real_key_down_observed, true);
  assert.equal(receipt.evidence.real_key_up_observed, true);
  assert.equal(receipt.evidence.host_source_changes_required, 0);
  assert.equal(receipt.evidence.fixed_executor_uinput_apis, 0);
  assert.equal(receipt.evidence.fixed_executor_matches_device_io_v7, true);
  assert.equal(receipt.evidence.exact_adapter_identity, true);
  assert.equal(receipt.evidence.generation_checked_stale_keyboard_rejection, true);
  assert.equal(receipt.evidence.malformed_profile_rejection, true);
  assert.equal(receipt.evidence.adapter_identity_rejection, true);
  assert.equal(receipt.evidence.batch.one_kernel_write_per_batch, true);
  assert.ok(receipt.evidence.batch.key_events_per_second >= receipt.evidence.batch.minimum_key_events_per_second);
}
assert.equal(linuxUinputReceipt.outputs.executor_sha256, linuxDeviceIoReceipt.outputs.executor_sha256);
assert.equal(linuxX86UinputReceipt.outputs.executor_sha256, linuxX86DeviceIoReceipt.outputs.executor_sha256);
assert.equal(linuxX86UinputReceipt.workflow.run_id, 36318024206);
assert.equal(linuxX86UinputReceipt.workflow.conclusion, "success");
assert.equal(linuxX86UinputReceipt.qualified_commit, linuxX86UinputReceipt.implementation_commit);

const androidReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/android-arm64-agent-computer-v1.json", "utf8"));
assert.equal(androidReceipt.schema, "wasmc.host-lib-defined-boundary-android-qualification/v1");
assert.equal(androidReceipt.status, "android-16-arm64-emulator-agent-computer-qualified-not-admitted-not-released");
assert.equal(androidReceipt.environment.architecture, "arm64-v8a");
assert.equal(androidReceipt.environment.android_api, 36);
assert.equal(androidReceipt.admitted, false);
assert.equal(androidReceipt.released, false);
execFileSync("git", ["cat-file", "-e", `${androidReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", androidReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(androidReceipt.source)) {
  assert.equal(
    digestAt(androidReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained Android agent-computer qualification source drift`,
  );
}
assert.equal(androidReceipt.evidence.status, "PASS");
assert.equal(androidReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(androidReceipt.evidence.semantic_ui_query, true);
assert.equal(androidReceipt.evidence.focus_precondition_observed, true);
assert.equal(androidReceipt.evidence.exact_text_postcondition, "display");
assert.deepEqual(androidReceipt.evidence.result_semantics, ["Font size", "Display size"]);
assert.equal(androidReceipt.evidence.malformed_operation_rejection, true);
assert.equal(androidReceipt.evidence.adapter_identity_rejection, true);
assert.equal(androidReceipt.evidence.host_source_changes_after_baseline_required, 0);
assert.equal(androidReceipt.evidence.wasm_lowering, false);
assert.equal(androidReceipt.evidence.direct_android_uinput, false);
assert.equal(androidReceipt.evidence.physical_device_qualification, false);
assert.equal(new Set(Object.values(androidReceipt.evidence.real_frame)).size, 5);

const androidV2Receipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/android-arm64-agent-computer-v2.json", "utf8"));
assert.equal(androidV2Receipt.schema, "wasmc.host-lib-defined-boundary-android-qualification/v2");
assert.equal(androidV2Receipt.status, "android-16-arm64-emulator-direct-uinput-and-host-boundary-qualified-not-admitted-not-released");
assert.equal(androidV2Receipt.environment.architecture, "arm64-v8a");
assert.equal(androidV2Receipt.environment.android_api, 36);
assert.equal(androidV2Receipt.admitted, false);
assert.equal(androidV2Receipt.released, false);
execFileSync("git", ["cat-file", "-e", `${androidV2Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", androidV2Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(androidV2Receipt.source)) {
  assert.equal(
    digestAt(androidV2Receipt.implementation_commit, relative),
    expected,
    `${relative}: retained Android v2 qualification source drift`,
  );
}
assert.equal(androidV2Receipt.evidence.status, "PASS");
assert.equal(androidV2Receipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(androidV2Receipt.evidence.host_source_changes_after_v1, 0);
assert.equal(androidV2Receipt.outputs.executor_sha256, androidReceipt.outputs.executor_sha256);
assert.equal(androidV2Receipt.outputs.executor_matches_v1, true);
assert.equal(androidV2Receipt.evidence.direct_uinput_device, "/dev/uinput");
assert.equal(androidV2Receipt.evidence.persistent_session, true);
assert.equal(androidV2Receipt.evidence.malformed_status_recovery, true);
assert.equal(androidV2Receipt.evidence.batch_input_events, 14);
assert.equal(androidV2Receipt.evidence.kernel_events, 28);
assert.equal(androidV2Receipt.evidence.performance_gate, false);
assert.equal(androidV2Receipt.evidence.semantic_text_postcondition, "display");
assert.equal(androidV2Receipt.evidence.generation_checked_stale_resource_rejection, true);
assert.equal(androidV2Receipt.evidence.resource_recreation, true);
assert.equal(androidV2Receipt.evidence.input_limit_rejection, true);
assert.equal(androidV2Receipt.evidence.output_limit_rejection, true);
assert.equal(androidV2Receipt.evidence.missing_export_rejection, true);
assert.equal(androidV2Receipt.evidence.adapter_sibling_confinement, true);
assert.equal(androidV2Receipt.evidence.wasm_lowering, false);
assert.equal(androidV2Receipt.evidence.physical_device_qualification, false);

const androidV3Receipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/android-arm64-agent-computer-v3.json", "utf8"));
assert.equal(androidV3Receipt.schema, "wasmc.host-lib-defined-boundary-android-qualification/v3");
assert.equal(androidV3Receipt.status, "android-16-arm64-emulator-direct-uinput-touchscreen-and-session-lifecycle-qualified-not-admitted-not-released");
assert.equal(androidV3Receipt.environment.architecture, "arm64-v8a");
assert.equal(androidV3Receipt.environment.android_api, 36);
assert.equal(androidV3Receipt.admitted, false);
assert.equal(androidV3Receipt.released, false);
execFileSync("git", ["cat-file", "-e", `${androidV3Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", androidV3Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(androidV3Receipt.source)) {
  assert.equal(
    digestAt(androidV3Receipt.implementation_commit, relative),
    expected,
    `${relative}: retained Android v3 qualification source drift`,
  );
}
assert.equal(androidV3Receipt.evidence.status, "PASS");
assert.equal(androidV3Receipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(androidV3Receipt.evidence.host_source_changes_after_v1, 0);
assert.equal(androidV3Receipt.outputs.executor_sha256, androidV2Receipt.outputs.executor_sha256);
assert.equal(androidV3Receipt.outputs.executor_matches_v1_and_v2, true);
assert.equal(androidV3Receipt.evidence.direct_uinput_device, "/dev/uinput");
assert.equal(androidV3Receipt.evidence.touchscreen_kernel_events_per_tap, 14);
assert.equal(androidV3Receipt.evidence.performance_gate, false);
assert.equal(androidV3Receipt.evidence.full_control_chain, "uinput-touch-uinput-keyboard-uinput-touch");
assert.equal(androidV3Receipt.evidence.semantic_text_postcondition, "display");
assert.deepEqual(androidV3Receipt.evidence.semantic_result_postconditions, ["Font size", "Display size"]);
assert.equal(androidV3Receipt.evidence.keyboard_generation_checked_stale_resource_rejection, true);
assert.equal(androidV3Receipt.evidence.touchscreen_generation_checked_stale_resource_rejection, true);
assert.equal(androidV3Receipt.evidence.session_eof_cleanup, true);
assert.equal(androidV3Receipt.evidence.parallel_session_isolation, true);
assert.equal(androidV3Receipt.evidence.resource_authority, "Android EventHub active-device state");
assert.equal(androidV3Receipt.evidence.input_reader_snapshot_not_used_as_resource_authority, true);
assert.equal(androidV3Receipt.evidence.emulator_boot_is_bounded, true);
assert.equal(androidV3Receipt.evidence.wasm_lowering, false);
assert.equal(androidV3Receipt.evidence.physical_device_qualification, false);

const androidV4Receipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/android-arm64-agent-computer-v4.json", "utf8"));
assert.equal(androidV4Receipt.schema, "wasmc.host-lib-defined-boundary-android-qualification/v4");
assert.equal(androidV4Receipt.status, "android-16-arm64-emulator-exact-profile-resolution-and-agent-computer-qualified-not-admitted-not-released");
assert.equal(androidV4Receipt.admitted, false);
assert.equal(androidV4Receipt.released, false);
assert.equal(androidV4Receipt.discoverable, false);
assert.equal(androidV4Receipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${androidV4Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", androidV4Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(androidV4Receipt.source)) {
  assert.equal(
    digestAt(androidV4Receipt.implementation_commit, relative),
    expected,
    `${relative}: retained Android v4 qualification source drift`,
  );
}
assert.equal(androidV4Receipt.outputs.executor_sha256, androidV3Receipt.outputs.executor_sha256);
assert.equal(androidV4Receipt.outputs.executor_matches_v1_through_v3, true);
assert.equal(androidV4Receipt.evidence.status, "PASS");
assert.equal(androidV4Receipt.evidence.profile_schema, "wasmc.library-os-profile/v2");
assert.deepEqual(androidV4Receipt.evidence.profile_target, {
  os: "android", architecture: "aarch64", environment: "emulator", embedding: "native",
});
assert.equal(androidV4Receipt.evidence.exact_profile_regeneration, true);
assert.equal(androidV4Receipt.evidence.resolved_bindings, 4);
assert.equal(androidV4Receipt.evidence.provider_name_inference, false);
assert.equal(androidV4Receipt.evidence.unique_match_required, true);
assert.equal(androidV4Receipt.evidence.ambiguous_provider_rejection, true);
assert.equal(androidV4Receipt.evidence.ambiguity_exact_pin, true);
assert.equal(androidV4Receipt.evidence.lifecycle_fail_closed, true);
assert.equal(androidV4Receipt.evidence.missing_target_rejections.length, 5);
assert.equal(androidV4Receipt.evidence.wit_package_identity_checked, true);
assert.equal(androidV4Receipt.evidence.descriptor_identity_checked, true);
assert.equal(androidV4Receipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(androidV4Receipt.evidence.bounded_ui_snapshot_publication, true);
assert.equal(androidV4Receipt.evidence.full_control_chain, "uinput-touch-uinput-keyboard-uinput-touch");
assert.equal(androidV4Receipt.evidence.session_eof_cleanup, true);
assert.equal(androidV4Receipt.evidence.parallel_session_isolation, true);
assert.equal(androidV4Receipt.evidence.performance_gate, false);
assert.equal(androidV4Receipt.evidence.wasm_lowering, false);
assert.equal(androidV4Receipt.evidence.physical_device_qualification, false);

const androidSystemAgentLabV1Receipt = JSON.parse(fs.readFileSync(
  "admission/host-lib-defined-boundary-v1/android-arm64-system-agent-lab-v1.json", "utf8",
));
assert.equal(androidSystemAgentLabV1Receipt.schema,
  "wasmc.host-lib-defined-boundary-android-system-agent-lab-qualification/v1");
assert.equal(androidSystemAgentLabV1Receipt.predecessor,
  "admission/host-lib-defined-boundary-v1/android-arm64-agent-computer-v4.json");
assert.equal(androidSystemAgentLabV1Receipt.qualified, true);
assert.equal(androidSystemAgentLabV1Receipt.admitted, false);
assert.equal(androidSystemAgentLabV1Receipt.released, false);
assert.equal(androidSystemAgentLabV1Receipt.discoverable, false);
assert.equal(androidSystemAgentLabV1Receipt.installable, false);
execFileSync("git", ["cat-file", "-e",
  `${androidSystemAgentLabV1Receipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor",
  androidSystemAgentLabV1Receipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(androidSystemAgentLabV1Receipt.source)) {
  assert.equal(digestAt(androidSystemAgentLabV1Receipt.implementation_commit, relative), expected,
    `${relative}: retained Android System Agent Lab v1 source drift`);
}
assert.equal(androidSystemAgentLabV1Receipt.evidence.status, "PASS");
assert.equal(androidSystemAgentLabV1Receipt.evidence.shared_cross_platform_composition_engine, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.focused_lib_qualifications_reused_without_copy, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.provider_count, 4);
assert.deepEqual(androidSystemAgentLabV1Receipt.evidence.provider_identities,
  [
    "wasmc:system-android-display@0.0.1-dev.1",
    "wasmc:system-android-ui@0.0.1-dev.1",
    "wasmc:system-android-input@0.0.1-dev.1",
    "wasmc:system-android-uinput@0.0.1-dev.1",
  ]);
assert.equal(androidSystemAgentLabV1Receipt.evidence.exact_profile_regeneration, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.duplicate_provider_rejected, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.plist_conflict_rejected, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.exclusive_resource_conflict_rejected, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.fixed_host_domain_apis, 0);
assert.equal(androidSystemAgentLabV1Receipt.evidence.real_frame.width, 1080);
assert.equal(androidSystemAgentLabV1Receipt.evidence.real_frame.height, 2400);
assert.equal(androidSystemAgentLabV1Receipt.evidence.semantic_ui_query, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.direct_uinput_keyboard, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.direct_uinput_touchscreen, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.generation_checked_stale_resource_rejection, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.session_eof_cleanup, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.parallel_session_isolation, true);
assert.equal(androidSystemAgentLabV1Receipt.evidence.physical_device_qualification, false);
assert.equal(androidSystemAgentLabV1Receipt.evidence.wasm_lowering, false);
assert.equal(androidSystemAgentLabV1Receipt.evidence.dynamic_component_loading, false);

const iosSimulatorReceipt = JSON.parse(fs.readFileSync("admission/host-lib-defined-boundary-v1/ios-arm64-simulator-observation-v1.json", "utf8"));
assert.equal(iosSimulatorReceipt.schema, "wasmc.host-lib-defined-boundary-ios-simulator-qualification/v1");
assert.equal(iosSimulatorReceipt.status, "ios-26.5-arm64-simulator-display-supervisor-qualified-not-admitted-not-released");
assert.equal(iosSimulatorReceipt.qualified, true);
assert.equal(iosSimulatorReceipt.admitted, false);
assert.equal(iosSimulatorReceipt.released, false);
assert.equal(iosSimulatorReceipt.discoverable, false);
assert.equal(iosSimulatorReceipt.installable, false);
execFileSync("git", ["cat-file", "-e", `${iosSimulatorReceipt.implementation_commit}^{commit}`]);
execFileSync("git", ["merge-base", "--is-ancestor", iosSimulatorReceipt.implementation_commit, "HEAD"]);
for (const [relative, expected] of Object.entries(iosSimulatorReceipt.source)) {
  assert.equal(
    digestAt(iosSimulatorReceipt.implementation_commit, relative),
    expected,
    `${relative}: retained iOS Simulator qualification source drift`,
  );
}
assert.equal(iosSimulatorReceipt.evidence.status, "PASS");
assert.deepEqual(iosSimulatorReceipt.evidence.profile_target, {
  os: "ios", architecture: "aarch64", environment: "simulator", embedding: "supervisor",
});
assert.equal(iosSimulatorReceipt.evidence.exact_profile_regeneration, true);
assert.equal(iosSimulatorReceipt.evidence.resolved_bindings, 1);
assert.equal(iosSimulatorReceipt.evidence.fixed_executor_domain_apis, 0);
assert.equal(iosSimulatorReceipt.evidence.real_settings_frame, true);
assert.equal(iosSimulatorReceipt.evidence.appearance_change_frame_postcondition, true);
assert.equal(iosSimulatorReceipt.evidence.adapter_identity_rejection, true);
assert.equal(iosSimulatorReceipt.evidence.input_limit_rejection, true);
assert.equal(iosSimulatorReceipt.evidence.missing_agent_capabilities_fail_closed.length, 3);
assert.equal(iosSimulatorReceipt.evidence.full_agent_profile, "provider.none");
assert.equal(iosSimulatorReceipt.evidence.physical_device_profile, "provider.none");
assert.equal(iosSimulatorReceipt.evidence.performance_gate, false);
assert.equal(iosSimulatorReceipt.evidence.independent_second_build_determinism, false);
assert.equal(iosSimulatorReceipt.evidence.ios_embedded_host, false);
assert.equal(iosSimulatorReceipt.evidence.physical_device_qualification, false);
assert.equal(iosSimulatorReceipt.evidence.wasm_lowering, false);

const oldCandidate = spawnSync(
  process.execPath,
  ["scripts/release-candidate.mjs", "verify", "channels/candidates/0.0.15.json"],
  { encoding: "utf8" },
);
assert.notEqual(oldCandidate.status, 0, "old v0.0.15 candidate must reject future Host architecture bytes");
assert.match(`${oldCandidate.stdout}\n${oldCandidate.stderr}`, /product drift rejected/);

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.host-lib-defined-boundary-workstream/v1",
  focused_checks: focused.length,
  frozen_identity_files: frozenIdentityFiles.length,
  retained_local_qualification: receipt.implementation_commit,
  retained_linux_aarch64_qualification: linuxReceipt.implementation_commit,
  retained_linux_x86_64_qualification: linuxX86Receipt.qualified_commit,
  retained_linux_aarch64_persistent_qualification: linuxPersistentReceipt.implementation_commit,
  retained_linux_x86_64_persistent_qualification: linuxX86PersistentReceipt.qualified_commit,
  retained_linux_aarch64_mapped_qualification: linuxMappedReceipt.implementation_commit,
  retained_linux_x86_64_mapped_qualification: linuxX86MappedReceipt.qualified_commit,
  retained_linux_aarch64_epoll_qualification: linuxEpollReceipt.implementation_commit,
  retained_linux_x86_64_epoll_qualification: linuxX86EpollReceipt.qualified_commit,
  retained_linux_aarch64_splice_qualification: linuxSpliceReceipt.implementation_commit,
  retained_linux_x86_64_splice_qualification: linuxX86SpliceReceipt.qualified_commit,
  retained_linux_aarch64_async_readiness_qualification: linuxAsyncReceipt.implementation_commit,
  retained_linux_x86_64_async_readiness_rejection: linuxX86AsyncRejection.qualified_commit,
  retained_linux_aarch64_async_readiness_remediated_qualification: linuxAsyncRemediatedReceipt.implementation_commit,
  retained_linux_x86_64_async_readiness_qualification: linuxX86AsyncReceipt.qualified_commit,
  retained_linux_aarch64_device_io_qualification: linuxDeviceIoReceipt.implementation_commit,
  retained_linux_x86_64_device_io_qualification: linuxX86DeviceIoReceipt.qualified_commit,
  retained_linux_aarch64_socket_qualification: linuxSocketReceipt.implementation_commit,
  retained_linux_x86_64_socket_qualification: linuxX86SocketReceipt.qualified_commit,
  retained_linux_x86_64_https_socket_migration: httpsSocketMigrationReceipt.qualified_commit,
  retained_linux_aarch64_uinput_qualification: linuxUinputReceipt.implementation_commit,
  retained_linux_x86_64_uinput_qualification: linuxX86UinputReceipt.qualified_commit,
  retained_android_arm64_agent_computer_qualification: androidReceipt.implementation_commit,
  retained_android_arm64_agent_computer_v2_qualification: androidV2Receipt.implementation_commit,
  retained_android_arm64_agent_computer_v3_qualification: androidV3Receipt.implementation_commit,
  retained_android_arm64_agent_computer_v4_qualification: androidV4Receipt.implementation_commit,
  retained_android_arm64_system_agent_lab_v1_qualification: androidSystemAgentLabV1Receipt.implementation_commit,
  retained_ios_arm64_simulator_observation_qualification: iosSimulatorReceipt.implementation_commit,
  retained_ios_arm64_app_capability_qualification: iosAppReceipt.implementation_commit,
  retained_ios_arm64_app_capability_v2_qualification: iosAppV2Receipt.implementation_commit,
  retained_ios_arm64_app_capability_v3_qualification: iosAppV3Receipt.implementation_commit,
  retained_ios_arm64_app_capability_v4_qualification: iosAppV4Receipt.implementation_commit,
  retained_ios_arm64_app_capability_v5_qualification: iosAppV5Receipt.implementation_commit,
  retained_ios_arm64_app_capability_v6_qualification: iosAppV6Receipt.implementation_commit,
  retained_ios_arm64_app_surface_control_v1_qualification: iosSurfaceReceipt.implementation_commit,
  retained_ios_arm64_app_surface_control_v2_qualification: iosSurfaceV2Receipt.implementation_commit,
  retained_ios_arm64_app_surface_control_v3_qualification: iosSurfaceV3Receipt.implementation_commit,
  retained_ios_arm64_app_surface_control_v4_qualification: iosSurfaceV4Receipt.implementation_commit,
  retained_ios_arm64_app_surface_control_v5_qualification: iosSurfaceV5Receipt.implementation_commit,
  retained_ios_arm64_app_surface_control_v6_qualification: iosSurfaceV6Receipt.implementation_commit,
  retained_ios_arm64_system_agent_lab_v1_qualification: iosSystemAgentLabV1Receipt.implementation_commit,
  retained_ios_arm64_app_lifecycle_v1_qualification: iosLifecycleV1Receipt.implementation_commit,
  retained_ios_arm64_finite_background_window_v1_qualification:
    iosFiniteBackgroundWindowV1Receipt.implementation_commit,
  retained_ios_arm64_finite_background_window_matrix_v1_qualification:
    iosFiniteBackgroundWindowMatrixV1Receipt.implementation_commit,
  retained_ios_arm64_background_transfer_v1_qualification: iosBackgroundTransferV1Receipt.implementation_commit,
  retained_ios_arm64_background_transfer_v2_qualification: iosBackgroundTransferV2Receipt.implementation_commit,
  retained_ios_arm64_deferred_work_simulator_rejection_v1: iosDeferredWorkRejectionV1.implementation_commit,
  retained_ios_arm64_background_audio_v1_qualification: iosBackgroundAudioV1Receipt.implementation_commit,
  retained_ios_arm64_local_notification_v1_qualification: iosLocalNotificationV1Receipt.implementation_commit,
  retained_ios_arm64_websocket_v1_qualification: iosWebSocketV1Receipt.implementation_commit,
  retained_ios_arm64_websocket_v2_qualification: iosWebSocketV2Receipt.implementation_commit,
  retained_ios_arm64_websocket_v3_qualification: iosWebSocketV3Receipt.implementation_commit,
  retained_ios_arm64_websocket_v4_qualification: iosWebSocketV4Receipt.implementation_commit,
  retained_ios_arm64_websocket_v5_qualification: iosWebSocketV5Receipt.implementation_commit,
  retained_ios_arm64_network_path_v1_qualification: iosNetworkPathV1Receipt.implementation_commit,
  retained_ios_simulator_first_qualification_policy_v1: iosQualificationPolicyV1Receipt.implementation_commit,
  old_candidate_rejects_product_drift: true,
  lifecycle: "architecture-workstream-not-admitted-not-released",
}));
