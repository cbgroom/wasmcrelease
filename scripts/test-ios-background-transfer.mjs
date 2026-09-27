import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS background-transfer qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) {
  throw new Error("set WASMC_IOS_SIMULATOR_UDID to one exact booted simulator UUID");
}
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, encoding: "utf8", ...options });
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
run("node", ["scripts/validate-ios-background-transfer.mjs"]);

const payload = Buffer.allocUnsafe(8 * 1024 * 1024);
for (let index = 0; index < payload.length; index += 1) payload[index] = index % 251;
const expectedSha256 = createHash("sha256").update(payload).digest("hex");
const server = spawn(process.execPath, ["scripts/fixtures/ios-background-transfer-server.mjs", "18765"], {
  cwd: root, stdio: ["ignore", "inherit", "inherit"],
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 50 && !ready; attempt += 1) {
    const probe = spawnSync("curl", ["-fsS", "http://127.0.0.1:18765/ready"], { stdio: "ignore" });
    ready = probe.status === 0;
    if (!ready) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  assert.equal(ready, true, "background-transfer fixture server did not become ready");

  const projectDir = "target/ios-background-transfer-project";
  const derivedDir = "target/ios-background-transfer-derived";
  const bundle = "io.wasmc.background-transfer-lab";
  const exampleRoot = "libsrc/wasmc-system-ios-background-transfer/examples/ios-app";
  fs.mkdirSync(projectDir, { recursive: true });
  run("xcodegen", [
    "generate", "--spec", `${exampleRoot}/project.yml`,
    "--project", projectDir, "--project-root", exampleRoot,
  ], {
    env: {
      ...process.env,
      WASMC_IOS_BACKGROUND_TRANSFER_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist"),
    },
  });
  spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
  spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
  run("xcodebuild", [
    "-quiet", "-project", `${projectDir}/WAsmCIOSBackgroundTransfer.xcodeproj`,
    "-scheme", "WAsmCIOSBackgroundTransfer", "-sdk", "iphonesimulator",
    "-destination", `id=${udid}`, "-derivedDataPath", derivedDir,
    "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
    "-only-testing:WAsmCIOSBackgroundTransferUITests/BackgroundTransferUITests/testDownloadCompletesWhileAppIsBackgrounded",
  ], { stdio: "inherit", timeout: 150_000 });

  const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
  const reportPath = path.join(container, "Documents", "wasmc-ios-background-transfer.json");
  assert.ok(fs.existsSync(reportPath), "background-transfer App did not retain its report");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.schema, "wasmc.ios-background-transfer-qualification/v1");
  assert.equal(report.accepted, true);
  assert.equal(report.download_completed, true);
  assert.equal(report.completion_phase, "background");
  assert.equal(report.bytes, payload.length);
  assert.equal(report.sha256, expectedSha256);
  assert.equal(report.durable_result_present, true);
  assert.equal(report.durable_result_sha256, expectedSha256);
  assert.equal(report.process_relaunch_delivery_qualified, false);
  assert.equal(report.physical_device, false);
  assert.equal(report.provider_evidence[0].identity, "wasmc:system-ios-background-transfer@0.0.1-dev.1");
  console.log(JSON.stringify({ ...report, simulator_udid: udid }));
} finally {
  server.kill("SIGTERM");
}
