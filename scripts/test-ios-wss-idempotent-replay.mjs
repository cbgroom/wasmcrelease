import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS idempotent WSS qualification requires macOS");
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
  const projectDir = "target/ios-wss-idempotent-project";
  const derivedDir = "target/ios-wss-idempotent-derived";
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
    "-only-testing:WAsmCIOSWebSocketUITests/WebSocketUITests/testPinnedWSSCrashBeforeAckReplayKeepsEffectOnce"],
    { stdio: "inherit", timeout: 120_000 });
  const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
  const report = JSON.parse(fs.readFileSync(path.join(container, "Documents", "wasmc-ios-websocket.json"), "utf8"));
  const retainedOutbox = JSON.parse(fs.readFileSync(
    path.join(container, "Library", "Application Support", "wasmc-websocket-idempotent-outbox.json"), "utf8"));
  assert.equal(report.accepted, true);
  assert.equal(report.secure_mode, true);
  assert.equal(report.certificate_pin_match, true);
  assert.equal(report.idempotent_loaded_count, 2);
  assert.equal(report.idempotent_crash_receipt_persisted, true);
  assert.deepEqual(report.idempotent_ack_outcomes,
    ["durable-1:duplicate:1", "durable-2:applied:1"]);
  assert.equal(report.idempotent_remaining_count, 0);
  assert.equal(report.idempotent_outbox_drained, true);
  const processIDs = [report.idempotent_seed_process_id,
    report.idempotent_crash_process_id, report.idempotent_drain_process_id];
  assert.equal(new Set(processIDs).size, 3);
  assert.ok(processIDs.every((value) => typeof value === "string" && value.length > 0));
  assert.equal(report.crash_before_ack_replay_qualified, true);
  assert.equal(report.idempotent_effect_once_qualified, true);
  assert.equal(report.process_relaunch_reconnect_qualified, true);
  assert.equal(retainedOutbox.seedProcessID, report.idempotent_seed_process_id);
  assert.equal(retainedOutbox.crashProcessID, report.idempotent_crash_process_id);
  assert.equal(retainedOutbox.crashReceiptObserved, true);
  assert.deepEqual(retainedOutbox.messages, []);
  assert.equal(report.provider_evidence[0].identity, "wasmc:system-ios-websocket@0.0.1-dev.5");
  console.log(JSON.stringify({ ...report, retained_outbox: retainedOutbox, simulator_udid: udid }));
} finally {
  server.kill("SIGTERM");
}
