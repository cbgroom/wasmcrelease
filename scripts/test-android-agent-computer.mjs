import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "darwin", "Android emulator qualification currently requires the macOS SDK host");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = os.homedir();
const sdk = process.env.ANDROID_HOME ?? path.join(home, "Library/Android/sdk");
const adb = path.join(sdk, "platform-tools/adb");
const emulator = path.join(sdk, "emulator/emulator");
const ndkRoot = process.env.ANDROID_NDK_HOME ?? path.join(sdk, "ndk/28.2.13676358");
const ndkBin = path.join(ndkRoot, "toolchains/llvm/prebuilt/darwin-x86_64/bin");
const androidClang = path.join(ndkBin, "aarch64-linux-android35-clang");
const target = path.join(root, "target/android-agent-computer-v1");
const cargoTarget = path.join(target, "cargo");
const hostManifest = path.join(root, "host/runtime/lib-boundary/native-android/Cargo.toml");
const hostSource = path.join(root, "host/runtime/lib-boundary/native-android/src/main.rs");
const hostBinary = path.join(cargoTarget, "aarch64-linux-android/release/wasmc-lib-boundary-native-android");
const profilePath = path.join(root, "host/platform/android/agent-computer-profile.json");
const remoteRoot = "/data/local/tmp/wasmc-agent-computer-v1";
const remoteHost = `${remoteRoot}/wasmc-lib-boundary-native-android`;
const avd = process.env.WASMC_ANDROID_AVD ?? "medium_phone";
const rustToolchain = process.env.WASMC_RUST_TOOLCHAIN ?? "+1.96.0";
const rustArgs = (arguments_) => rustToolchain ? [rustToolchain, ...arguments_] : arguments_;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const command = (program, arguments_, options = {}) => execFileSync(program, arguments_, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  ...options,
});
const adbCommand = (arguments_, options = {}) => command(adb, arguments_, options);

const domains = {
  display: {
    identity: "wasmc:system-android-display@0.0.1-dev.1",
    root: path.join(root, "libsrc/wasmc-system-android-display"),
    adapter: "libwasmc_system_android_display.so",
  },
  ui: {
    identity: "wasmc:system-android-ui@0.0.1-dev.1",
    root: path.join(root, "libsrc/wasmc-system-android-ui"),
    adapter: "libwasmc_system_android_ui.so",
  },
  input: {
    identity: "wasmc:system-android-input@0.0.1-dev.1",
    root: path.join(root, "libsrc/wasmc-system-android-input"),
    adapter: "libwasmc_system_android_input.so",
  },
};

function connectedEmulators() {
  return adbCommand(["devices"]).split("\n")
    .filter((line) => /^emulator-\d+\s+device$/.test(line.trim()));
}

async function waitForBoot() {
  adbCommand(["wait-for-device"]);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const booted = adbCommand(["shell", "getprop", "sys.boot_completed"]).trim();
    if (booted === "1") return;
    await wait(1000);
  }
  throw new Error("Android emulator did not finish booting");
}

function descriptorFor(domain, adapterSha256) {
  const template = fs.readFileSync(path.join(domain.root, "native-boundary.template.json"), "utf8");
  return template.replace("BUILD_OUTPUT_SHA256", adapterSha256);
}

function pngDimensions(bytes) {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function boundsFor(xml, predicate) {
  const tags = xml.match(/<node\b[^>]*>/g) ?? [];
  const tag = tags.find(predicate);
  assert.ok(tag, "required semantic UI node is missing");
  const match = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  assert.ok(match, "semantic UI node has no bounds");
  const [, left, top, right, bottom] = match.map(Number);
  return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2), tag };
}

const encodeTap = (x, y) => {
  const bytes = Buffer.alloc(9);
  bytes.writeUInt8(1, 0);
  bytes.writeUInt32LE(x, 1);
  bytes.writeUInt32LE(y, 5);
  return bytes;
};
const encodeText = (value) => {
  const text = Buffer.from(value);
  const bytes = Buffer.alloc(3 + text.length);
  bytes.writeUInt8(2, 0);
  bytes.writeUInt16LE(text.length, 1);
  text.copy(bytes, 3);
  return bytes;
};
const encodeKey = (code) => {
  const bytes = Buffer.alloc(5);
  bytes.writeUInt8(3, 0);
  bytes.writeUInt32LE(code, 1);
  return bytes;
};

let launched = false;
let emulatorProcess;
let callIndex = 0;
const hostIdentities = new Set();

try {
  assert.ok(fs.existsSync(adb), `missing adb: ${adb}`);
  assert.ok(fs.existsSync(emulator), `missing emulator: ${emulator}`);
  assert.ok(fs.existsSync(androidClang), `missing Android clang: ${androidClang}`);
  assert.ok(adbCommand(["devices"]).includes("List of devices attached"));
  const existing = connectedEmulators();
  assert.ok(existing.length <= 1, "qualification requires at most one connected emulator");
  if (existing.length === 0) {
    const avds = command(emulator, ["-list-avds"]).split("\n").map((value) => value.trim());
    assert.ok(avds.includes(avd), `missing AVD ${avd}`);
    emulatorProcess = spawn(emulator, [
      "-avd", avd,
      "-no-window",
      "-no-audio",
      "-no-snapshot-save",
      "-gpu", "swiftshader_indirect",
    ], { cwd: root, stdio: "ignore" });
    emulatorProcess.unref();
    launched = true;
  }
  await waitForBoot();

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  command("cargo", rustArgs(["fmt", "--check", "--manifest-path", hostManifest]));
  command("cargo", rustArgs([
    "clippy", "--locked", "--manifest-path", hostManifest,
    "--target", "aarch64-linux-android", "--all-targets", "--", "-D", "warnings",
  ]), {
    env: {
      ...process.env,
      CARGO_TARGET_DIR: cargoTarget,
      CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER: androidClang,
      CC_aarch64_linux_android: androidClang,
      AR_aarch64_linux_android: path.join(ndkBin, "llvm-ar"),
    },
  });
  command("cargo", rustArgs([
    "build", "--release", "--locked", "--manifest-path", hostManifest,
    "--target", "aarch64-linux-android",
  ]), {
    env: {
      ...process.env,
      CARGO_TARGET_DIR: cargoTarget,
      CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER: androidClang,
      CC_aarch64_linux_android: androidClang,
      AR_aarch64_linux_android: path.join(ndkBin, "llvm-ar"),
    },
  });

  const executorSha256 = hash(fs.readFileSync(hostBinary));
  const adapterSha256 = {};
  for (const [name, domain] of Object.entries(domains)) {
    command("wasm-tools", ["component", "wit", path.join(domain.root, "lib.wit")]);
    const adapterPath = path.join(target, domain.adapter);
    command(androidClang, [
      "-shared", "-fPIC", "-O2", "-Wall", "-Wextra", "-Werror",
      path.join(domain.root, "native-adapter.c"), "-o", adapterPath,
    ]);
    adapterSha256[name] = hash(fs.readFileSync(adapterPath));
    fs.writeFileSync(path.join(target, `${name}-descriptor.json`), descriptorFor(domain, adapterSha256[name]));
  }

  const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  assert.equal(profile.schema, "wasmc.library-os-profile/v1");
  assert.equal(profile.host.contract, "wasmc.lib-defined-host-boundary/v1");
  assert.equal(profile.host.required_domain_apis, 0);
  assert.deepEqual(profile.standard_apis, [
    "wasmc:system-display@0.0.1",
    "wasmc:system-ui@0.0.1",
    "wasmc:system-input@0.0.1",
  ]);

  const hostText = fs.readFileSync(hostSource, "utf8");
  for (const forbidden of ["/system/bin/screencap", "/system/bin/uiautomator", "/system/bin/input", "SurfaceFlinger", "tap", "keyevent"]) {
    assert.equal(hostText.includes(forbidden), false, `Android domain semantics leaked into fixed Host: ${forbidden}`);
  }

  adbCommand(["shell", "rm", "-rf", remoteRoot]);
  adbCommand(["shell", "mkdir", "-p", remoteRoot]);
  adbCommand(["push", hostBinary, remoteHost]);
  adbCommand(["shell", "chmod", "700", remoteHost]);
  for (const [name, domain] of Object.entries(domains)) {
    adbCommand(["push", path.join(target, domain.adapter), `${remoteRoot}/${domain.adapter}`]);
    adbCommand(["push", path.join(target, `${name}-descriptor.json`), `${remoteRoot}/${name}-descriptor.json`]);
  }

  const invoke = (name, payload, outputName) => {
    callIndex += 1;
    outputName ??= `${name}-${callIndex}.bin`;
    const localInput = path.join(target, `input-${callIndex}.bin`);
    const localOutput = path.join(target, outputName);
    const remoteInput = `${remoteRoot}/input.bin`;
    const remoteOutput = `${remoteRoot}/output.bin`;
    fs.writeFileSync(localInput, payload);
    adbCommand(["push", localInput, remoteInput]);
    const raw = adbCommand([
      "shell", remoteHost, `${remoteRoot}/${name}-descriptor.json`, remoteInput, remoteOutput,
    ]).trim();
    const report = JSON.parse(raw);
    assert.equal(report.schema, "wasmc.lib-defined-native-android/v1");
    assert.equal(report.identity, domains[name].identity);
    assert.equal(report.adapter_sha256, adapterSha256[name]);
    hostIdentities.add(executorSha256);
    adbCommand(["pull", remoteOutput, localOutput]);
    return fs.readFileSync(localOutput);
  };

  adbCommand(["shell", "wm", "dismiss-keyguard"]);
  adbCommand(["shell", "input", "keyevent", "KEYCODE_WAKEUP"]);
  adbCommand(["shell", "am", "start", "-W", "-a", "android.settings.SETTINGS"]);
  await wait(1500);

  const beforeFrame = invoke("display", Buffer.from([1]), "before.png");
  const dimensions = pngDimensions(beforeFrame);
  assert.deepEqual(dimensions, { width: 1080, height: 2400 });
  const beforeFrameSha256 = hash(beforeFrame);

  let xml = invoke("ui", Buffer.from([1]), "before.xml").toString("utf8");
  const search = boundsFor(xml, (tag) => tag.includes('resource-id="com.android.settings:id/search_bar_title"'));
  invoke("input", encodeTap(search.x, search.y));

  let focused = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await wait(250);
    xml = invoke("ui", Buffer.from([1]), `focused-${attempt}.xml`).toString("utf8");
    focused = /resource-id="com\.google\.android\.settings\.intelligence:id\/open_search_view_edit_text"[^>]*focused="true"/.test(xml);
    if (focused) break;
  }
  assert.equal(focused, true, "search input never became the authoritative focused target");

  invoke("input", encodeText("display"));
  let exactText = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await wait(250);
    xml = invoke("ui", Buffer.from([1]), `typed-${attempt}.xml`).toString("utf8");
    exactText = /text="display"[^>]*open_search_view_edit_text/.test(xml);
    if (exactText && xml.includes('text="Display size"')) break;
  }
  assert.equal(exactText, true, "input command completed without the exact UI postcondition");
  const typedFrame = invoke("display", Buffer.from([1]), "typed.png");
  const typedFrameSha256 = hash(typedFrame);
  assert.notEqual(typedFrameSha256, beforeFrameSha256);

  const displaySize = boundsFor(xml, (tag) => tag.includes('text="Display size"') && tag.includes('resource-id="android:id/title"'));
  invoke("input", encodeTap(displaySize.x, displaySize.y));

  let foreground = "";
  let resultXml = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await wait(250);
    foreground = invoke("ui", Buffer.from([2]), `foreground-${attempt}.txt`).toString("utf8");
    resultXml = invoke("ui", Buffer.from([1]), `result-${attempt}.xml`).toString("utf8");
    if (/com\.android\.settings\/(?:com\.android\.settings)?\.SubSettings/.test(foreground) &&
        resultXml.includes('text="Font size"') && resultXml.includes('text="Display size"')) break;
  }
  assert.match(foreground, /com\.android\.settings\/(?:com\.android\.settings)?\.SubSettings/);
  assert.match(resultXml, /text="Font size"/);
  assert.match(resultXml, /text="Display size"/);
  const resultFrame = invoke("display", Buffer.from([1]), "result.png");
  const resultFrameSha256 = hash(resultFrame);
  assert.notEqual(resultFrameSha256, typedFrameSha256);

  assert.equal(hostIdentities.size, 1, "all domains must execute through one fixed Android Host binary");
  const malformedInput = path.join(target, "malformed.bin");
  fs.writeFileSync(malformedInput, Buffer.from([255]));
  adbCommand(["push", malformedInput, `${remoteRoot}/malformed.bin`]);
  const malformed = spawnSync(adb, [
    "shell", remoteHost, `${remoteRoot}/input-descriptor.json`,
    `${remoteRoot}/malformed.bin`, `${remoteRoot}/malformed-output.bin`,
  ], { cwd: root, encoding: "utf8" });
  assert.notEqual(malformed.status, 0);
  assert.match(`${malformed.stdout}\n${malformed.stderr}`, /adapter failed with status -22/);

  const invalidDescriptor = JSON.parse(fs.readFileSync(path.join(target, "display-descriptor.json"), "utf8"));
  invalidDescriptor.adapter.sha256 = "0".repeat(64);
  const invalidDescriptorPath = path.join(target, "invalid-descriptor.json");
  fs.writeFileSync(invalidDescriptorPath, JSON.stringify(invalidDescriptor));
  adbCommand(["push", invalidDescriptorPath, `${remoteRoot}/invalid-descriptor.json`]);
  const invalid = spawnSync(adb, [
    "shell", remoteHost, `${remoteRoot}/invalid-descriptor.json`,
    `${remoteRoot}/malformed.bin`, `${remoteRoot}/invalid-output.bin`,
  ], { cwd: root, encoding: "utf8" });
  assert.notEqual(invalid.status, 0);
  assert.match(`${invalid.stdout}\n${invalid.stderr}`, /adapter identity mismatch/);

  const report = {
    accepted: true,
    schema: "wasmc.android-agent-computer-qualification/v1",
    avd,
    android_release: adbCommand(["shell", "getprop", "ro.build.version.release"]).trim(),
    android_api: Number(adbCommand(["shell", "getprop", "ro.build.version.sdk"]).trim()),
    architecture: adbCommand(["shell", "getprop", "ro.product.cpu.abi"]).trim(),
    kernel: adbCommand(["shell", "uname", "-r"]).trim(),
    fixed_android_host_sha256: executorSha256,
    host_source_changes_after_baseline_required: 0,
    host_domain_apis: 0,
    standard_apis: profile.standard_apis,
    binding_identities: profile.bindings,
    adapter_sha256: adapterSha256,
    real_frame: { ...dimensions, before_sha256: beforeFrameSha256, typed_sha256: typedFrameSha256, result_sha256: resultFrameSha256 },
    semantic_ui_query: true,
    focus_precondition_observed: true,
    exact_text_postcondition: "display",
    foreground_postcondition: "com.android.settings/.SubSettings",
    result_semantics: ["Font size", "Display size"],
    malformed_operation_rejection: true,
    adapter_identity_rejection: true,
    execution: "fixed-android-host-plus-exact-lib-adapters",
    wasm_lowering: false,
    admitted: false,
    released: false,
  };
  fs.writeFileSync(path.join(target, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  try {
    if (connectedEmulators().length) adbCommand(["shell", "rm", "-rf", remoteRoot]);
  } catch {}
  if (launched) {
    try { adbCommand(["emu", "kill"]); } catch {}
  }
}
