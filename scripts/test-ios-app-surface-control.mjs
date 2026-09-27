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
fs.mkdirSync(projectDir, { recursive: true });
run("xcodegen", [
  "generate", "--spec", "host/tests/ios-app-surface-control/project.yml",
  "--project", projectDir, "--project-root", "host/tests/ios-app-surface-control",
]);
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
run("xcodebuild", [
  "-quiet", "-project", `${projectDir}/WAsmCIOSSurfaceControl.xcodeproj`,
  "-scheme", "WAsmCIOSSurfaceControl", "-sdk", "iphonesimulator",
  "-destination", `id=${udid}`, "-derivedDataPath", derivedDir,
  "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
  "-only-testing:WAsmCIOSSurfaceControlUITests/SurfaceControlUITests/testHumanHandoffWhileOtherSurfacesContinue",
], { stdio: "inherit", timeout: 120_000 });

const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
const reportPath = path.join(container, "Documents", "wasmc-ios-surface-control.json");
assert.ok(fs.existsSync(reportPath), "surface-control App did not retain its report");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
assert.equal(report.schema, "wasmc.ios-app-surface-control-qualification/v1");
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
assert.equal(report.surface_snapshots.length, 5);
assert.equal(report.provider_evidence[0].identity, "wasmc:system-ios-app-surface-control@0.0.1-dev.1");

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
}));
