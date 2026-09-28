import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS System Agent Lab qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) {
  throw new Error("set WASMC_IOS_SIMULATOR_UDID to one exact booted simulator UUID");
}
const run = (file, args, options = {}) => execFileSync(file, args, {
  cwd: root, encoding: "utf8", ...options,
});
run("node", ["scripts/validate-system-agent-lab.mjs"]);
const projectDir = "target/system-agent-lab-ios-project";
const derivedDir = "target/system-agent-lab-ios-derived";
const bundle = "io.wasmc.system-agent-lab";
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
run("xcodebuild", ["-quiet", "-project", `${projectDir}/WAsmCSystemAgentLab.xcodeproj`,
  "-scheme", "WAsmCSystemAgentLab", "-sdk", "iphonesimulator", "-destination", `id=${udid}`,
  "-derivedDataPath", derivedDir, "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never",
  "test", "-only-testing:WAsmCSystemAgentLabUITests/SystemAgentLabUITests/testExactLibsComposeWithoutHostGrowth"],
  { stdio: "inherit", timeout: 120_000 });
const container = run("/usr/bin/xcrun", ["simctl", "get_app_container", udid, bundle, "data"]).trim();
const report = JSON.parse(fs.readFileSync(
  path.join(container, "Documents", "wasmc-ios-system-agent-lab.json"), "utf8",
));
assert.equal(report.schema, "wasmc.ios-system-agent-lab-qualification/v1");
assert.equal(report.accepted, true);
assert.equal(report.fixed_host_domain_apis, 0);
assert.equal(report.provider_count, 2);
assert.deepEqual(report.provider_identities, [
  "wasmc:system-ios-app-surface-control@0.0.3-dev.1",
  "wasmc:system-ios-network-path@0.0.1-dev.1",
]);
assert.equal(report.web_generation, 1);
assert.equal(report.web_count, "1");
assert.equal(report.network_status, "satisfied");
assert.ok(report.network_generation >= 1);
assert.equal(report.qualified, true);
assert.equal(report.admitted, false);
assert.equal(report.released, false);
assert.equal(report.discoverable, false);
assert.equal(report.installable, false);
console.log(JSON.stringify({ ...report, simulator_udid: udid }));

