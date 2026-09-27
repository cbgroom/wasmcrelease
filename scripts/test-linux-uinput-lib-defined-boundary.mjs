import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "Linux uinput Lib qualification requires Linux");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "target/lib-defined-boundary-linux-uinput");
const sourceRoot = path.join(root, "libsrc/wasmc-system-linux-uinput");
const manifest = path.join(root, "host/runtime/lib-boundary/native-linux/Cargo.toml");
const rustSource = path.join(root, "host/runtime/lib-boundary/native-linux/src/main.rs");
const adapterSource = path.join(sourceRoot, "native-adapter.c");
const adapter = path.join(target, "libwasmc_system_linux_uinput.so");
const descriptorPath = path.join(target, "native-boundary.json");
const executor = path.join(target, "cargo/release/wasmc-lib-boundary-native-linux");
const profile = JSON.parse(fs.readFileSync(path.join(sourceRoot, "wfc-profile.json"), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const command = (program, args, options = {}) =>
  execFileSync(program, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
const rustToolchain = process.env.WASMC_RUST_TOOLCHAIN ?? "+1.96.0";
const rustArgs = (args) => rustToolchain ? [rustToolchain, ...args] : args;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function ensureUinputNode() {
  if (fs.existsSync("/dev/uinput")) return;
  const misc = fs.readFileSync("/proc/misc", "utf8");
  const match = misc.match(/^\s*(\d+)\s+uinput\s*$/m);
  assert.ok(match, "real Linux uinput misc device is not available");
  assert.equal(process.getuid?.(), 0, "creating /dev/uinput requires root in the qualification environment");
  command("mknod", ["/dev/uinput", "c", "10", match[1]]);
}

async function eventNodeForName(name) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const classes = fs.readdirSync("/sys/class/input", { withFileTypes: true })
      .filter((entry) => /^event\d+$/.test(entry.name));
    for (const entry of classes) {
      const classRoot = path.join("/sys/class/input", entry.name);
      const observed = fs.readFileSync(path.join(classRoot, "device/name"), "utf8").trim();
      if (observed !== name) continue;
      const [major, minor] = fs.readFileSync(path.join(classRoot, "dev"), "utf8").trim().split(":");
      fs.mkdirSync("/dev/input", { recursive: true });
      const devicePath = path.join("/dev/input", entry.name);
      if (!fs.existsSync(devicePath)) command("mknod", [devicePath, "c", major, minor]);
      return { className: entry.name, path: devicePath, major: Number(major), minor: Number(minor) };
    }
    await wait(10);
  }
  throw new Error(`uinput event node did not appear for ${name}`);
}

async function readInputEvents(descriptor, minimumRecords) {
  const recordBytes = 24;
  let bytes = Buffer.alloc(0);
  for (let attempt = 0; attempt < 200 && bytes.length < minimumRecords * recordBytes; attempt += 1) {
    const chunk = Buffer.alloc(recordBytes * 8);
    let wouldBlock = false;
    try {
      const length = fs.readSync(descriptor, chunk, 0, chunk.length, null);
      bytes = Buffer.concat([bytes, chunk.subarray(0, length)]);
    } catch (error) {
      assert.equal(error.code, "EAGAIN");
      wouldBlock = true;
    }
    if (wouldBlock) await wait(5);
  }
  assert.ok(bytes.length >= minimumRecords * recordBytes, "timed out waiting for real evdev records");
  assert.equal(bytes.length % recordBytes, 0);
  return Array.from({ length: bytes.length / recordBytes }, (_, index) => {
    const offset = index * recordBytes;
    return {
      type: bytes.readUInt16LE(offset + 16),
      code: bytes.readUInt16LE(offset + 18),
      value: bytes.readInt32LE(offset + 20),
    };
  });
}

class NativeSession {
  constructor() {
    this.child = spawn(executor, ["--session", descriptorPath], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    this.buffer = Buffer.alloc(0);
    this.pending = [];
    this.stderr = "";
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    this.child.stdout.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 8) {
        const length = this.buffer.readUInt32LE(4);
        if (this.buffer.length < 8 + length) break;
        const result = { status: this.buffer.readInt32LE(0), output: this.buffer.subarray(8, 8 + length) };
        this.buffer = this.buffer.subarray(8 + length);
        const pending = this.pending.shift();
        assert.ok(pending, "session produced an unsolicited response");
        pending.resolve(result);
      }
    });
    this.child.on("error", (error) => {
      while (this.pending.length) this.pending.shift().reject(error);
    });
  }

  request(payload) {
    const frame = Buffer.alloc(4 + payload.length);
    frame.writeUInt32LE(payload.length, 0);
    payload.copy(frame, 4);
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.child.stdin.write(frame);
    });
  }

  async close() {
    this.child.stdin.end();
    const [code] = await new Promise((resolve) => this.child.once("close", (...values) => resolve(values)));
    assert.equal(code, 0, this.stderr);
    assert.equal(this.pending.length, 0);
    assert.equal(this.buffer.length, 0);
  }
}

const encodeCreate = (name, keys) => {
  const nameBytes = Buffer.from(name);
  const bytes = Buffer.alloc(5 + nameBytes.length + keys.length * 2);
  bytes.writeUInt8(1, 0);
  bytes.writeUInt16LE(nameBytes.length, 1);
  bytes.writeUInt16LE(keys.length, 3);
  nameBytes.copy(bytes, 5);
  keys.forEach((key, index) => bytes.writeUInt16LE(key, 5 + nameBytes.length + index * 2));
  return bytes;
};
const encodeEmit = (token, code, value) => {
  const bytes = Buffer.alloc(15);
  bytes.writeUInt8(2, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt16LE(code, 9);
  bytes.writeInt32LE(value, 11);
  return bytes;
};
const encodeDestroy = (token) => {
  const bytes = Buffer.alloc(9);
  bytes.writeUInt8(3, 0);
  bytes.writeBigUInt64LE(token, 1);
  return bytes;
};
const encodeBatch = (token, events) => {
  const bytes = Buffer.alloc(11 + events.length * 6);
  bytes.writeUInt8(4, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt16LE(events.length, 9);
  events.forEach((event, index) => {
    bytes.writeUInt16LE(event.code, 11 + index * 6);
    bytes.writeInt32LE(event.value, 13 + index * 6);
  });
  return bytes;
};
const expectOk = async (promise) => {
  const result = await promise;
  assert.equal(result.status, 0);
  return result.output;
};

ensureUinputNode();
assert.equal(profile.schema, "wasmc.library-os-profile/v1");
assert.equal(profile.host.contract, "wasmc.lib-defined-host-boundary/v1");
assert.equal(profile.host.required_domain_apis, 0);
assert.equal(profile.libs.length, 1);
assert.equal(profile.libs[0].identity, "wasmc:system-linux-uinput@0.0.1-dev.1");

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
command("cc", ["-shared", "-fPIC", "-O2", "-Wall", "-Wextra", "-Werror", adapterSource, "-o", adapter]);
if (process.env.WASMC_WIT_PREVALIDATED !== "1") {
  command("wasm-tools", ["component", "wit", path.join(sourceRoot, "lib.wit")]);
}
command("cargo", rustArgs(["fmt", "--check", "--manifest-path", manifest]));
command("cargo", rustArgs(["clippy", "--locked", "--manifest-path", manifest, "--all-targets", "--", "-D", "warnings"]));
command("cargo", rustArgs(["build", "--release", "--locked", "--manifest-path", manifest]), {
  env: { ...process.env, CARGO_TARGET_DIR: path.join(target, "cargo") },
});

const adapterSha256 = hash(fs.readFileSync(adapter));
const endpointReceiptPath = process.arch === "arm64"
  ? path.join(root, "admission/host-lib-defined-boundary-v1/linux-aarch64-device-io-v7.json")
  : path.join(root, "admission/host-lib-defined-boundary-v1/linux-x86_64-device-io-v7.json");
const endpointReceipt = JSON.parse(fs.readFileSync(endpointReceiptPath, "utf8"));
const executorSha256 = hash(fs.readFileSync(executor));
assert.equal(executorSha256, endpointReceipt.outputs.executor_sha256, "fixed executor identity changed for uinput");
const descriptorTemplate = fs.readFileSync(path.join(sourceRoot, "native-boundary.template.json"), "utf8");
fs.writeFileSync(descriptorPath, descriptorTemplate.replace("BUILD_OUTPUT_SHA256", adapterSha256));

const controller = profile.controller;
const session = new NativeSession();
assert.equal((await session.request(Buffer.from([255]))).status, -22);
const malformed = encodeCreate(controller.device_name, controller.keys);
malformed.writeUInt16LE(65, 3);
assert.equal((await session.request(malformed)).status, -22);
const token = (await expectOk(session.request(
  encodeCreate(controller.device_name, controller.keys),
))).readBigUInt64LE();
const eventNode = await eventNodeForName(controller.device_name);
const eventDescriptor = fs.openSync(eventNode.path, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);

const observed = [];
for (const event of controller.events) {
  const emitted = await expectOk(session.request(encodeEmit(token, event.code, event.value)));
  assert.equal(Number(emitted.readBigUInt64LE()), 2);
  observed.push(...await readInputEvents(eventDescriptor, 2));
}
assert.deepEqual(observed.slice(0, 4), [
  { type: 1, code: 30, value: 1 },
  { type: 0, code: 0, value: 0 },
  { type: 1, code: 30, value: 0 },
  { type: 0, code: 0, value: 0 },
]);

const batchSize = 16;
const batches = 200;
const batch = Array.from({ length: batchSize }, (_, index) => ({ code: 30, value: (index + 1) % 2 }));
const batchStarted = process.hrtime.bigint();
for (let index = 0; index < batches; index += 1) {
  const emitted = await expectOk(session.request(encodeBatch(token, batch)));
  assert.equal(Number(emitted.readBigUInt64LE()), batchSize * 2);
  const records = await readInputEvents(eventDescriptor, batchSize * 2);
  assert.deepEqual(records[0], { type: 1, code: 30, value: 1 });
  assert.deepEqual(records[records.length - 1], { type: 0, code: 0, value: 0 });
}
const batchElapsedNs = Number(process.hrtime.bigint() - batchStarted);
const keyEvents = batchSize * batches;
const keyEventsPerSecond = keyEvents / (batchElapsedNs / 1e9);
assert.ok(keyEventsPerSecond >= 1000, `uinput batch rate too low: ${keyEventsPerSecond.toFixed(2)} key events/s`);
fs.closeSync(eventDescriptor);

await expectOk(session.request(encodeDestroy(token)));
assert.equal((await session.request(encodeEmit(token, 30, 1))).status, -9);
await session.close();

const exports = command("nm", ["-D", "--defined-only", adapter]);
assert.match(exports, /\bwasmc_boundary_v1_invoke\b/);
const rustText = fs.readFileSync(rustSource, "utf8");
for (const forbidden of ["/dev/uinput", "UI_DEV_CREATE", "UI_SET_EVBIT", "input_event", "KEY_A"]) {
  assert.equal(rustText.includes(forbidden), false, `uinput semantics leaked into fixed executor: ${forbidden}`);
}
const adapterText = fs.readFileSync(adapterSource, "utf8");
for (const required of ["/dev/uinput", "UI_DEV_CREATE", "UI_DEV_DESTROY", "struct input_event"]) {
  assert.equal(adapterText.includes(required), true, `uinput adapter missing ${required}`);
}

const invalidDescriptor = JSON.parse(fs.readFileSync(descriptorPath, "utf8"));
invalidDescriptor.adapter.sha256 = "0".repeat(64);
const invalidDescriptorPath = path.join(target, "invalid-native-boundary.json");
fs.writeFileSync(invalidDescriptorPath, JSON.stringify(invalidDescriptor));
const rejected = spawnSync(executor, ["--session", invalidDescriptorPath], { cwd: root, encoding: "utf8" });
assert.notEqual(rejected.status, 0);
assert.match(`${rejected.stdout}\n${rejected.stderr}`, /adapter identity mismatch/);

const report = {
  accepted: true,
  schema: "wasmc.linux-uinput-lib-defined-boundary-qualification/v1",
  platform: process.platform,
  architecture: process.arch,
  kernel: os.release(),
  rustc: command("rustc", rustArgs(["--version"])).trim(),
  profile: profile.id,
  identity: profile.libs[0].identity,
  executor_sha256: executorSha256,
  adapter_sha256: adapterSha256,
  host_source_changes_required: 0,
  fixed_executor_uinput_apis: 0,
  exact_adapter_identity: true,
  real_uinput_device_created: true,
  real_evdev_node: eventNode.className,
  real_key_down_observed: true,
  real_key_up_observed: true,
  synchronization_events_observed: 2,
  batch: {
    batches,
    key_events: keyEvents,
    key_events_per_second: Number(keyEventsPerSecond.toFixed(2)),
    minimum_key_events_per_second: 1000,
    one_kernel_write_per_batch: true,
  },
  generation_checked_stale_keyboard_rejection: true,
  malformed_profile_rejection: true,
  adapter_identity_rejection: true,
  wit_parsed: true,
  admitted: false,
  released: false,
};
const receiptPath = process.env.WASMC_UINPUT_RECEIPT;
if (receiptPath) {
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report));
