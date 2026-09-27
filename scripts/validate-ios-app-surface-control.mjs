import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const fixedHost = "host/tests/ios-app-capability/Host/FixedHost.swift";
const fixedHostDigest = createHash("sha256").update(fs.readFileSync(fixedHost)).digest("hex");
assert.equal(fixedHostDigest, "f0d465ba7f23698d6365453b02fad2f4a0803171f970631751fc90a00a86d96f");

const root = "host/tests/ios-app-surface-control";
const libRoot = "libsrc/wasmc-system-ios-app-surface-control";
const required = [
  "project.yml",
  "App/Info.plist",
  "App/TaskSurfaceCard.swift",
  "App/SurfaceDemoViewController.swift",
  "App/AppDelegate.swift",
  "UITests/SurfaceControlUITests.swift",
];
for (const relative of required) assert.ok(fs.statSync(`${root}/${relative}`).size > 0, relative);
for (const relative of [
  "candidate.json",
  "lib.wit",
  "platform/ios/binding.json",
  "platform/ios/Sources/SurfaceControlProvider.swift",
  "platform/ios/Sources/PiPSurfaceProvider.swift",
]) assert.ok(fs.statSync(`${libRoot}/${relative}`).size > 0, relative);

execFileSync("wasm-tools", ["component", "wit", `${libRoot}/lib.wit`], {
  stdio: "ignore",
});
const provider = fs.readFileSync(`${libRoot}/platform/ios/Sources/SurfaceControlProvider.swift`, "utf8");
const controller = fs.readFileSync(`${root}/App/SurfaceDemoViewController.swift`, "utf8");
const pipProvider = fs.readFileSync(`${libRoot}/platform/ios/Sources/PiPSurfaceProvider.swift`, "utf8");
const candidate = JSON.parse(fs.readFileSync(`${libRoot}/candidate.json`, "utf8"));
const binding = JSON.parse(fs.readFileSync(`${libRoot}/platform/ios/binding.json`, "utf8"));
const resolvedProfile = JSON.parse(execFileSync(process.execPath, [
  "host/platform/profile-resolver.mjs", "resolve",
  "host/platform/ios/app-surface-control-request.json",
], { encoding: "utf8" }));
const retainedProfile = JSON.parse(fs.readFileSync(
  "host/platform/ios/app-surface-control-profile.json", "utf8",
));
assert.deepEqual(resolvedProfile, retainedProfile);
assert.equal(candidate.system_binding.implements, "wasmc:system-app-surface-control@0.0.2");
assert.equal(candidate.system_binding.artifact_format, "embedded-source");
assert.equal(binding.schema, "wasmc.platform-binding-descriptor/v1");
assert.equal(binding.identity, "wasmc:system-ios-app-surface-control@0.0.2-dev.1");
assert.equal(binding.artifact.format, "embedded-source");
assert.equal(retainedProfile.host.required_domain_apis, 0);
assert.equal(fs.existsSync(`${root}/Lib/SurfaceControlProvider.swift`), false);
assert.equal(fs.existsSync(`${root}/Lib/PiPSurfaceProvider.swift`), false);
assert.equal(fs.existsSync(`${root}/WIT/app-surface-control.wit`), false);
assert.doesNotMatch(provider, /sendEvent|XCTest|XCUIApplication/);
assert.match(provider, /sendActions\(for: \.primaryActionTriggered\)/);
assert.match(controller, /background_surfaces_progressed_during_handoff/);
assert.match(controller, /blocked_agent_actions_during_handoff/);
assert.match(controller, /same_surface_instance_preserved/);
assert.match(controller, /takeover_confirmation_required/);
assert.match(controller, /surfaces_progressed_while_docked/);
assert.match(controller, /pip_agent_progressed_while_active/);
assert.match(pipProvider, /AVPictureInPictureController\.ContentSource/);
assert.match(pipProvider, /sampleBufferDisplayLayer/);
assert.match(pipProvider, /startFromUserAction/);
assert.match(pipProvider, /canStartPictureInPictureAutomaticallyFromInline = false/);
assert.equal((controller.match(/\("task-[1-5]"/g) ?? []).length, 5);
execFileSync(process.execPath, ["--check", "scripts/test-ios-app-surface-control.mjs"]);

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.ios-app-surface-control-static-validation/v1",
  fixed_host_domain_apis: 0,
  fixed_host_sha256: fixedHostDigest,
  surfaces: 5,
  agent_physical_input_injection: false,
  admitted: false,
  released: false,
}));
