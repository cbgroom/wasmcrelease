import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS surface-control qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) {
  throw new Error("set WASMC_IOS_SIMULATOR_UDID to one exact booted simulator UUID");
}
const run = (file, args, options = {}) => execFileSync(file, args, {
  cwd: root, encoding: "utf8", ...options,
});
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
run("node", ["scripts/validate-ios-app-surface-control.mjs"]);

const projectDir = "target/ios-app-surface-control-project";
const derivedDir = "target/ios-app-surface-control-derived";
const bundle = "io.wasmc.surface-control-lab";
const exampleRoot = "libsrc/wasmc-system-ios-app-surface-control/examples/ios-app";
fs.mkdirSync(projectDir, { recursive: true });
run("xcodegen", [
  "generate", "--spec", `${exampleRoot}/project.yml`,
  "--project", projectDir, "--project-root", exampleRoot,
], {
  env: {
    ...process.env,
    WASMC_IOS_SURFACE_INFO_PLIST: path.join(
      root, exampleRoot, "App/Info.plist",
    ),
  },
});
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
run("xcodebuild", [
  "-quiet", "-project", `${projectDir}/WAsmCIOSSurfaceControl.xcodeproj`,
  "-scheme", "WAsmCIOSSurfaceControl", "-sdk", "iphonesimulator",
  "-destination", `id=${udid}`, "-derivedDataPath", derivedDir,
  "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
  "-only-testing:WAsmCIOSSurfaceControlUITests/SurfaceControlUITests/testHumanHandoffWhileOtherSurfacesContinue",
], { stdio: "inherit", timeout: 120_000 });

const testResults = fs.readdirSync(path.join(derivedDir, "Logs", "Test"))
  .filter((name) => name.endsWith(".xcresult"))
  .map((name) => path.join(derivedDir, "Logs", "Test", name))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
assert.ok(testResults, "missing retained XCUITest result bundle");
const attachmentDir = path.join(root, "target", "ios-app-surface-control-attachments");
fs.rmSync(attachmentDir, { recursive: true, force: true });
run("/usr/bin/xcrun", [
  "xcresulttool", "export", "attachments", "--path", testResults,
  "--output-path", attachmentDir, "--filter", "*.png",
]);
const attachmentManifest = JSON.parse(fs.readFileSync(path.join(attachmentDir, "manifest.json"), "utf8"));
const attachmentNames = fs.readdirSync(attachmentDir).filter((name) => name.endsWith(".png"));
assert.equal(attachmentNames.length, 1, "expected one retained active PiP screenshot");
const pipScreenshotPath = path.join(attachmentDir, attachmentNames[0]);
const pipScreenshot = fs.readFileSync(pipScreenshotPath);

const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
const reportPath = path.join(container, "Documents", "wasmc-ios-surface-control.json");
assert.ok(fs.existsSync(reportPath), "surface-control App did not retain its report");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
assert.equal(report.schema, "wasmc.ios-app-surface-control-qualification/v3");
assert.equal(report.accepted, true);
assert.equal(report.fixed_host_domain_apis, 0);
assert.equal(report.surface_count, 5);
assert.equal(report.agent_uses_physical_input, false);
assert.equal(report.human_surface, "task-3");
assert.equal(report.human_text, "human-approved");
assert.equal(report.human_surface_agent_mutations_during_handoff, 0);
assert.ok(report.blocked_agent_actions_during_handoff > 0);
assert.equal(report.background_surfaces_progressed_during_handoff, true);
assert.equal(report.agent_resumed_after_handoff, true);
assert.equal(report.same_surface_instance_preserved, true);
assert.equal(report.agent_surfaces_locked_against_direct_user_activation, true);
assert.equal(report.takeover_confirmation_required, true);
assert.equal(report.dock_cycle_completed, true);
assert.equal(report.surfaces_progressed_while_docked, true);
assert.equal(report.pip_supported, true);
assert.equal(report.pip_became_possible, true);
assert.equal(report.pip_user_initiated, true);
assert.equal(report.pip_started, true);
assert.equal(report.pip_stopped, true);
assert.equal(report.pip_agent_progressed_while_active, true);
assert.equal(report.pip_system_window_captured, true);
assert.equal(report.pip_visual_pixels_capture_qualified, false);
assert.ok(report.pip_frames_enqueued > 0);
assert.equal(report.surface_snapshots.length, 5);
assert.ok(report.surface_snapshots.every((surface) => surface.kind === "native"));
assert.equal(report.provider_evidence[0].identity, "wasmc:system-ios-app-surface-control@0.0.2-dev.1");

const screenshotPath = path.join(root, "target", "ios-app-surface-control.png");
simctl(["launch", "--terminate-running-process", udid, bundle]);
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
simctl(["io", udid, "screenshot", screenshotPath]);
const screenshot = fs.readFileSync(screenshotPath);
const sha256 = createHash("sha256").update(screenshot).digest("hex");
console.log(JSON.stringify({
  ...report,
  simulator_udid: udid,
  screenshot: {
    path: path.relative(root, screenshotPath),
    bytes: screenshot.length,
    width: screenshot.readUInt32BE(16),
    height: screenshot.readUInt32BE(20),
    sha256,
  },
  pip_active_screenshot: {
    path: path.relative(root, pipScreenshotPath),
    bytes: pipScreenshot.length,
    width: pipScreenshot.readUInt32BE(16),
    height: pipScreenshot.readUInt32BE(20),
    sha256: createHash("sha256").update(pipScreenshot).digest("hex"),
    manifest_entries: attachmentManifest.length,
  },
}));
