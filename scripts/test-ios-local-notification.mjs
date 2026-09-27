import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS local-notification qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) throw new Error("set WASMC_IOS_SIMULATOR_UDID");
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, encoding: "utf8", ...options });
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
run("node", ["scripts/validate-ios-local-notification.mjs"]);
const projectDir = "target/ios-local-notification-project";
const derivedDir = "target/ios-local-notification-derived";
const bundle = "io.wasmc.local-notification-lab";
const exampleRoot = "libsrc/wasmc-system-ios-local-notification/examples/ios-app";
fs.mkdirSync(projectDir, { recursive: true });
run("xcodegen", ["generate", "--spec", `${exampleRoot}/project.yml`, "--project", projectDir,
  "--project-root", exampleRoot], { env: { ...process.env,
    WASMC_IOS_LOCAL_NOTIFICATION_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist") } });
spawnSync("/usr/bin/xcrun", ["simctl", "privacy", udid, "reset", "all", bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
run("xcodebuild", ["-quiet", "-project", `${projectDir}/WAsmCIOSLocalNotification.xcodeproj`,
  "-scheme", "WAsmCIOSLocalNotification", "-sdk", "iphonesimulator", "-destination", `id=${udid}`,
  "-derivedDataPath", derivedDir, "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
  "-only-testing:WAsmCIOSLocalNotificationUITests/LocalNotificationUITests/testSystemDeliversExactPayloadWhileAppIsAwayFromForeground"],
  { stdio: "inherit", timeout: 120_000 });
const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
const report = JSON.parse(fs.readFileSync(path.join(container, "Documents", "wasmc-ios-local-notification.json"), "utf8"));
assert.equal(report.accepted, true);
assert.equal(report.authorization, "authorized");
assert.equal(report.authorization_request_attempts, 1);
assert.equal(report.scheduled, true);
assert.equal(report.delivered, true);
assert.equal(report.exact_identifier, true);
assert.equal(report.exact_title, true);
assert.equal(report.exact_body, true);
assert.equal(report.exact_payload, true);
assert.equal(report.delivery_between_background_boundaries, true);
assert.equal(report.remote_push_qualified, false);
assert.equal(report.silent_push_qualified, false);
assert.equal(report.notification_extension_qualified, false);
assert.equal(report.physical_device, false);
assert.equal(report.provider_evidence[0].identity, "wasmc:system-ios-local-notification@0.0.1-dev.1");
console.log(JSON.stringify({ ...report, simulator_udid: udid }));
