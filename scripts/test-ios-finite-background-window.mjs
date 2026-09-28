import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS finite-background-window probe requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) throw new Error("set WASMC_IOS_SIMULATOR_UDID");
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, encoding: "utf8", ...options });
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
run("node", ["scripts/validate-ios-app-lifecycle.mjs"]);

const projectDir = "target/ios-finite-background-window-project";
const derivedDir = "target/ios-finite-background-window-derived";
const bundle = "io.wasmc.app-lifecycle-lab";
const exampleRoot = "libsrc/wasmc-system-ios-app-lifecycle/examples/ios-app";
fs.mkdirSync(projectDir, { recursive: true });
run("xcodegen", ["generate", "--spec", `${exampleRoot}/project.yml`, "--project", projectDir,
  "--project-root", exampleRoot], { env: { ...process.env,
    WASMC_IOS_LIFECYCLE_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist") } });
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
run("xcodebuild", ["-quiet", "-project", `${projectDir}/WAsmCIOSAppLifecycle.xcodeproj`,
  "-scheme", "WAsmCIOSAppLifecycle", "-sdk", "iphonesimulator", "-destination", `id=${udid}`,
  "-derivedDataPath", derivedDir, "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
  "-only-testing:WAsmCIOSAppLifecycleUITests/AppLifecycleUITests/testEightSecondFiniteBackgroundWindow"],
  { stdio: "inherit", timeout: 120_000 });
const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
const report = JSON.parse(fs.readFileSync(path.join(container, "Documents", "wasmc-ios-app-lifecycle.json"), "utf8"));
assert.equal(report.accepted, true);
assert.equal(report.finite_work_requested_ms, 8_000);
assert.ok(report.finite_work_elapsed_ms >= 7_500);
assert.ok(report.finite_work_elapsed_ms < 15_000);
assert.equal(report.finite_work_background_ticks, 8);
assert.equal(report.finite_work_completed_before_foreground, true);
assert.equal(report.background_task_expiration_qualified, false);
assert.equal(report.physical_device, false);
console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.ios-finite-background-window-probe/v1",
  simulator_udid: udid,
  requested_ms: report.finite_work_requested_ms,
  elapsed_ms: report.finite_work_elapsed_ms,
  background_ticks: report.finite_work_background_ticks,
  background_time_remaining_sample_count: report.background_time_remaining_sample_count,
  background_time_remaining_available: report.background_time_remaining_available,
  background_time_remaining_first_ms: report.background_time_remaining_first_ms,
  background_time_remaining_last_ms: report.background_time_remaining_last_ms,
  completed_before_foreground: report.finite_work_completed_before_foreground,
  expiration_observed: report.background_task_expiration_qualified,
  maximum_duration_qualified: false,
  physical_device: false,
  admitted: false,
  released: false
}));
