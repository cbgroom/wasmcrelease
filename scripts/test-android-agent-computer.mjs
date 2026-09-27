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
  uinput: {
    identity: "wasmc:system-android-uinput@0.0.1-dev.1",
    root: path.join(root, "libsrc/wasmc-system-android-uinput"),
    adapter: "libwasmc_system_android_uinput.so",
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
const encodeKeyboardCreate = (name, keys) => {
  const nameBytes = Buffer.from(name);
  const bytes = Buffer.alloc(5 + nameBytes.length + keys.length * 2);
  bytes.writeUInt8(1, 0);
  bytes.writeUInt16LE(nameBytes.length, 1);
  bytes.writeUInt16LE(keys.length, 3);
  nameBytes.copy(bytes, 5);
  keys.forEach((key, index) => bytes.writeUInt16LE(key, 5 + nameBytes.length + index * 2));
  return bytes;
};
const encodeKeyboardBatch = (token, events) => {
  const bytes = Buffer.alloc(11 + events.length * 6);
  bytes.writeUInt8(4, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt16LE(events.length, 9);
  events.forEach(([code, value], index) => {
    bytes.writeUInt16LE(code, 11 + index * 6);
    bytes.writeInt32LE(value, 13 + index * 6);
  });
  return bytes;
};
const encodeKeyboardDestroy = (token) => {
  const bytes = Buffer.alloc(9);
  bytes.writeUInt8(3, 0);
  bytes.writeBigUInt64LE(token, 1);
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
    "wasmc:system-virtual-input@0.0.1",
  ]);

  const hostText = fs.readFileSync(hostSource, "utf8");
  for (const forbidden of ["/system/bin/screencap", "/system/bin/uiautomator", "/system/bin/input", "/dev/uinput", "UI_DEV_CREATE", "SurfaceFlinger", "tap", "keyevent"]) {
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

  const openSession = (name) => {
    const child = spawn(adb, [
      "shell", remoteHost, "--session", `${remoteRoot}/${name}-descriptor.json`,
    ], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    let buffered = Buffer.alloc(0);
    let stderr = "";
    const pending = [];
    let closed = false;
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.stdout.on("data", (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length >= 8) {
        const outputLength = buffered.readUInt32LE(4);
        if (buffered.length < 8 + outputLength) break;
        const response = {
          status: buffered.readInt32LE(0),
          output: Buffer.from(buffered.subarray(8, 8 + outputLength)),
        };
        buffered = buffered.subarray(8 + outputLength);
        const next = pending.shift();
        assert.ok(next, "Android Host session returned an unsolicited response");
        next.resolve(response);
      }
    });
    child.on("close", (code) => {
      closed = true;
      for (const request of pending.splice(0)) {
        request.reject(new Error(`Android Host session closed ${code}: ${stderr}`));
      }
    });
    const call = (input) => new Promise((resolve, reject) => {
      assert.equal(closed, false, "Android Host session is already closed");
      const request = { resolve, reject };
      pending.push(request);
      const timer = setTimeout(() => {
        const index = pending.indexOf(request);
        if (index >= 0) pending.splice(index, 1);
        reject(new Error(`Android Host session response timeout: ${stderr}`));
      }, 10_000);
      request.resolve = (value) => { clearTimeout(timer); resolve(value); };
      request.reject = (error) => { clearTimeout(timer); reject(error); };
      const frame = Buffer.alloc(4 + input.length);
      frame.writeUInt32LE(input.length, 0);
      input.copy(frame, 4);
      child.stdin.write(frame);
    });
    const close = () => new Promise((resolve, reject) => {
      if (closed) return resolve();
      child.once("close", (code) => code === 0
        ? resolve()
        : reject(new Error(`Android Host session closed ${code}: ${stderr}`)));
      child.stdin.end();
    });
    return { call, close };
  };

  adbCommand(["shell", "wm", "dismiss-keyguard"]);
  adbCommand(["shell", "input", "keyevent", "KEYCODE_WAKEUP"]);
  adbCommand(["shell", "am", "force-stop", "com.google.android.settings.intelligence"]);
  adbCommand(["shell", "am", "force-stop", "com.android.settings"]);
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

  adbCommand(["shell", "am", "force-stop", "com.google.android.settings.intelligence"]);
  adbCommand(["shell", "am", "force-stop", "com.android.settings"]);
  adbCommand(["shell", "am", "start", "-W", "-a", "android.settings.SETTINGS"]);
  await wait(1500);
  xml = invoke("ui", Buffer.from([1]), "uinput-before.xml").toString("utf8");
  const uinputSearch = boundsFor(xml, (tag) => tag.includes('resource-id="com.android.settings:id/search_bar_title"'));
  invoke("input", encodeTap(uinputSearch.x, uinputSearch.y));
  focused = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await wait(250);
    xml = invoke("ui", Buffer.from([1]), `uinput-focused-${attempt}.xml`).toString("utf8");
    focused = /resource-id="com\.google\.android\.settings\.intelligence:id\/open_search_view_edit_text"[^>]*focused="true"/.test(xml);
    if (focused) break;
  }
  assert.equal(focused, true, "direct UInput requires an authoritative focused target");

  const keyboardKeys = [32, 23, 31, 25, 38, 30, 21];
  const keyEvents = keyboardKeys.flatMap((code) => [[code, 1], [code, 0]]);
  const uinputSession = openSession("uinput");
  const malformedSessionOperation = await uinputSession.call(Buffer.from([255]));
  assert.equal(malformedSessionOperation.status, -22);
  const created = await uinputSession.call(encodeKeyboardCreate("wasmc-android-keyboard", keyboardKeys));
  assert.equal(created.status, 0);
  assert.equal(created.output.length, 8);
  const firstKeyboard = created.output.readBigUInt64LE();
  await wait(1000);
  const batchStarted = performance.now();
  const emitted = await uinputSession.call(encodeKeyboardBatch(firstKeyboard, keyEvents));
  const batchMilliseconds = performance.now() - batchStarted;
  assert.equal(emitted.status, 0);
  assert.equal(emitted.output.readBigUInt64LE(), BigInt(keyEvents.length * 2));
  let uinputText = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await wait(250);
    xml = invoke("ui", Buffer.from([1]), `uinput-typed-${attempt}.xml`).toString("utf8");
    uinputText = /text="display"[^>]*open_search_view_edit_text/.test(xml);
    if (uinputText && xml.includes('text="Display size"')) break;
  }
  assert.equal(uinputText, true, "direct /dev/uinput events did not reach the semantic UI target");
  const destroyed = await uinputSession.call(encodeKeyboardDestroy(firstKeyboard));
  assert.equal(destroyed.status, 0);
  const stale = await uinputSession.call(encodeKeyboardBatch(firstKeyboard, [[32, 1], [32, 0]]));
  assert.equal(stale.status, -9);
  const recreated = await uinputSession.call(encodeKeyboardCreate("wasmc-android-keyboard", keyboardKeys));
  assert.equal(recreated.status, 0);
  const secondKeyboard = recreated.output.readBigUInt64LE();
  assert.notEqual(secondKeyboard, firstKeyboard);
  assert.equal((await uinputSession.call(encodeKeyboardDestroy(secondKeyboard))).status, 0);
  await uinputSession.close();
  const uinputFrame = invoke("display", Buffer.from([1]), "uinput-typed.png");
  const uinputFrameSha256 = hash(uinputFrame);
  assert.notEqual(uinputFrameSha256, beforeFrameSha256);

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

  const oneByteInput = path.join(target, "one-byte.bin");
  fs.writeFileSync(oneByteInput, Buffer.from([1]));
  adbCommand(["push", oneByteInput, `${remoteRoot}/one-byte.bin`]);
  const runRejectedDescriptor = (descriptor, remoteName, expected) => {
    const local = path.join(target, remoteName);
    fs.writeFileSync(local, JSON.stringify(descriptor));
    adbCommand(["push", local, `${remoteRoot}/${remoteName}`]);
    const rejected = spawnSync(adb, [
      "shell", remoteHost, `${remoteRoot}/${remoteName}`,
      `${remoteRoot}/one-byte.bin`, `${remoteRoot}/rejected-output.bin`,
    ], { cwd: root, encoding: "utf8" });
    assert.notEqual(rejected.status, 0);
    assert.match(`${rejected.stdout}\n${rejected.stderr}`, expected);
  };
  const displayDescriptor = JSON.parse(fs.readFileSync(path.join(target, "display-descriptor.json"), "utf8"));
  const outputLimited = structuredClone(displayDescriptor);
  outputLimited.limits.max_output_bytes = 64;
  runRejectedDescriptor(outputLimited, "output-limited.json", /adapter failed with status -75/);
  const inputLimited = JSON.parse(fs.readFileSync(path.join(target, "input-descriptor.json"), "utf8"));
  inputLimited.limits.max_input_bytes = 0;
  runRejectedDescriptor(inputLimited, "input-limited.json", /input limit/);
  const missingExport = structuredClone(displayDescriptor);
  missingExport.adapter.export = "missing_boundary_export";
  runRejectedDescriptor(missingExport, "missing-export.json", /dlsym failed/);
  const nestedDescriptor = structuredClone(displayDescriptor);
  nestedDescriptor.adapter.path = `../${domains.display.adapter}`;
  const nestedLocal = path.join(target, "nested-descriptor.json");
  fs.writeFileSync(nestedLocal, JSON.stringify(nestedDescriptor));
  adbCommand(["shell", "mkdir", "-p", `${remoteRoot}/nested`]);
  adbCommand(["push", nestedLocal, `${remoteRoot}/nested/descriptor.json`]);
  const escapedSibling = spawnSync(adb, [
    "shell", remoteHost, `${remoteRoot}/nested/descriptor.json`,
    `${remoteRoot}/one-byte.bin`, `${remoteRoot}/rejected-output.bin`,
  ], { cwd: root, encoding: "utf8" });
  assert.notEqual(escapedSibling.status, 0);
  assert.match(`${escapedSibling.stdout}\n${escapedSibling.stderr}`, /adapter must be an exact sibling/);

  const report = {
    accepted: true,
    schema: "wasmc.android-agent-computer-qualification/v2",
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
    direct_uinput: {
      device: "/dev/uinput",
      persistent_session: true,
      malformed_status_recovery: true,
      batch_input_events: keyEvents.length,
      kernel_events: Number(emitted.output.readBigUInt64LE()),
      batch_milliseconds: Number(batchMilliseconds.toFixed(3)),
      exact_text_postcondition: "display",
      frame_sha256: uinputFrameSha256,
      generation_checked_stale_resource_rejection: true,
      resource_recreation: true,
    },
    malformed_operation_rejection: true,
    adapter_identity_rejection: true,
    input_limit_rejection: true,
    output_limit_rejection: true,
    missing_export_rejection: true,
    adapter_sibling_confinement: true,
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
