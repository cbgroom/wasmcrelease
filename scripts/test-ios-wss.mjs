import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS WSS qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) throw new Error("set WASMC_IOS_SIMULATOR_UDID");
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, encoding: "utf8", ...options });
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
run("node", ["scripts/validate-ios-websocket.mjs"]);
const server = spawn(process.execPath, ["scripts/fixtures/ios-wss-server.mjs", "18767"], {
  cwd: root, stdio: ["ignore", "pipe", "inherit"]
});
try {
  let ready = false;
  server.stdout.on("data", (chunk) => { if (chunk.toString().includes("READY")) ready = true; });
  for (let i = 0; i < 50 && !ready; i += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(ready, true, "WSS fixture did not become ready");
  const projectDir = "target/ios-wss-project";
  const derivedDir = "target/ios-wss-derived";
  const bundle = "io.wasmc.websocket-lab";
  const exampleRoot = "tests/lib-refresh/native/wasmc-system-ios-websocket/examples/ios-app";
  fs.mkdirSync(projectDir, { recursive: true });
  run("xcodegen", ["generate", "--spec", `${exampleRoot}/project.yml`, "--project", projectDir,
    "--project-root", exampleRoot], { env: { ...process.env,
      WASMC_IOS_WEBSOCKET_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist") } });
  spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
  spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
  run("xcodebuild", ["-quiet", "-project", `${projectDir}/WAsmCIOSWebSocket.xcodeproj`,
    "-scheme", "WAsmCIOSWebSocket", "-sdk", "iphonesimulator", "-destination", `id=${udid}`,
    "-derivedDataPath", derivedDir, "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
    "-only-testing:WAsmCIOSWebSocketUITests/WebSocketUITests/testPinnedWSSForegroundAndFiniteBackgroundDuplex"],
    { stdio: "inherit", timeout: 120_000 });
  const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
  const reportPath = path.join(container, "Documents", "wasmc-ios-websocket.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.accepted, true);
  assert.equal(report.secure_mode, true);
  assert.equal(report.tls_server_trust_challenge, true);
  assert.equal(report.certificate_pin_match, true);
  assert.equal(report.certificate_sha256, "f115cf8cfd0c513ba2301bfe8b45c0de198de875ba24db0a79fc85362e611572");
  assert.equal(report.local_pinned_wss_qualified, true);
  assert.equal(report.public_ca_wss_qualified, false);
  assert.equal(report.foreground_reply, "server-foreground");
  assert.equal(report.background_reply, "server-background");
  assert.equal(report.background_receive_phase, "background");
  assert.equal(report.provider_evidence[0].identity, "wasmc:system-ios-websocket@0.0.1-dev.5");

  spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
  run("xcodebuild", ["-quiet", "-project", `${projectDir}/WAsmCIOSWebSocket.xcodeproj`,
    "-scheme", "WAsmCIOSWebSocket", "-sdk", "iphonesimulator", "-destination", `id=${udid}`,
    "-derivedDataPath", derivedDir, "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
    "-only-testing:WAsmCIOSWebSocketUITests/WebSocketUITests/testPinnedWSSRejectsDifferentExpectedCertificate"],
    { stdio: "inherit", timeout: 120_000 });
  const rejectedContainer = simctl(["get_app_container", udid, bundle, "data"]).trim();
  const rejected = JSON.parse(fs.readFileSync(path.join(rejectedContainer, "Documents", "wasmc-ios-websocket.json"), "utf8"));
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.tls_server_trust_challenge, true);
  assert.equal(rejected.certificate_pin_match, false);
  assert.equal(rejected.error, "certificate-pin-mismatch");
  assert.equal(rejected.connected, false);
  console.log(JSON.stringify({
    ...report,
    simulator_udid: udid,
    negative_pin_control: {
      accepted: rejected.accepted,
      tls_server_trust_challenge: rejected.tls_server_trust_challenge,
      certificate_pin_match: rejected.certificate_pin_match,
      error: rejected.error,
      connected: rejected.connected,
    }
  }));
} finally {
  server.kill("SIGTERM");
}
