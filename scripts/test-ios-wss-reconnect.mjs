import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS WSS recovery qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
const exhaustionMode = process.env.WASMC_WSS_RECOVERY_EXHAUSTION === "1";
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) throw new Error("set WASMC_IOS_SIMULATOR_UDID");
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, encoding: "utf8", ...options });
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
run("node", ["scripts/validate-ios-websocket.mjs"]);
const server = spawn(process.execPath,
  ["scripts/fixtures/ios-wss-server.mjs", "18767", "--restart-once",
    ...(exhaustionMode ? ["--never-restart"] : [])],
  { cwd: root, stdio: ["ignore", "pipe", "inherit"] });
try {
  let ready = false;
  server.stdout.on("data", (chunk) => { if (chunk.toString().includes("READY")) ready = true; });
  for (let i = 0; i < 50 && !ready; i += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(ready, true, "WSS recovery fixture did not become ready");
  const projectDir = "target/ios-wss-reconnect-project";
  const derivedDir = "target/ios-wss-reconnect-derived";
  const bundle = "io.wasmc.websocket-lab";
  const exampleRoot = "libsrc/wasmc-system-ios-websocket/examples/ios-app";
  fs.mkdirSync(projectDir, { recursive: true });
  run("xcodegen", ["generate", "--spec", `${exampleRoot}/project.yml`, "--project", projectDir,
    "--project-root", exampleRoot], { env: { ...process.env,
      WASMC_IOS_WEBSOCKET_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist") } });
  spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
  spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
  run("xcodebuild", ["-quiet", "-project", `${projectDir}/WAsmCIOSWebSocket.xcodeproj`,
    "-scheme", "WAsmCIOSWebSocket", "-sdk", "iphonesimulator", "-destination", `id=${udid}`,
    "-derivedDataPath", derivedDir, "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
    `-only-testing:WAsmCIOSWebSocketUITests/WebSocketUITests/${exhaustionMode
      ? "testPinnedWSSReconnectStopsAfterBoundedAttempts"
      : "testPinnedWSSServiceRestartReconnectAndOutboxDelivery"}`],
    { stdio: "inherit", timeout: 120_000 });
  const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
  const report = JSON.parse(fs.readFileSync(path.join(container, "Documents", "wasmc-ios-websocket.json"), "utf8"));
  assert.equal(report.secure_mode, true);
  assert.equal(report.tls_server_trust_challenge, true);
  assert.equal(report.certificate_pin_match, true);
  assert.equal(report.certificate_sha256, "f115cf8cfd0c513ba2301bfe8b45c0de198de875ba24db0a79fc85362e611572");
  assert.equal(report.recovery_prime_receive, true);
  assert.equal(report.service_interruption_observed, true);
  assert.equal(report.outbox_enqueued, true);
  if (exhaustionMode) {
    assert.equal(report.accepted, false);
    assert.equal(report.connection_generation, 1);
    assert.equal(report.reconnect_attempts, 8);
    assert.equal(report.reconnect_exhausted, true);
    assert.equal(report.outbox_delivered, false);
    assert.equal(report.recovery_reply, "");
    assert.equal(report.service_restart_reconnect_qualified, false);
  } else {
    assert.equal(report.accepted, true);
    assert.ok(report.connection_generation >= 2);
    assert.ok(report.reconnect_attempts >= 1);
    assert.equal(report.reconnect_exhausted, false);
    assert.equal(report.outbox_delivered, true);
    assert.equal(report.recovery_reply, "server-after-restart");
    assert.equal(report.service_restart_reconnect_qualified, true);
  }
  assert.equal(report.network_transition_reconnect_qualified, false);
  assert.equal(report.process_relaunch_reconnect_qualified, false);
  assert.equal(report.provider_evidence[0].identity, "wasmc:system-ios-websocket@0.0.1-dev.3");
  console.log(JSON.stringify({ ...report, simulator_udid: udid, exhaustion_mode: exhaustionMode }));
} finally {
  server.kill("SIGTERM");
}
