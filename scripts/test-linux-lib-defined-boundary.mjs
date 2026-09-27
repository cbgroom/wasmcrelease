import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "Linux native-boundary qualification must run on Linux");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "target/lib-defined-boundary-linux");
const sourceRoot = path.join(root, "libsrc/wasmc-system-linux-endpoint");
const manifest = path.join(root, "host/runtime/lib-boundary/native-linux/Cargo.toml");
const rustSource = path.join(root, "host/runtime/lib-boundary/native-linux/src/main.rs");
const adapterSource = path.join(sourceRoot, "native-adapter.c");
const adapter = path.join(target, "libwasmc_system_linux_endpoint.so");
const descriptorPath = path.join(target, "native-boundary.json");
const executor = path.join(target, "cargo/release/wasmc-lib-boundary-native-linux");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (relative) => fs.readFileSync(relative);
const command = (program, args, options = {}) =>
  execFileSync(program, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
const rustToolchain = process.env.WASMC_RUST_TOOLCHAIN ?? "+1.96.0";
const rustArgs = (args) => rustToolchain ? [rustToolchain, ...args] : args;

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
command("cc", ["-shared", "-fPIC", "-O2", "-Wall", "-Wextra", "-Werror", adapterSource, "-o", adapter]);
command("cargo", rustArgs(["fmt", "--check", "--manifest-path", manifest]));
command("cargo", rustArgs(["clippy", "--locked", "--manifest-path", manifest, "--all-targets", "--", "-D", "warnings"]));
command("cargo", rustArgs(["build", "--release", "--locked", "--manifest-path", manifest]), {
  env: { ...process.env, CARGO_TARGET_DIR: path.join(target, "cargo") },
});

const adapterSha256 = hash(read(adapter));
const descriptorTemplate = fs.readFileSync(path.join(sourceRoot, "native-boundary.template.json"), "utf8");
assert.match(descriptorTemplate, /BUILD_OUTPUT_SHA256/);
fs.writeFileSync(descriptorPath, descriptorTemplate.replace("BUILD_OUTPUT_SHA256", adapterSha256));

const encodePath = (operation, endpoint, value) => {
  const endpointBytes = Buffer.from(endpoint);
  const payload = Buffer.isBuffer(value) ? value : Buffer.alloc(0);
  const scalar = Number.isInteger(value) ? value : payload.length;
  const bytes = Buffer.alloc(9 + endpointBytes.length + payload.length);
  bytes.writeUInt8(operation, 0);
  bytes.writeUInt32LE(endpointBytes.length, 1);
  bytes.writeUInt32LE(scalar, 5);
  endpointBytes.copy(bytes, 9);
  payload.copy(bytes, 9 + endpointBytes.length);
  return bytes;
};

const encodeRead = (token, maximum) => {
  const bytes = Buffer.alloc(13);
  bytes.writeUInt8(4, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(maximum, 9);
  return bytes;
};

const encodeWrite = (token, payload) => {
  const bytes = Buffer.alloc(13 + payload.length);
  bytes.writeUInt8(5, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(payload.length, 9);
  payload.copy(bytes, 13);
  return bytes;
};

const encodeClose = (token) => {
  const bytes = Buffer.alloc(9);
  bytes.writeUInt8(6, 0);
  bytes.writeBigUInt64LE(token, 1);
  return bytes;
};

const encodeIoctl = (token, request, argument, resultCapacity) => {
  const bytes = Buffer.alloc(25 + argument.length);
  bytes.writeUInt8(7, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeBigUInt64LE(request, 9);
  bytes.writeUInt32LE(argument.length, 17);
  bytes.writeUInt32LE(resultCapacity, 21);
  argument.copy(bytes, 25);
  return bytes;
};

const encodePoll = (token, events, timeoutMilliseconds) => {
  const bytes = Buffer.alloc(15);
  bytes.writeUInt8(8, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt16LE(events, 9);
  bytes.writeInt32LE(timeoutMilliseconds, 11);
  return bytes;
};

const encodeMap = (token, offset, length, protection, flags) => {
  const bytes = Buffer.alloc(33);
  bytes.writeUInt8(9, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeBigUInt64LE(BigInt(offset), 9);
  bytes.writeBigUInt64LE(BigInt(length), 17);
  bytes.writeUInt32LE(protection, 25);
  bytes.writeUInt32LE(flags, 29);
  return bytes;
};

const encodeMappingRead = (token, offset, maximum) => {
  const bytes = Buffer.alloc(21);
  bytes.writeUInt8(10, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeBigUInt64LE(BigInt(offset), 9);
  bytes.writeUInt32LE(maximum, 17);
  return bytes;
};

const encodeMappingWrite = (token, offset, payload) => {
  const bytes = Buffer.alloc(21 + payload.length);
  bytes.writeUInt8(11, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeBigUInt64LE(BigInt(offset), 9);
  bytes.writeUInt32LE(payload.length, 17);
  payload.copy(bytes, 21);
  return bytes;
};

const encodeMappingSync = (token, flags) => {
  const bytes = Buffer.alloc(13);
  bytes.writeUInt8(12, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(flags, 9);
  return bytes;
};

const encodeUnmap = (token) => {
  const bytes = Buffer.alloc(9);
  bytes.writeUInt8(13, 0);
  bytes.writeBigUInt64LE(token, 1);
  return bytes;
};

const invoke = (name, input) => {
  const inputPath = path.join(target, `${name}.input.bin`);
  const outputPath = path.join(target, `${name}.output.bin`);
  fs.writeFileSync(inputPath, input);
  const report = JSON.parse(command(executor, [descriptorPath, inputPath, outputPath]));
  assert.equal(report.accepted, true);
  assert.equal(report.identity, "wasmc:system-linux-endpoint@0.0.1-dev.1");
  assert.equal(report.adapter_sha256, adapterSha256);
  return read(outputPath);
};

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

const expectOk = async (promise) => {
  const result = await promise;
  assert.equal(result.status, 0);
  return result.output;
};

const zero = invoke("dev-zero", encodePath(1, "/dev/zero", 32));
assert.equal(zero.length, 32);
assert.ok(zero.every((byte) => byte === 0));
const nullPayload = Buffer.from("wasmc-linux-dev-null");
const nullResult = invoke("dev-null", encodePath(2, "/dev/null", nullPayload));
assert.equal(nullResult.length, 8);
assert.equal(Number(nullResult.readBigUInt64LE()), nullPayload.length);
const proc = invoke("proc-self-stat", encodePath(1, "/proc/self/stat", 4096));
assert.ok(proc.length > 0);
const sys = invoke("sys-cpu-online", encodePath(1, "/sys/devices/system/cpu/online", 4096));
assert.match(sys.toString("utf8"), /^\d/);

const session = new NativeSession();
const zeroToken = (await expectOk(session.request(encodePath(3, "/dev/zero", 0)))).readBigUInt64LE();
const pollResult = await expectOk(session.request(encodePoll(zeroToken, 1, 0)));
assert.equal(pollResult.readUInt16LE() & 1, 1);
for (let index = 0; index < 32; index += 1) {
  const output = await expectOk(session.request(encodeRead(zeroToken, 65536)));
  assert.equal(output.length, 65536);
}

const readOperations = 512;
const readBytes = readOperations * 65536;
const readStarted = process.hrtime.bigint();
const reads = await Promise.all(Array.from({ length: readOperations }, () => session.request(encodeRead(zeroToken, 65536))));
const readElapsedNs = Number(process.hrtime.bigint() - readStarted);
for (const result of reads) {
  assert.equal(result.status, 0);
  assert.equal(result.output.length, 65536);
}
const readMibPerSecond = readBytes / (1024 * 1024) / (readElapsedNs / 1e9);
assert.ok(readMibPerSecond >= 25, `persistent /dev read throughput too low: ${readMibPerSecond.toFixed(2)} MiB/s`);

await expectOk(session.request(encodeClose(zeroToken)));
const stale = await session.request(encodeRead(zeroToken, 1));
assert.equal(stale.status, -9);

const writePayload = Buffer.alloc(65536, 0x5a);
const nullToken = (await expectOk(session.request(encodePath(3, "/dev/null", 1)))).readBigUInt64LE();
const writeOperations = 256;
const writeBytes = writeOperations * writePayload.length;
const writeStarted = process.hrtime.bigint();
const writes = await Promise.all(Array.from({ length: writeOperations }, () => session.request(encodeWrite(nullToken, writePayload))));
const writeElapsedNs = Number(process.hrtime.bigint() - writeStarted);
for (const result of writes) {
  assert.equal(result.status, 0);
  assert.equal(Number(result.output.readBigUInt64LE()), writePayload.length);
}
const writeMibPerSecond = writeBytes / (1024 * 1024) / (writeElapsedNs / 1e9);
assert.ok(writeMibPerSecond >= 25, `persistent /dev write throughput too low: ${writeMibPerSecond.toFixed(2)} MiB/s`);
await expectOk(session.request(encodeClose(nullToken)));

const ptmxToken = (await expectOk(session.request(encodePath(3, "/dev/ptmx", 2 | 256)))).readBigUInt64LE();
const ptmx = await expectOk(session.request(encodeIoctl(ptmxToken, 0x80045430n, Buffer.alloc(4), 4)));
assert.equal(ptmx.length, 8);
assert.equal(ptmx.readInt32LE(0), 0);
assert.ok(ptmx.readUInt32LE(4) >= 0);
await expectOk(session.request(encodeClose(ptmxToken)));

const mappedZeroToken = (await expectOk(session.request(encodePath(3, "/dev/zero", 2)))).readBigUInt64LE();
const mappingToken = (await expectOk(session.request(encodeMap(mappedZeroToken, 0, 1048576, 3, 2)))).readBigUInt64LE();
const mappedPattern = Buffer.alloc(65536);
for (let index = 0; index < mappedPattern.length; index += 1) mappedPattern[index] = index & 0xff;
const mappedWritten = await expectOk(session.request(encodeMappingWrite(mappingToken, 4096, mappedPattern)));
assert.equal(Number(mappedWritten.readBigUInt64LE()), mappedPattern.length);
const mappedRead = await expectOk(session.request(encodeMappingRead(mappingToken, 4096, mappedPattern.length)));
assert.deepEqual(mappedRead, mappedPattern);
await expectOk(session.request(encodeMappingSync(mappingToken, 4)));
const mappingOutOfBounds = await session.request(encodeMappingRead(mappingToken, 1048576 - 8, 16));
assert.equal(mappingOutOfBounds.status, -22);

const mappingOperations = 256;
const mappingBytes = mappingOperations * mappedPattern.length;
const mappingStarted = process.hrtime.bigint();
const mappingReads = await Promise.all(Array.from(
  { length: mappingOperations },
  () => session.request(encodeMappingRead(mappingToken, 4096, mappedPattern.length)),
));
const mappingElapsedNs = Number(process.hrtime.bigint() - mappingStarted);
for (const result of mappingReads) {
  assert.equal(result.status, 0);
  assert.equal(result.output.length, mappedPattern.length);
}
const mappingMibPerSecond = mappingBytes / (1024 * 1024) / (mappingElapsedNs / 1e9);
assert.ok(mappingMibPerSecond >= 25, `mapped window throughput too low: ${mappingMibPerSecond.toFixed(2)} MiB/s`);
await expectOk(session.request(encodeUnmap(mappingToken)));
const staleMapping = await session.request(encodeMappingRead(mappingToken, 0, 1));
assert.equal(staleMapping.status, -9);
await expectOk(session.request(encodeClose(mappedZeroToken)));
await session.close();

const coldOperations = 12;
const coldStarted = process.hrtime.bigint();
for (let index = 0; index < coldOperations; index += 1) invoke(`cold-${index}`, encodePath(1, "/dev/zero", 65536));
const coldElapsedNs = Number(process.hrtime.bigint() - coldStarted);
const warmNsPerOperation = readElapsedNs / readOperations;
const coldNsPerOperation = coldElapsedNs / coldOperations;
const persistentSpeedup = coldNsPerOperation / warmNsPerOperation;
assert.ok(persistentSpeedup >= 5, `persistent session speedup too low: ${persistentSpeedup.toFixed(2)}x`);

const exports = command("nm", ["-D", "--defined-only", adapter]);
assert.match(exports, /\bwasmc_boundary_v1_invoke\b/);
const rustText = fs.readFileSync(rustSource, "utf8");
for (const forbidden of ["/dev/", "/proc/", "/sys/", "O_RDONLY", "O_WRONLY", "ioctl", "pollfd", "mmap", "msync", "read-endpoint", "write-endpoint"]) {
  assert.equal(rustText.includes(forbidden), false, `domain or Linux endpoint semantics leaked into fixed executor: ${forbidden}`);
}
const adapterText = fs.readFileSync(adapterSource, "utf8");
for (const forbidden of ["/dev/", "/proc/", "/sys/"]) {
  assert.equal(adapterText.includes(forbidden), false, `device selection leaked into generic Lib adapter: ${forbidden}`);
}

const invalidDescriptor = JSON.parse(fs.readFileSync(descriptorPath, "utf8"));
invalidDescriptor.adapter.sha256 = "0".repeat(64);
const invalidDescriptorPath = path.join(target, "invalid-native-boundary.json");
fs.writeFileSync(invalidDescriptorPath, JSON.stringify(invalidDescriptor));
const rejected = spawnSync(executor, [invalidDescriptorPath, path.join(target, "dev-zero.input.bin"), path.join(target, "rejected.bin")], {
  cwd: root,
  encoding: "utf8",
});
assert.notEqual(rejected.status, 0);
assert.match(`${rejected.stdout}\n${rejected.stderr}`, /adapter identity mismatch/);

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.linux-lib-defined-boundary-qualification/v3",
  platform: process.platform,
  architecture: process.arch,
  kernel: os.release(),
  rustc: command("rustc", rustArgs(["--version"])).trim(),
  executor_sha256: hash(read(executor)),
  adapter_sha256: adapterSha256,
  exported_symbols: ["wasmc_boundary_v1_invoke"],
  fixed_executor_domain_apis: 0,
  adapter_device_path_literals: 0,
  persistent_fd_resources: true,
  generation_checked_stale_handle_rejection: true,
  real_ioctl: "TIOCGPTN",
  real_poll: true,
  mapped_device_window: true,
  generation_checked_stale_mapping_rejection: true,
  performance: {
    read_operations: readOperations,
    read_bytes: readBytes,
    read_mib_per_second: Number(readMibPerSecond.toFixed(2)),
    write_operations: writeOperations,
    write_bytes: writeBytes,
    write_mib_per_second: Number(writeMibPerSecond.toFixed(2)),
    warm_ns_per_operation: Math.round(warmNsPerOperation),
    cold_ns_per_operation: Math.round(coldNsPerOperation),
    persistent_speedup: Number(persistentSpeedup.toFixed(2)),
    mapping_operations: mappingOperations,
    mapping_bytes: mappingBytes,
    mapping_mib_per_second: Number(mappingMibPerSecond.toFixed(2)),
    minimum_mib_per_second: 25,
    minimum_speedup: 5,
  },
  real_linux_endpoints: {
    dev_zero: true,
    dev_null: true,
    dev_ptmx: true,
    proc_self_stat: true,
    sys_cpu_online: true,
  },
  adapter_identity_rejection: true,
  lifecycle: "prototype-qualified-on-this-linux-not-admitted-not-released",
}));
