import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS app capability qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) {
  throw new Error("set WASMC_IOS_SIMULATOR_UDID to one exact booted simulator UUID");
}
const run = (file, args, options = {}) => execFileSync(file, args, {
  cwd: root, encoding: "utf8", ...options,
});
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
const devices = JSON.parse(simctl(["list", "devices", "available", "--json"]));
const simulator = Object.entries(devices.devices)
  .flatMap(([runtime, rows]) => rows.map((row) => ({ runtime, ...row })))
  .find((row) => row.udid === udid);
assert.ok(simulator, `simulator ${udid} is unavailable`);
assert.equal(simulator.state, "Booted", `simulator ${udid} is not booted`);
assert.match(simulator.runtime, /SimRuntime\.iOS-/);

run("node", ["scripts/validate-ios-app-capability.mjs"]);
const projectDir = "target/ios-app-capability-project";
const derivedDir = "target/ios-app-capability-derived";
fs.mkdirSync(projectDir, { recursive: true });
run("xcodegen", [
  "generate", "--spec", "host/tests/ios-app-capability/project.yml",
  "--project", projectDir, "--project-root", "host/tests/ios-app-capability",
]);
run("xcodebuild", [
  "-quiet", "-project", `${projectDir}/WAsmCIOSAppCapability.xcodeproj`,
  "-scheme", "WAsmCIOSAppCapability", "-sdk", "iphonesimulator",
  "-destination", `id=${udid}`, "-derivedDataPath", derivedDir, "build",
], { stdio: "inherit" });

const app = `${derivedDir}/Build/Products/Debug-iphonesimulator/WAsmCIOSAppCapability.app`;
const bundle = "io.wasmc.app-capability-lab";
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
simctl(["install", udid, app]);
const launch = simctl(["launch", "--terminate-running-process", udid, bundle]).trim();
const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
const reportPath = path.join(container, "Documents", "wasmc-ios-app-capability.json");
for (let attempt = 0; attempt < 40 && !fs.existsSync(reportPath); attempt += 1) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
}
assert.ok(fs.existsSync(reportPath), "embedded app did not publish its capability report");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
assert.equal(report.schema, "wasmc.ios-app-capability-qualification/v1");
assert.equal(report.accepted, true);
assert.equal(report.host_domain_apis, 0);
assert.deepEqual(report.host_negative_controls, {
  duplicate_identity_rejected: true,
  invalid_descriptor_rejected: true,
  output_limit_rejected: true,
});
assert.equal(report.provider_count, 6);
assert.deepEqual(report.target, {
  architecture: "aarch64", embedding: "native", environment: "simulator", os: "ios",
});
const results = Object.fromEntries(report.providers.map((provider) => [provider.identity, provider.result]));
assert.equal(results["wasmc:system-ios-app-storage@0.0.1-dev.1"].sandbox_roundtrip, true);
assert.equal(results["wasmc:system-ios-app-storage@0.0.1-dev.1"].fsync, true);
assert.equal(results["wasmc:system-ios-app-state@0.0.1-dev.1"].secure_random, true);
assert.equal(results["wasmc:system-ios-app-state@0.0.1-dev.1"].user_defaults_persisted, true);
assert.equal(results["wasmc:system-ios-app-state@0.0.1-dev.1"].keychain_roundtrip, true);
assert.equal(results["wasmc:system-ios-app-network@0.0.1-dev.1"].tcp_loopback, true);
assert.equal(results["wasmc:system-ios-app-network@0.0.1-dev.1"].udp_loopback, true);
assert.equal(results["wasmc:system-ios-app-ui@0.0.1-dev.1"].foreground, true);
assert.equal(results["wasmc:system-ios-app-ui@0.0.1-dev.1"].semantic_action_confirmed, true);
assert.equal(results["wasmc:system-ios-app-display@0.0.1-dev.1"].window_capture, true);
assert.ok(results["wasmc:system-ios-app-display@0.0.1-dev.1"].png_bytes > 0);
assert.equal(results["wasmc:system-ios-app-metal@0.0.1-dev.1"].metal_available, true);
assert.equal(results["wasmc:system-ios-app-metal@0.0.1-dev.1"].gpu_copy_roundtrip, true);

const screenshotPath = path.join(root, "target", "ios-app-capability.png");
simctl(["io", udid, "screenshot", screenshotPath]);
const screenshot = fs.readFileSync(screenshotPath);
assert.ok(screenshot.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
console.log(JSON.stringify({
  ...report,
  simulator: { udid, name: simulator.name, runtime: simulator.runtime, state: simulator.state },
  launch,
  screenshot: {
    path: path.relative(root, screenshotPath), bytes: screenshot.length,
    width: screenshot.readUInt32BE(16), height: screenshot.readUInt32BE(20), sha256: sha256(screenshot),
  },
  signing: "xcode-simulator-ad-hoc",
  physical_device: false,
  admitted: false,
  released: false,
}));
