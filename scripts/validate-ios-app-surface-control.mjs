import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const fixedHost = "host/tests/ios-app-capability/Host/FixedHost.swift";
const fixedHostDigest = createHash("sha256").update(fs.readFileSync(fixedHost)).digest("hex");
assert.equal(fixedHostDigest, "f0d465ba7f23698d6365453b02fad2f4a0803171f970631751fc90a00a86d96f");

const root = "host/tests/ios-app-surface-control";
const required = [
  "project.yml",
  "App/Info.plist",
  "WIT/app-surface-control.wit",
  "Lib/SurfaceControlProvider.swift",
  "Lib/PiPSurfaceProvider.swift",
  "App/TaskSurfaceCard.swift",
  "App/SurfaceDemoViewController.swift",
  "App/AppDelegate.swift",
  "UITests/SurfaceControlUITests.swift",
];
for (const relative of required) assert.ok(fs.statSync(`${root}/${relative}`).size > 0, relative);

execFileSync("wasm-tools", ["component", "wit", `${root}/WIT/app-surface-control.wit`], {
  stdio: "ignore",
});
const provider = fs.readFileSync(`${root}/Lib/SurfaceControlProvider.swift`, "utf8");
const controller = fs.readFileSync(`${root}/App/SurfaceDemoViewController.swift`, "utf8");
const pipProvider = fs.readFileSync(`${root}/Lib/PiPSurfaceProvider.swift`, "utf8");
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
