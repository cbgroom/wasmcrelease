import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ProfileResolutionError,
  loadSystemLibCandidate,
  resolveSystemProfile,
  resolveSystemProfileRequest,
} from "../host/platform/profile-resolver.mjs";

if (process.platform !== "darwin") throw new Error("iOS Simulator qualification requires macOS");

const root = process.cwd();
const udid = process.env.WASMC_IOS_SIMULATOR_UDID;
if (!/^[0-9A-Fa-f-]{36}$/.test(udid ?? "")) {
  throw new Error("set WASMC_IOS_SIMULATOR_UDID to one exact booted simulator UUID");
}
const requestPath = "host/platform/ios/simulator-observation-request.json";
const profilePath = "host/platform/ios/simulator-observation-profile.json";
const candidatePath = "libsrc/wasmc-system-ios-simulator-display/candidate.json";
const packageRoot = path.join(root, path.dirname(candidatePath));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const runSimctl = (commandArguments, options = {}) => execFileSync("/usr/bin/xcrun", ["simctl", ...commandArguments], {
  cwd: root,
  encoding: "utf8",
  ...options,
});

const devices = JSON.parse(runSimctl(["list", "devices", "available", "--json"]));
const located = Object.entries(devices.devices)
  .flatMap(([runtime, rows]) => rows.map((row) => ({ runtime, ...row })))
  .find((row) => row.udid === udid);
assert.ok(located, `simulator ${udid} is not available`);
assert.equal(located.state, "Booted", `simulator ${udid} is not booted`);
assert.match(located.runtime, /SimRuntime\.iOS-/);

const request = readJson(requestPath);
const expectedProfile = readJson(profilePath);
assert.deepEqual(resolveSystemProfileRequest(root, request), expectedProfile);
assert.equal(expectedProfile.host.required_domain_apis, 0);
assert.equal(expectedProfile.target.embedding, "supervisor");
assert.equal(expectedProfile.bindings.length, 1);
assert.equal(expectedProfile.bindings[0].api, "wasmc:system-display@0.0.1");

const candidate = loadSystemLibCandidate(root, candidatePath);
const fullAgentRequest = {
  ...request,
  requirements: [
    "wasmc:system-display@0.0.1",
    "wasmc:system-ui@0.0.1",
    "wasmc:system-input@0.0.1",
    "wasmc:system-virtual-input@0.0.1",
  ],
};
assert.throws(
  () => resolveSystemProfile(fullAgentRequest, [candidate]),
  (error) => error instanceof ProfileResolutionError && error.code === "provider.none",
);
assert.throws(
  () => resolveSystemProfile({
    ...request,
    target: { ...request.target, environment: "device", embedding: "native" },
  }, [candidate]),
  (error) => error instanceof ProfileResolutionError && error.code === "provider.none",
);

execFileSync("wasm-tools", ["component", "wit", path.join(packageRoot, "lib.wit")], { stdio: "ignore" });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "wasmc-ios-simulator-"));
const adapterPath = path.join(temporary, "libwasmc_system_ios_simulator_display.dylib");
const descriptorPath = path.join(temporary, "native-boundary.json");
const inputPath = path.join(temporary, "input.bin");
const firstFramePath = path.join(temporary, "first.png");
const secondFramePath = path.join(temporary, "second.png");
const targetDir = path.join(root, "target", "ios-simulator-supervisor");
const hostPath = path.join(targetDir, "release", "wasmc-lib-boundary-native-apple-simulator");
let originalAppearance;

try {
  execFileSync("/usr/bin/xcrun", [
    "clang", "-dynamiclib", "-O2", "-Wall", "-Wextra", "-Werror",
    path.join(packageRoot, "native-adapter.c"), "-o", adapterPath,
  ], { cwd: root, stdio: "inherit" });
  execFileSync("cargo", [
    "+1.96.0", "build", "--release", "--locked",
    "--manifest-path", "host/runtime/lib-boundary/native-apple-simulator/Cargo.toml",
    "--target-dir", targetDir,
  ], { cwd: root, stdio: "inherit" });

  const descriptor = readJson("libsrc/wasmc-system-ios-simulator-display/native-boundary.template.json");
  descriptor.adapter.sha256 = sha256(fs.readFileSync(adapterPath));
  fs.writeFileSync(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`);
  fs.writeFileSync(inputPath, Buffer.alloc(0));

  runSimctl(["launch", "--terminate-running-process", udid, "com.apple.Preferences"]);
  execFileSync("/bin/sleep", ["1"]);
  originalAppearance = runSimctl(["ui", udid, "appearance"]).trim();
  assert.ok(["light", "dark"].includes(originalAppearance));

  const invoke = (outputPath) => {
    const result = spawnSync(hostPath, [descriptorPath, inputPath, outputPath], {
      cwd: root,
      env: { ...process.env, WASMC_IOS_SIMULATOR_UDID: udid },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const firstReceipt = invoke(firstFramePath);
  const nextAppearance = originalAppearance === "light" ? "dark" : "light";
  runSimctl(["ui", udid, "appearance", nextAppearance]);
  execFileSync("/bin/sleep", ["1"]);
  const secondReceipt = invoke(secondFramePath);

  const first = fs.readFileSync(firstFramePath);
  const second = fs.readFileSync(secondFramePath);
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(first.subarray(0, 8).equals(pngSignature));
  assert.ok(second.subarray(0, 8).equals(pngSignature));
  const width = first.readUInt32BE(16);
  const height = first.readUInt32BE(20);
  assert.ok(width > 0 && height > 0);
  assert.notEqual(sha256(first), sha256(second), "appearance change must alter the captured frame");
  assert.equal(firstReceipt.identity, "wasmc:system-ios-simulator-display@0.0.1-dev.1");
  assert.equal(secondReceipt.adapter_sha256, descriptor.adapter.sha256);

  fs.writeFileSync(inputPath, Buffer.from([1]));
  const oversized = spawnSync(hostPath, [descriptorPath, inputPath, path.join(temporary, "invalid.png")], {
    env: { ...process.env, WASMC_IOS_SIMULATOR_UDID: udid }, encoding: "utf8",
  });
  assert.notEqual(oversized.status, 0);
  assert.match(oversized.stderr, /input limit/);

  fs.writeFileSync(inputPath, Buffer.alloc(0));
  const wrongDigest = { ...descriptor, adapter: { ...descriptor.adapter, sha256: "0".repeat(64) } };
  fs.writeFileSync(descriptorPath, `${JSON.stringify(wrongDigest, null, 2)}\n`);
  const tampered = spawnSync(hostPath, [descriptorPath, inputPath, path.join(temporary, "tampered.png")], {
    env: { ...process.env, WASMC_IOS_SIMULATOR_UDID: udid }, encoding: "utf8",
  });
  assert.notEqual(tampered.status, 0);
  assert.match(tampered.stderr, /adapter identity mismatch/);

  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.ios-simulator-observation-qualification/v1",
    simulator: { udid, name: located.name, runtime: located.runtime, state: located.state },
    target: request.target,
    fixed_host_domain_apis: 0,
    resolved_bindings: expectedProfile.bindings.length,
    frame: { width, height, first_bytes: first.length, second_bytes: second.length },
    semantic_frame_postcondition: true,
    full_agent_profile: "provider.none",
    physical_device: false,
    ios_embedded_host: false,
    admitted: false,
    released: false,
  }));
} finally {
  if (originalAppearance) {
    try { runSimctl(["ui", udid, "appearance", originalAppearance]); } catch {}
  }
  fs.rmSync(temporary, { recursive: true, force: true });
}
