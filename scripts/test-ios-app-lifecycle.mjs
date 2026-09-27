import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS lifecycle qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) {
  throw new Error("set WASMC_IOS_SIMULATOR_UDID to one exact booted simulator UUID");
}
const run = (file, args, options = {}) => execFileSync(file, args, {
  cwd: root, encoding: "utf8", ...options,
});
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
run("node", ["scripts/validate-ios-app-lifecycle.mjs"]);

const projectDir = "target/ios-app-lifecycle-project";
const derivedDir = "target/ios-app-lifecycle-derived";
const bundle = "io.wasmc.app-lifecycle-lab";
const exampleRoot = "libsrc/wasmc-system-ios-app-lifecycle/examples/ios-app";
fs.mkdirSync(projectDir, { recursive: true });
run("xcodegen", [
  "generate", "--spec", `${exampleRoot}/project.yml`,
  "--project", projectDir, "--project-root", exampleRoot,
], {
  env: {
    ...process.env,
    WASMC_IOS_LIFECYCLE_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist"),
  },
});
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
run("xcodebuild", [
  "-quiet", "-project", `${projectDir}/WAsmCIOSAppLifecycle.xcodeproj`,
  "-scheme", "WAsmCIOSAppLifecycle", "-sdk", "iphonesimulator",
  "-destination", `id=${udid}`, "-derivedDataPath", derivedDir,
  "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
  "-only-testing:WAsmCIOSAppLifecycleUITests/AppLifecycleUITests/testBackgroundCycleAndColdRelaunchJournal",
], { stdio: "inherit", timeout: 120_000 });

const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
const reportPath = path.join(container, "Documents", "wasmc-ios-app-lifecycle.json");
assert.ok(fs.existsSync(reportPath), "lifecycle App did not retain its report");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
assert.equal(report.schema, "wasmc.ios-app-lifecycle-qualification/v1");
assert.equal(report.accepted, true);
assert.equal(report.background_cycle_observed, true);
assert.equal(report.finite_work_began, true);
assert.equal(report.finite_work_completed, true);
assert.equal(report.finite_work_completed_before_foreground, true);
assert.ok(report.finite_work_background_ticks > 0);
assert.equal(report.cold_relaunch_journal_recovered, true);
assert.ok(report.launch_count >= 2);
assert.equal(report.simulator_suspension_qualified, false);
assert.equal(report.background_task_expiration_qualified, false);
assert.equal(report.bgtaskscheduler_delivery_qualified, false);
assert.equal(report.background_urlsession_delivery_qualified, false);
assert.equal(report.physical_device, false);
assert.equal(report.provider_evidence[0].identity, "wasmc:system-ios-app-lifecycle@0.0.1-dev.1");

const screenshotPath = path.join(root, "target", "ios-app-lifecycle.png");
simctl(["io", udid, "screenshot", screenshotPath]);
const screenshot = fs.readFileSync(screenshotPath);
console.log(JSON.stringify({
  ...report,
  simulator_udid: udid,
  screenshot: {
    path: path.relative(root, screenshotPath),
    bytes: screenshot.length,
    width: screenshot.readUInt32BE(16),
    height: screenshot.readUInt32BE(20),
    sha256: createHash("sha256").update(screenshot).digest("hex"),
  },
}));
