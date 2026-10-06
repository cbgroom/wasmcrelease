import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") throw new Error("iOS background-audio qualification requires macOS");
const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) throw new Error("set WASMC_IOS_SIMULATOR_UDID");
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, encoding: "utf8", ...options });
const simctl = (args, options = {}) => run("/usr/bin/xcrun", ["simctl", ...args], options);
run("node", ["scripts/validate-ios-background-audio.mjs"]);
const projectDir = "target/ios-background-audio-project";
const derivedDir = "target/ios-background-audio-derived";
const bundle = "io.wasmc.background-audio-lab";
const exampleRoot = "tests/lib-refresh/native/wasmc-system-ios-background-audio/examples/ios-app";
fs.mkdirSync(projectDir, { recursive: true });
run("xcodegen", ["generate", "--spec", `${exampleRoot}/project.yml`, "--project", projectDir,
  "--project-root", exampleRoot], { env: { ...process.env,
    WASMC_IOS_BACKGROUND_AUDIO_INFO_PLIST: path.join(root, exampleRoot, "App/Info.plist") } });
spawnSync("/usr/bin/xcrun", ["simctl", "terminate", udid, bundle]);
spawnSync("/usr/bin/xcrun", ["simctl", "uninstall", udid, bundle]);
run("xcodebuild", ["-quiet", "-project", `${projectDir}/WAsmCIOSBackgroundAudio.xcodeproj`,
  "-scheme", "WAsmCIOSBackgroundAudio", "-sdk", "iphonesimulator", "-destination", `id=${udid}`,
  "-derivedDataPath", derivedDir, "-enableCodeCoverage", "NO", "-collect-test-diagnostics", "never", "test",
  "-only-testing:WAsmCIOSBackgroundAudioUITests/BackgroundAudioUITests/testPlaybackClockProgressesWhileAppIsBackgrounded"],
  { stdio: "inherit", timeout: 120_000 });
const container = simctl(["get_app_container", udid, bundle, "data"]).trim();
const report = JSON.parse(fs.readFileSync(path.join(container, "Documents", "wasmc-ios-background-audio.json"), "utf8"));
assert.equal(report.accepted, true);
assert.ok(report.background_samples >= 5);
assert.ok(report.background_position_delta_ms >= 1_500);
assert.equal(report.all_background_samples_playing, true);
assert.equal(report.physical_output_qualified, false);
assert.equal(report.lock_screen_qualified, false);
assert.equal(report.route_change_qualified, false);
assert.equal(report.interruption_qualified, false);
assert.equal(report.provider_evidence[0].identity, "wasmc:system-ios-background-audio@0.0.1-dev.1");
console.log(JSON.stringify({ ...report, simulator_udid: udid }));
