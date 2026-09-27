import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS deferred-work qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) throw new Error("set WASMC_IOS_SIMULATOR_UDID");
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, encoding: "utf8", ...options });
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
run("node", ["scripts/validate-ios-deferred-work.mjs"]);
const projectDir = "target/ios-deferred-work-project";
const derivedDir = "target/ios-deferred-work-derived";
const bundle = "io.wasmc.deferred-work-lab";
const exampleRoot = "libsrc/wasmc-system-ios-deferred-work/examples/ios-app";
fs.mkdirSync(projectDir, { recursive: true });
run("xcodegen", [
  "generate", "--spec", `${exampleRoot}/project.yml`, "--project", projectDir, "--project-root", exampleRoot,
], { env: { ...process.env, WASMC_IOS_DEFERRED_WORK_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist") } });
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
run("xcodebuild", [
  "-quiet", "-project", `${projectDir}/WAsmCIOSDeferredWork.xcodeproj`,
  "-scheme", "WAsmCIOSDeferredWork", "-sdk", "iphonesimulator",
  "-destination", `id=${udid}`, "-derivedDataPath", derivedDir,
  "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
  "-only-testing:WAsmCIOSDeferredWorkUITests/DeferredWorkUITests/testSimulatorReportsSubmissionUnavailable",
], { stdio: "inherit", timeout: 120_000 });
const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
const reportPath = path.join(container, "Documents", "wasmc-ios-deferred-work.json");
assert.ok(fs.existsSync(reportPath));
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
assert.equal(report.schema, "wasmc.ios-deferred-work-qualification/v1");
assert.equal(report.accepted, false);
assert.equal(report.diagnostic_complete, true);
assert.equal(report.registered, true);
assert.equal(report.submitted, false);
assert.equal(report.request_survived_background_cycle, false);
assert.equal(report.cancelled, true);
assert.equal(report.pending_count, 0);
assert.equal(report.last_error_domain, "BGTaskSchedulerErrorDomain");
assert.equal(report.last_error_code, 1);
assert.equal(report.system_delivery_qualified, false);
assert.equal(report.expiration_qualified, false);
assert.equal(report.terminated_app_relaunch_qualified, false);
assert.equal(report.physical_device, false);
assert.equal(report.provider_evidence[0].identity, "wasmc:system-ios-deferred-work@0.0.1-dev.1");
console.log(JSON.stringify({ ...report, simulator_udid: udid }));
