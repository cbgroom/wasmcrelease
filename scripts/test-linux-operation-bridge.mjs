import {generatedLib,selectedRun} from './generated-lib-v2.mjs';
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "native operation bridge requires Linux");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "target/lib-defined-boundary-operation-bridge");
const selectedSocket = await generatedLib("wasmc-system-linux-socket");
const sourceRoot = selectedSocket.root;
const defaultManifest = path.join(root, "host/runtime/lib-boundary/native-linux/Cargo.toml");
const bridgeManifest = path.join(root, "host/runtime/lib-boundary/native-linux-operation/Cargo.toml");
const adapterSource = path.join(sourceRoot, "platform/native-adapter.c");
const adapter = path.join(target, "libwasmc_system_linux_socket.so");
const descriptor = path.join(target, "native-boundary.json");
const selectedEndpoint = await generatedLib("wasmc-system-linux-endpoint");
const endpointSourceRoot = selectedEndpoint.root;
const endpointAdapter = path.join(target, "libwasmc_system_linux_endpoint.so");
const endpointDescriptor = path.join(target, "endpoint-native-boundary.json");
const defaultExecutor = path.join(target, "default/release/wasmc-lib-boundary-native-linux");
const bridgeExecutor = path.join(target, "bridge/release/wasmc-lib-boundary-native-linux-operation");
const rustToolchain = process.env.WASMC_RUST_TOOLCHAIN ?? "+1.96.0";
const rustArgs = (args) => rustToolchain ? [rustToolchain, ...args] : args;
const command = (program, args, options = {}) =>
  execFileSync(program, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(selectedSocket.artifact, adapter);
fs.copyFileSync(selectedEndpoint.artifact, endpointAdapter);
command("cargo", rustArgs(["build", "--release", "--locked", "--manifest-path", defaultManifest]), {
  env: { ...process.env, CARGO_TARGET_DIR: path.join(target, "default") },
});
command("cargo", rustArgs(["build", "--release", "--locked", "--manifest-path", bridgeManifest, "--features", "operation-bridge"]), {
  env: { ...process.env, CARGO_TARGET_DIR: path.join(target, "bridge") },
});

const endpointReceiptPath = path.join(selectedRun(), "linux-endpoint-q1.json");
const endpointReceipt = JSON.parse(fs.readFileSync(endpointReceiptPath, "utf8"));
const defaultExecutorSha256 = hash(fs.readFileSync(defaultExecutor));
const bridgeExecutorSha256 = hash(fs.readFileSync(bridgeExecutor));
assert.equal(defaultExecutorSha256, endpointReceipt.executor_sha256, "default executor identity drifted");
assert.notEqual(bridgeExecutorSha256, defaultExecutorSha256, "successor bridge must have an independent identity");

const adapterSha256 = hash(fs.readFileSync(adapter));
const descriptorTemplate = fs.readFileSync(path.join(sourceRoot, "platform/native-boundary.template.json"), "utf8");
fs.writeFileSync(descriptor, descriptorTemplate.replace("BUILD_OUTPUT_SHA256", adapterSha256));
const endpointAdapterSha256 = hash(fs.readFileSync(endpointAdapter));
const endpointDescriptorTemplate = fs.readFileSync(path.join(endpointSourceRoot, "platform/native-boundary.template.json"), "utf8");
fs.writeFileSync(
  endpointDescriptor,
  endpointDescriptorTemplate
    .replace("libwasmc_system_linux_endpoint.so", path.basename(endpointAdapter))
    .replace("BUILD_OUTPUT_SHA256", endpointAdapterSha256),
);

class OperationSession {
  constructor(descriptorPath = descriptor) {
    this.child = spawn(bridgeExecutor, ["--operation-session", descriptorPath], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });
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
        const result = {
          status: this.buffer.readInt32LE(0),
          output: this.buffer.subarray(8, 8 + length),
        };
        this.buffer = this.buffer.subarray(8 + length);
        const pending = this.pending.shift();
        assert.ok(pending, "unsolicited operation bridge response");
        pending.resolve(result);
      }
    });
  }

  request(payload) {
    const frame = Buffer.alloc(4 + payload.length);
    frame.writeUInt32LE(payload.length, 0);
    payload.copy(frame, 4);
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.child.stdin.write(frame, (error) => { if (error) reject(error); });
    });
  }

  async close() {
    this.child.stdin.end();
    const [code] = await new Promise((resolve) => this.child.once("close", (...args) => resolve(args)));
    assert.equal(code, 0, this.stderr);
    assert.equal(this.pending.length, 0);
    assert.equal(this.buffer.length, 0);
  }
}

const commandToken = (commandId, token) => {
  const bytes = Buffer.alloc(9);
  bytes.writeUInt8(commandId, 0);
  bytes.writeBigUInt64LE(token, 1);
  return bytes;
};
const commandWait = (token, timeoutMilliseconds) => {
  const bytes = Buffer.alloc(13);
  bytes.writeUInt8(3, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(timeoutMilliseconds, 9);
  return bytes;
};
const expectOk = async (promise) => {
  const result = await promise;
  assert.equal(result.status, 0);
  return result.output;
};
const submit = async (session, payload, outputCapacity) => {
  const commandBytes = Buffer.alloc(5 + payload.length);
  commandBytes.writeUInt8(1, 0);
  commandBytes.writeUInt32LE(outputCapacity, 1);
  payload.copy(commandBytes, 5);
  return (await expectOk(session.request(commandBytes))).readBigUInt64LE();
};
const wait = async (session, token, timeoutMilliseconds = 5000) =>
  (await expectOk(session.request(commandWait(token, timeoutMilliseconds)))).readUInt8();
const take = async (session, token) => {
  const output = await expectOk(session.request(commandToken(5, token)));
  assert.ok(output.length >= 4);
  return { status: output.readInt32LE(0), output: output.subarray(4) };
};
const release = (session, token) => expectOk(session.request(commandToken(6, token)));
const submitSettle = async (session, payload, outputCapacity, timeoutMilliseconds = 5000) => {
  const commandBytes = Buffer.alloc(9 + payload.length);
  commandBytes.writeUInt8(8, 0);
  commandBytes.writeUInt32LE(outputCapacity, 1);
  commandBytes.writeUInt32LE(timeoutMilliseconds, 5);
  payload.copy(commandBytes, 9);
  const output = await expectOk(session.request(commandBytes));
  assert.ok(output.length >= 12);
  return {
    token: output.readBigUInt64LE(0),
    status: output.readInt32LE(8),
    output: output.subarray(12),
  };
};
const invoke = async (session, payload, outputCapacity) => {
  const token = await submit(session, payload, outputCapacity);
  assert.equal(await wait(session, token), 1);
  const result = await take(session, token);
  await release(session, token);
  assert.equal(result.status, 0);
  return result.output;
};

const ipv4 = (octets, port) => {
  const bytes = Buffer.alloc(6);
  octets.forEach((octet, index) => bytes.writeUInt8(octet, index));
  bytes.writeUInt16LE(port, 4);
  return bytes;
};
const bind = (port = 0) => {
  const bytes = Buffer.alloc(11);
  bytes.writeUInt8(1, 0);
  ipv4([127, 0, 0, 1], port).copy(bytes, 1);
  bytes.writeUInt32LE(128, 7);
  return bytes;
};
const connect = (port) => Buffer.concat([Buffer.from([2]), ipv4([127, 0, 0, 1], port)]);
const adapterToken = (operation, token) => {
  const bytes = Buffer.alloc(9);
  bytes.writeUInt8(operation, 0);
  bytes.writeBigUInt64LE(token, 1);
  return bytes;
};
const read = (token, maximum) => {
  const bytes = Buffer.alloc(13);
  bytes.writeUInt8(6, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(maximum, 9);
  return bytes;
};
const write = (token, payload) => {
  const bytes = Buffer.alloc(13 + payload.length);
  bytes.writeUInt8(7, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(payload.length, 9);
  payload.copy(bytes, 13);
  return bytes;
};
const poll = (token, events, timeoutMilliseconds) => {
  const bytes = Buffer.alloc(15);
  bytes.writeUInt8(8, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt16LE(events, 9);
  bytes.writeInt32LE(timeoutMilliseconds, 11);
  return bytes;
};

const session = new OperationSession();
const listener = (await invoke(session, bind(), 8)).readBigUInt64LE();
const listenerAddress = await invoke(session, adapterToken(4, listener), 6);
const port = listenerAddress.readUInt16LE(4);
const client = (await invoke(session, connect(port), 8)).readBigUInt64LE();
const server = (await invoke(session, adapterToken(3, listener), 14)).readBigUInt64LE();

const payload = Buffer.from("operation-bridge-real-socket");
const readOperation = await submit(session, read(server, 4096), 4096);
assert.equal((await expectOk(session.request(commandToken(2, readOperation)))).readUInt8(), 0);
assert.equal((await session.request(commandToken(6, readOperation))).status, -16);
await invoke(session, write(client, payload), 8);
assert.equal(await wait(session, readOperation), 1);
const readResult = await take(session, readOperation);
assert.equal(readResult.status, 0);
assert.deepEqual(readResult.output, payload);
assert.equal((await session.request(commandToken(5, readOperation))).status, -16);
await release(session, readOperation);
assert.equal((await session.request(commandToken(2, readOperation))).status, -9);

const cancellationOperation = await submit(session, read(server, 4096), 4096);
await expectOk(session.request(commandToken(4, cancellationOperation)));
assert.equal((await session.request(commandToken(4, cancellationOperation))).status, -114);
const latePayload = Buffer.from("cancelled-late-delivery");
await invoke(session, write(client, latePayload), 8);
assert.equal(await wait(session, cancellationOperation), 3);
assert.equal((await session.request(commandToken(5, cancellationOperation))).status, -16);
await release(session, cancellationOperation);

const timeoutOperation = await submit(session, poll(server, 1, 50), 2);
assert.equal((await session.request(commandWait(timeoutOperation, 1))).status, -110);
assert.equal(await wait(session, timeoutOperation, 1000), 1);
const timeoutResult = await take(session, timeoutOperation);
assert.equal(timeoutResult.status, 0);
assert.equal(timeoutResult.output.readUInt16LE(), 0);
await release(session, timeoutOperation);

const concurrency = 32;
const pairs = [];
for (let index = 0; index < concurrency; index += 1) {
  const outgoing = (await invoke(session, connect(port), 8)).readBigUInt64LE();
  const incoming = (await invoke(session, adapterToken(3, listener), 14)).readBigUInt64LE();
  pairs.push([outgoing, incoming]);
}
const reads = await Promise.all(pairs.map(([, incoming]) => submit(session, read(incoming, 64), 64)));
const writes = await Promise.all(pairs.map(([outgoing], index) =>
  submit(session, write(outgoing, Buffer.from(`concurrent-${index}`)), 8)));
for (let index = 0; index < concurrency; index += 1) {
  assert.equal(await wait(session, writes[index]), 1);
  assert.equal((await take(session, writes[index])).status, 0);
  await release(session, writes[index]);
  assert.equal(await wait(session, reads[index]), 1);
  const result = await take(session, reads[index]);
  assert.equal(result.status, 0);
  assert.deepEqual(result.output, Buffer.from(`concurrent-${index}`));
  await release(session, reads[index]);
}

for (const [outgoing, incoming] of pairs) {
  await invoke(session, adapterToken(10, outgoing), 0);
  await invoke(session, adapterToken(10, incoming), 0);
}
await invoke(session, adapterToken(10, client), 0);
await invoke(session, adapterToken(10, server), 0);
await invoke(session, adapterToken(10, listener), 0);
await session.close();

const encodePathRead = (endpointPath, maximum) => {
  const endpointBytes = Buffer.from(endpointPath);
  const bytes = Buffer.alloc(9 + endpointBytes.length);
  bytes.writeUInt8(1, 0);
  bytes.writeUInt32LE(endpointBytes.length, 1);
  bytes.writeUInt32LE(maximum, 5);
  endpointBytes.copy(bytes, 9);
  return bytes;
};
const endpointSession = new OperationSession(endpointDescriptor);
const procBytes = await invoke(endpointSession, encodePathRead("/proc/self/stat", 4096), 4096);
assert.ok(procBytes.length > 0);
assert.match(procBytes.toString(), /^\d+ \(/);
const atomicProcRead = await submitSettle(
  endpointSession,
  encodePathRead("/proc/self/stat", 4096),
  4096,
);
assert.equal(atomicProcRead.status, 0);
assert.match(atomicProcRead.output.toString(), /^\d+ \(/);
assert.equal((await endpointSession.request(commandToken(2, atomicProcRead.token))).status, -9);
await endpointSession.close();

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.lib-defined-native-operation-bridge/v1",
  default_executor_sha256: defaultExecutorSha256,
  successor_executor_sha256: bridgeExecutorSha256,
  default_executor_identity_preserved: true,
  exact_adapter_sha256: adapterSha256,
  exact_endpoint_adapter_sha256: endpointAdapterSha256,
  generic_commands: ["submit", "status", "wait", "cancel", "take", "release", "settle", "submit-settle"],
  fixed_host_network_apis: 0,
  real_socket_async_read: true,
  second_independent_lib_domain: "wasmc:system-linux-endpoint@0.0.1-dev.1",
  real_procfs_operation_through_bridge: true,
  pending_release_rejection: true,
  duplicate_take_rejection: true,
  stale_operation_rejection: true,
  cancellation_suppresses_late_delivery: true,
  cancelled_backend_completion_drained: true,
  wait_timeout_retains_operation: true,
  concurrent_operations: concurrency * 2,
  final_live_operations: 0,
  https_transport_migrated: false,
  lifecycle: "successor-prototype-not-admitted-not-released",
}));
