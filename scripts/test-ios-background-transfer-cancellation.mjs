import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS background-transfer qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) throw new Error("set WASMC_IOS_SIMULATOR_UDID");
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, encoding: "utf8", ...options });
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
const server = spawn(process.execPath, ["scripts/fixtures/ios-background-transfer-server.mjs", "18765"], {
  cwd: root, stdio: ["ignore", "inherit", "inherit"],
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 50 && !ready; attempt += 1) {
    ready = spawnSync("curl", ["-fsS", "http://127.0.0.1:18765/ready"], { stdio: "ignore" }).status === 0;
    if (!ready) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  assert.equal(ready, true);
  const projectDir = "target/ios-background-transfer-project";
  const derivedDir = "target/ios-background-transfer-cancellation-derived";
  const bundle = "io.wasmc.background-transfer-lab";
  const exampleRoot = "libsrc/wasmc-system-ios-background-transfer/examples/ios-app";
  fs.mkdirSync(projectDir, { recursive: true });
  run("xcodegen", ["generate", "--spec", `${exampleRoot}/project.yml`, "--project", projectDir,
    "--project-root", exampleRoot], { env: { ...process.env,
      WASMC_IOS_BACKGROUND_TRANSFER_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist") } });
  spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
  spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
  run("xcodebuild", [
    "-quiet", "-project", `${projectDir}/WAsmCIOSBackgroundTransfer.xcodeproj`,
    "-scheme", "WAsmCIOSBackgroundTransfer", "-sdk", "iphonesimulator",
    "-destination", `id=${udid}`, "-derivedDataPath", derivedDir,
    "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
    "-only-testing:WAsmCIOSBackgroundTransferUITests/BackgroundTransferUITests/testCancellationSuppressesResultPublication",
  ], { stdio: "inherit", timeout: 120_000 });
  const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
  const report = JSON.parse(fs.readFileSync(path.join(container, "Documents", "wasmc-ios-background-transfer.json"), "utf8"));
  assert.equal(report.accepted, false);
  assert.equal(report.cancellation_issued, true);
  assert.equal(report.cancellation_terminal_observed, true);
  assert.equal(report.cancellation_qualified, true);
  assert.equal(report.download_completed, false);
  assert.equal(report.durable_result_present, false);
  assert.equal(report.bytes, 0);
  console.log(JSON.stringify({ ...report, simulator_udid: udid }));
} finally {
  server.kill("SIGTERM");
}
