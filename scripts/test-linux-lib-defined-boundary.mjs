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
command("cc", ["-shared", "-fPIC", "-O2", "-Wall", "-Wextra", "-Werror", "-pthread", adapterSource, "-o", adapter]);
command("wasm-tools", ["component", "wit", path.join(sourceRoot, "lib.wit")]);
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

const encodeIoctlNone = (token, request) => {
  const bytes = Buffer.alloc(17);
  bytes.writeUInt8(23, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeBigUInt64LE(request, 9);
  return bytes;
};

const encodeIoctlValue = (token, request, value) => {
  const bytes = Buffer.alloc(25);
  bytes.writeUInt8(24, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeBigUInt64LE(request, 9);
  bytes.writeBigUInt64LE(BigInt(value), 17);
  return bytes;
};

const encodeWriteVectors = (token, payloads) => {
  const totalPayloadBytes = payloads.reduce((total, payload) => total + payload.length, 0);
  const bytes = Buffer.alloc(13 + payloads.length * 4 + totalPayloadBytes);
  bytes.writeUInt8(25, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(payloads.length, 9);
  let cursor = 13;
  for (const payload of payloads) {
    bytes.writeUInt32LE(payload.length, cursor);
    cursor += 4;
    payload.copy(bytes, cursor);
    cursor += payload.length;
  }
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

const encodeEpollCreate = () => Buffer.from([14]);

const encodeEpollControl = (eventSet, operation, endpoint, events, data) => {
  const bytes = Buffer.alloc(33);
  bytes.writeUInt8(15, 0);
  bytes.writeBigUInt64LE(eventSet, 1);
  bytes.writeInt32LE(operation, 9);
  bytes.writeBigUInt64LE(endpoint, 13);
  bytes.writeUInt32LE(events, 21);
  bytes.writeBigUInt64LE(data, 25);
  return bytes;
};

const encodeEpollWait = (eventSet, maximumEvents, timeoutMilliseconds) => {
  const bytes = Buffer.alloc(17);
  bytes.writeUInt8(16, 0);
  bytes.writeBigUInt64LE(eventSet, 1);
  bytes.writeUInt32LE(maximumEvents, 9);
  bytes.writeInt32LE(timeoutMilliseconds, 13);
  return bytes;
};

const decodeEpollEvents = (bytes) => {
  const count = bytes.readUInt32LE(0);
  assert.equal(bytes.length, 4 + count * 12);
  return Array.from({ length: count }, (_, index) => ({
    events: bytes.readUInt32LE(4 + index * 12),
    data: bytes.readBigUInt64LE(8 + index * 12),
  }));
};

const encodePipeCreate = (flags) => {
  const bytes = Buffer.alloc(5);
  bytes.writeUInt8(17, 0);
  bytes.writeUInt32LE(flags, 1);
  return bytes;
};

const encodeSplice = (source, target, maximum, flags) => {
  const bytes = Buffer.alloc(29);
  bytes.writeUInt8(18, 0);
  bytes.writeBigUInt64LE(source, 1);
  bytes.writeBigUInt64LE(target, 9);
  bytes.writeBigUInt64LE(BigInt(maximum), 17);
  bytes.writeUInt32LE(flags, 25);
  return bytes;
};

const encodeReadinessStart = (endpoint, events, timeoutMilliseconds) => {
  const bytes = Buffer.alloc(15);
  bytes.writeUInt8(19, 0);
  bytes.writeBigUInt64LE(endpoint, 1);
  bytes.writeUInt16LE(events, 9);
  bytes.writeInt32LE(timeoutMilliseconds, 11);
  return bytes;
};

const encodeReadinessToken = (operation, token) => {
  const bytes = Buffer.alloc(9);
  bytes.writeUInt8(operation, 0);
  bytes.writeBigUInt64LE(token, 1);
  return bytes;
};

const decodeReadiness = (bytes) => {
  assert.equal(bytes.length, 7);
  return {
    state: bytes.readUInt8(0),
    status: bytes.readInt32LE(1),
    events: bytes.readUInt16LE(5),
  };
};

const waitForReadiness = async (session, token) => {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const state = decodeReadiness(await expectOk(session.request(encodeReadinessToken(20, token))));
    if (state.state !== 0) return state;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.fail("readiness operation did not reach a terminal state");
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

const vectorPayloads = Array.from({ length: 64 }, (_, index) => Buffer.alloc(1024, index));
const vectorBytesPerOperation = vectorPayloads.reduce((total, payload) => total + payload.length, 0);
const vectorWriteOperations = 256;
const vectorWriteStarted = process.hrtime.bigint();
const vectorWrites = await Promise.all(Array.from(
  { length: vectorWriteOperations },
  () => session.request(encodeWriteVectors(nullToken, vectorPayloads)),
));
const vectorWriteElapsedNs = Number(process.hrtime.bigint() - vectorWriteStarted);
for (const result of vectorWrites) {
  assert.equal(result.status, 0);
  assert.equal(Number(result.output.readBigUInt64LE()), vectorBytesPerOperation);
}
const vectorWriteBytes = vectorWriteOperations * vectorBytesPerOperation;
const vectorWriteMibPerSecond = vectorWriteBytes / (1024 * 1024) / (vectorWriteElapsedNs / 1e9);
assert.ok(vectorWriteMibPerSecond >= 25, `vectored /dev write throughput too low: ${vectorWriteMibPerSecond.toFixed(2)} MiB/s`);
await expectOk(session.request(encodeClose(nullToken)));

const ptmxToken = (await expectOk(session.request(encodePath(3, "/dev/ptmx", 2 | 256 | 2048)))).readBigUInt64LE();
const ptmx = await expectOk(session.request(encodeIoctl(ptmxToken, 0x80045430n, Buffer.alloc(4), 4)));
assert.equal(ptmx.length, 8);
assert.equal(ptmx.readInt32LE(0), 0);
const pseudoTerminalNumber = ptmx.readUInt32LE(4);
const unlocked = await expectOk(session.request(encodeIoctl(ptmxToken, 0x40045431n, Buffer.alloc(4), 0)));
assert.equal(unlocked.readInt32LE(0), 0);
const slaveToken = (await expectOk(session.request(encodePath(3, `/dev/pts/${pseudoTerminalNumber}`, 2 | 256 | 2048)))).readBigUInt64LE();
const noArgumentControl = await expectOk(session.request(encodeIoctlNone(ptmxToken, 0x5451n)));
assert.equal(noArgumentControl.readInt32LE(0), 0);
const scalarValueControl = await expectOk(session.request(encodeIoctlValue(ptmxToken, 0x5409n, 0n)));
assert.equal(scalarValueControl.readInt32LE(0), 0);
const eventSetToken = (await expectOk(session.request(encodeEpollCreate()))).readBigUInt64LE();
const eventData = 0x1122334455667788n;
await expectOk(session.request(encodeEpollControl(eventSetToken, 1, ptmxToken, 1, eventData)));
const eventPayload = Buffer.from("epoll-device-ready\n");
await expectOk(session.request(encodeWrite(slaveToken, eventPayload)));
const readyEvents = decodeEpollEvents(await expectOk(session.request(encodeEpollWait(eventSetToken, 8, 1000))));
assert.ok(readyEvents.some((event) => (event.events & 1) === 1 && event.data === eventData));
const masterBytes = await expectOk(session.request(encodeRead(ptmxToken, 4096)));
assert.ok(masterBytes.includes(Buffer.from("epoll-device-ready")));
await expectOk(session.request(encodeEpollControl(eventSetToken, 2, ptmxToken, 0, 0n)));
assert.deepEqual(decodeEpollEvents(await expectOk(session.request(encodeEpollWait(eventSetToken, 8, 0)))), []);
await expectOk(session.request(encodeClose(eventSetToken)));
const staleEventSet = await session.request(encodeEpollWait(eventSetToken, 1, 0));
assert.equal(staleEventSet.status, -9);

const cancelledReadinessToken = (await expectOk(session.request(
  encodeReadinessStart(ptmxToken, 1, 5000),
))).readBigUInt64LE();
const pendingRelease = await session.request(encodeReadinessToken(22, cancelledReadinessToken));
assert.equal(pendingRelease.status, -16);
await expectOk(session.request(encodeReadinessToken(21, cancelledReadinessToken)));
const lateAfterCancelPayload = Buffer.from("late-after-cancel\n");
await expectOk(session.request(encodeWrite(slaveToken, lateAfterCancelPayload)));
assert.deepEqual(await waitForReadiness(session, cancelledReadinessToken), { state: 2, status: 0, events: 0 });
const lateAfterCancelBytes = await expectOk(session.request(encodeRead(ptmxToken, 4096)));
assert.ok(lateAfterCancelBytes.includes(Buffer.from("late-after-cancel")));
const repeatedCancel = await session.request(encodeReadinessToken(21, cancelledReadinessToken));
assert.equal(repeatedCancel.status, -114);
await expectOk(session.request(encodeReadinessToken(22, cancelledReadinessToken)));
const staleReadiness = await session.request(encodeReadinessToken(20, cancelledReadinessToken));
assert.equal(staleReadiness.status, -9);

const timedOutReadinessToken = (await expectOk(session.request(
  encodeReadinessStart(ptmxToken, 1, 20),
))).readBigUInt64LE();
assert.deepEqual(await waitForReadiness(session, timedOutReadinessToken), { state: 3, status: 0, events: 0 });
await expectOk(session.request(encodeReadinessToken(22, timedOutReadinessToken)));

const readyReadinessToken = (await expectOk(session.request(
  encodeReadinessStart(ptmxToken, 1, 1000),
))).readBigUInt64LE();
const asyncEventPayload = Buffer.from("async-device-ready\n");
await expectOk(session.request(encodeWrite(slaveToken, asyncEventPayload)));
const asynchronousReady = await waitForReadiness(session, readyReadinessToken);
assert.equal(asynchronousReady.state, 1);
assert.equal(asynchronousReady.status, 0);
assert.equal(asynchronousReady.events & 1, 1);
const asynchronousMasterBytes = await expectOk(session.request(encodeRead(ptmxToken, 4096)));
assert.ok(asynchronousMasterBytes.includes(Buffer.from("async-device-ready")));
await expectOk(session.request(encodeReadinessToken(22, readyReadinessToken)));
await expectOk(session.request(encodeClose(slaveToken)));
await expectOk(session.request(encodeClose(ptmxToken)));

const retainedPipeTokens = await expectOk(session.request(encodePipeCreate(0)));
const retainedPipeReadToken = retainedPipeTokens.readBigUInt64LE(0);
const retainedPipeWriteToken = retainedPipeTokens.readBigUInt64LE(8);
const vectoredSegments = [Buffer.from("uhid-event-one"), Buffer.from("uhid-event-two")];
const vectoredWritten = await expectOk(session.request(encodeWriteVectors(retainedPipeWriteToken, vectoredSegments)));
assert.equal(Number(vectoredWritten.readBigUInt64LE()), Buffer.concat(vectoredSegments).length);
const vectoredRead = await expectOk(session.request(encodeRead(retainedPipeReadToken, 4096)));
assert.deepEqual(vectoredRead, Buffer.concat(vectoredSegments));
const emptyVectoredWrite = await session.request(encodeWriteVectors(retainedPipeWriteToken, []));
assert.equal(emptyVectoredWrite.status, -22);
const excessiveVectors = Buffer.alloc(13);
excessiveVectors.writeUInt8(25, 0);
excessiveVectors.writeBigUInt64LE(retainedPipeWriteToken, 1);
excessiveVectors.writeUInt32LE(1025, 9);
assert.equal((await session.request(excessiveVectors)).status, -22);
const truncatedVector = encodeWriteVectors(retainedPipeWriteToken, [Buffer.from("truncated")]).subarray(0, -1);
assert.equal((await session.request(truncatedVector)).status, -22);
const retainedReadinessToken = (await expectOk(session.request(
  encodeReadinessStart(retainedPipeReadToken, 1, 5000),
))).readBigUInt64LE();
await expectOk(session.request(encodeClose(retainedPipeReadToken)));
await expectOk(session.request(encodeReadinessToken(21, retainedReadinessToken)));
assert.deepEqual(await waitForReadiness(session, retainedReadinessToken), { state: 2, status: 0, events: 0 });
await expectOk(session.request(encodeReadinessToken(22, retainedReadinessToken)));
await expectOk(session.request(encodeClose(retainedPipeWriteToken)));
const staleVectoredWrite = await session.request(encodeWriteVectors(retainedPipeWriteToken, [Buffer.from("stale")]));
assert.equal(staleVectoredWrite.status, -9);

const concurrentReadinessCount = 64;
const concurrentPipeTokens = await expectOk(session.request(encodePipeCreate(0)));
const concurrentPipeReadToken = concurrentPipeTokens.readBigUInt64LE(0);
const concurrentPipeWriteToken = concurrentPipeTokens.readBigUInt64LE(8);
const concurrentReadinessTokens = [];
for (let index = 0; index < concurrentReadinessCount; index += 1) {
  concurrentReadinessTokens.push((await expectOk(session.request(
    encodeReadinessStart(concurrentPipeReadToken, 1, 5000),
  ))).readBigUInt64LE());
}
await Promise.all(concurrentReadinessTokens.map(
  (token) => expectOk(session.request(encodeReadinessToken(21, token))),
));
const concurrentTerminalStates = await Promise.all(concurrentReadinessTokens.map(
  (token) => waitForReadiness(session, token),
));
for (const state of concurrentTerminalStates) assert.deepEqual(state, { state: 2, status: 0, events: 0 });
await Promise.all(concurrentReadinessTokens.map(
  (token) => expectOk(session.request(encodeReadinessToken(22, token))),
));
await expectOk(session.request(encodeClose(concurrentPipeReadToken)));
await expectOk(session.request(encodeClose(concurrentPipeWriteToken)));

const spliceZeroToken = (await expectOk(session.request(encodePath(3, "/dev/zero", 0)))).readBigUInt64LE();
const spliceNullToken = (await expectOk(session.request(encodePath(3, "/dev/null", 1)))).readBigUInt64LE();
const pipeTokens = await expectOk(session.request(encodePipeCreate(0)));
assert.equal(pipeTokens.length, 16);
const pipeReadToken = pipeTokens.readBigUInt64LE(0);
const pipeWriteToken = pipeTokens.readBigUInt64LE(8);
const spliceTargetBytes = 16 * 1024 * 1024;
let spliceBytes = 0;
let spliceOperations = 0;
const spliceStarted = process.hrtime.bigint();
while (spliceBytes < spliceTargetBytes) {
  const maximum = Math.min(65536, spliceTargetBytes - spliceBytes);
  const filled = Number((await expectOk(session.request(
    encodeSplice(spliceZeroToken, pipeWriteToken, maximum, 0),
  ))).readBigUInt64LE());
  assert.ok(filled > 0 && filled <= maximum);
  const drained = Number((await expectOk(session.request(
    encodeSplice(pipeReadToken, spliceNullToken, filled, 0),
  ))).readBigUInt64LE());
  assert.equal(drained, filled);
  spliceBytes += drained;
  spliceOperations += 2;
}
const spliceElapsedNs = Number(process.hrtime.bigint() - spliceStarted);
const spliceMibPerSecond = spliceBytes / (1024 * 1024) / (spliceElapsedNs / 1e9);
assert.ok(spliceMibPerSecond >= 25, `kernel splice throughput too low: ${spliceMibPerSecond.toFixed(2)} MiB/s`);
await expectOk(session.request(encodeClose(pipeReadToken)));
const stalePipe = await session.request(encodeSplice(pipeReadToken, spliceNullToken, 1, 0));
assert.equal(stalePipe.status, -9);
await expectOk(session.request(encodeClose(pipeWriteToken)));
await expectOk(session.request(encodeClose(spliceZeroToken)));
await expectOk(session.request(encodeClose(spliceNullToken)));

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
for (const forbidden of ["/dev/", "/proc/", "/sys/", "O_RDONLY", "O_WRONLY", "ioctl", "pollfd", "epoll", "eventfd", "pthread", "pipe2", "splice", "mmap", "msync", "read-endpoint", "write-endpoint"]) {
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
  candidate: "wasmc-system-linux-endpoint",
  schema: "wasmc.linux-lib-defined-boundary-qualification/v7",
  platform: process.platform,
  architecture: process.arch,
  kernel: os.release(),
  rustc: command("rustc", rustArgs(["--version"])).trim(),
  executor_sha256: hash(read(executor)),
  adapter_sha256: adapterSha256,
  exported_symbols: ["wasmc_boundary_v1_invoke"],
  wit_parsed: true,
  fixed_executor_domain_apis: 0,
  adapter_device_path_literals: 0,
  persistent_fd_resources: true,
  generation_checked_stale_handle_rejection: true,
  real_ioctl_buffer: "TIOCGPTN/TIOCSPTLCK",
  real_ioctl_none: "FIOCLEX",
  real_ioctl_value: "TCSBRK",
  ioctl_call_shapes: ["none", "value", "buffer"],
  vectored_write: true,
  vectored_write_segments: vectorPayloads.length,
  malformed_vectored_write_rejection: true,
  generation_checked_stale_vectored_write_rejection: true,
  real_poll: true,
  real_epoll_device_event: true,
  epoll_endpoint: "/dev/ptmx",
  generation_checked_stale_event_set_rejection: true,
  asynchronous_readiness_lifecycle: true,
  asynchronous_readiness_ready: true,
  asynchronous_readiness_cancelled: true,
  cancelled_late_readiness_suppressed: true,
  asynchronous_readiness_timed_out: true,
  pending_readiness_release_rejection: true,
  repeated_terminal_cancel_rejection: true,
  retained_endpoint_lifetime_during_readiness: true,
  concurrent_readiness_operations: concurrentReadinessCount,
  generation_checked_stale_readiness_rejection: true,
  kernel_splice_device_path: true,
  splice_path: "/dev/zero -> pipe -> /dev/null",
  generation_checked_stale_pipe_rejection: true,
  mapped_device_window: true,
  generation_checked_stale_mapping_rejection: true,
  performance: {
    read_operations: readOperations,
    read_bytes: readBytes,
    read_mib_per_second: Number(readMibPerSecond.toFixed(2)),
    write_operations: writeOperations,
    write_bytes: writeBytes,
    write_mib_per_second: Number(writeMibPerSecond.toFixed(2)),
    vector_write_operations: vectorWriteOperations,
    vector_write_segments_per_operation: vectorPayloads.length,
    vector_write_bytes: vectorWriteBytes,
    vector_write_mib_per_second: Number(vectorWriteMibPerSecond.toFixed(2)),
    warm_ns_per_operation: Math.round(warmNsPerOperation),
    cold_ns_per_operation: Math.round(coldNsPerOperation),
    persistent_speedup: Number(persistentSpeedup.toFixed(2)),
    mapping_operations: mappingOperations,
    mapping_bytes: mappingBytes,
    mapping_mib_per_second: Number(mappingMibPerSecond.toFixed(2)),
    splice_operations: spliceOperations,
    splice_bytes: spliceBytes,
    splice_mib_per_second: Number(spliceMibPerSecond.toFixed(2)),
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
