import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS finite-window matrix requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) throw new Error("set WASMC_IOS_SIMULATOR_UDID");
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, encoding: "utf8", ...options });
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
const projectDir = "target/ios-finite-background-window-matrix-project";
const derivedDir = "target/ios-finite-background-window-matrix-derived";
const bundle = "io.wasmc.app-lifecycle-lab";
const exampleRoot = "libsrc/wasmc-system-ios-app-lifecycle/examples/ios-app";
fs.mkdirSync(projectDir, { recursive: true });
run("xcodegen", ["generate", "--spec", `${exampleRoot}/project.yml`, "--project", projectDir,
  "--project-root", exampleRoot], { env: { ...process.env,
    WASMC_IOS_LIFECYCLE_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist") } });
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);

const scenarios = [
  { requested_ms: 15_000, test: "testFifteenSecondFiniteBackgroundWindow" },
  { requested_ms: 30_000, test: "testThirtySecondFiniteBackgroundWindow" },
  { requested_ms: 60_000, test: "testSixtySecondFiniteBackgroundWindow" },
];
const results = [];
for (const scenario of scenarios) {
  run("xcodebuild", ["-quiet", "-project", `${projectDir}/WAsmCIOSAppLifecycle.xcodeproj`,
    "-scheme", "WAsmCIOSAppLifecycle", "-sdk", "iphonesimulator", "-destination", `id=${udid}`,
    "-derivedDataPath", derivedDir, "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
    `-only-testing:WAsmCIOSAppLifecycleUITests/AppLifecycleUITests/${scenario.test}`],
    { stdio: "inherit", timeout: 120_000 });
  const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
  const report = JSON.parse(fs.readFileSync(path.join(container, "Documents", "wasmc-ios-app-lifecycle.json"), "utf8"));
  assert.equal(report.finite_work_requested_ms, scenario.requested_ms);
  results.push({
    requested_ms: scenario.requested_ms,
    elapsed_ms: report.finite_work_elapsed_ms,
    background_ticks: report.finite_work_background_ticks,
    completed_before_foreground: report.finite_work_completed_before_foreground,
    expiration_observed: report.background_task_expiration_qualified,
    remaining_time_available: report.background_time_remaining_available,
  });
  if (report.background_task_expiration_qualified) break;
}

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.ios-finite-background-window-matrix/v1",
  simulator_udid: udid,
  results,
  maximum_duration_qualified: false,
  scope: "exact-simulator-under-xcuitest",
  physical_device: false,
  admitted: false,
  released: false
}));
