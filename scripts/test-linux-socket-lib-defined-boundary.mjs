import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "Linux socket Lib qualification must run on Linux");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "target/lib-defined-boundary-linux-socket");
const sourceRoot = path.join(root, "libsrc/wasmc-system-linux-socket");
const manifest = path.join(root, "host/runtime/lib-boundary/native-linux/Cargo.toml");
const rustSource = path.join(root, "host/runtime/lib-boundary/native-linux/src/main.rs");
const adapterSource = path.join(sourceRoot, "native-adapter.c");
const adapter = path.join(target, "libwasmc_system_linux_socket.so");
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
command("wasm-tools", ["component", "wit", path.join(sourceRoot, "lib.wit")]);
command("cargo", rustArgs(["fmt", "--check", "--manifest-path", manifest]));
command("cargo", rustArgs(["clippy", "--locked", "--manifest-path", manifest, "--all-targets", "--", "-D", "warnings"]));
command("cargo", rustArgs(["build", "--release", "--locked", "--manifest-path", manifest]), {
  env: { ...process.env, CARGO_TARGET_DIR: path.join(target, "cargo") },
});

const adapterSha256 = hash(read(adapter));
const endpointReceiptPath = process.arch === "arm64"
  ? path.join(root, "admission/host-lib-defined-boundary-v1/linux-aarch64-device-io-v7.json")
  : path.join(root, "admission/host-lib-defined-boundary-v1/linux-x86_64-device-io-v7.json");
const endpointReceipt = JSON.parse(fs.readFileSync(endpointReceiptPath, "utf8"));
const executorSha256 = hash(read(executor));
assert.equal(executorSha256, endpointReceipt.outputs.executor_sha256, "fixed executor identity drifted between system Libs");
const descriptorTemplate = fs.readFileSync(path.join(sourceRoot, "native-boundary.template.json"), "utf8");
assert.match(descriptorTemplate, /BUILD_OUTPUT_SHA256/);
fs.writeFileSync(descriptorPath, descriptorTemplate.replace("BUILD_OUTPUT_SHA256", adapterSha256));

const ipv4 = (octets, port) => {
  const bytes = Buffer.alloc(6);
  for (let index = 0; index < 4; index += 1) bytes.writeUInt8(octets[index], index);
  bytes.writeUInt16LE(port, 4);
  return bytes;
};

const decodeIpv4 = (bytes, offset = 0) => ({
  address: Array.from(bytes.subarray(offset, offset + 4)),
  port: bytes.readUInt16LE(offset + 4),
});

const encodeBind = (octets, port, backlog) => {
  const bytes = Buffer.alloc(11);
  bytes.writeUInt8(1, 0);
  ipv4(octets, port).copy(bytes, 1);
  bytes.writeUInt32LE(backlog, 7);
  return bytes;
};

const encodeConnect = (octets, port) => Buffer.concat([Buffer.from([2]), ipv4(octets, port)]);

const encodeToken = (operation, token) => {
  const bytes = Buffer.alloc(9);
  bytes.writeUInt8(operation, 0);
  bytes.writeBigUInt64LE(token, 1);
  return bytes;
};

const encodeRead = (token, maximum) => {
  const bytes = Buffer.alloc(13);
  bytes.writeUInt8(6, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(maximum, 9);
  return bytes;
};

const encodeWrite = (token, payload) => {
  const bytes = Buffer.alloc(13 + payload.length);
  bytes.writeUInt8(7, 0);
  bytes.writeBigUInt64LE(token, 1);
  bytes.writeUInt32LE(payload.length, 9);
  payload.copy(bytes, 13);
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

const readExact = async (session, token, length) => {
  const chunks = [];
  let total = 0;
  while (total < length) {
    const chunk = await expectOk(session.request(encodeRead(token, length - total)));
    assert.ok(chunk.length > 0, "unexpected TCP EOF");
    chunks.push(chunk);
    total += chunk.length;
  }
  return Buffer.concat(chunks);
};

const session = new NativeSession();
const loopback = [127, 0, 0, 1];
const listenerToken = (await expectOk(session.request(encodeBind(loopback, 0, 128)))).readBigUInt64LE();
const listenerAddress = decodeIpv4(await expectOk(session.request(encodeToken(4, listenerToken))));
assert.deepEqual(listenerAddress.address, loopback);
assert.ok(listenerAddress.port > 0);

const clientToken = (await expectOk(session.request(
  encodeConnect(loopback, listenerAddress.port),
))).readBigUInt64LE();
const accepted = await expectOk(session.request(encodeToken(3, listenerToken)));
assert.equal(accepted.length, 14);
const serverToken = accepted.readBigUInt64LE(0);
const acceptedPeer = decodeIpv4(accepted, 8);
const clientLocal = decodeIpv4(await expectOk(session.request(encodeToken(4, clientToken))));
const clientPeer = decodeIpv4(await expectOk(session.request(encodeToken(5, clientToken))));
const serverLocal = decodeIpv4(await expectOk(session.request(encodeToken(4, serverToken))));
const serverPeer = decodeIpv4(await expectOk(session.request(encodeToken(5, serverToken))));
assert.deepEqual(clientLocal, acceptedPeer);
assert.deepEqual(serverPeer, acceptedPeer);
assert.deepEqual(clientPeer, listenerAddress);
assert.deepEqual(serverLocal, listenerAddress);

const request = Buffer.from("lib-defined-linux-socket-request");
assert.equal(Number((await expectOk(session.request(encodeWrite(clientToken, request)))).readBigUInt64LE()), request.length);
const serverReady = await expectOk(session.request(encodePoll(serverToken, 1, 1000)));
assert.equal(serverReady.readUInt16LE() & 1, 1);
assert.deepEqual(await readExact(session, serverToken, request.length), request);

const response = Buffer.from("lib-defined-linux-socket-response");
assert.equal(Number((await expectOk(session.request(encodeWrite(serverToken, response)))).readBigUInt64LE()), response.length);
assert.deepEqual(await readExact(session, clientToken, response.length), response);

const wrongKindAccept = await session.request(encodeToken(3, clientToken));
assert.equal(wrongKindAccept.status, -88);
assert.equal((await session.request(Buffer.from([1]))).status, -22);

const concurrentConnections = 64;
const retainedConnections = [];
for (let index = 0; index < concurrentConnections; index += 1) {
  const outgoing = (await expectOk(session.request(
    encodeConnect(loopback, listenerAddress.port),
  ))).readBigUInt64LE();
  const incoming = (await expectOk(session.request(encodeToken(3, listenerToken)))).readBigUInt64LE();
  retainedConnections.push([outgoing, incoming]);
}
for (const [outgoing, incoming] of retainedConnections) {
  await expectOk(session.request(encodeToken(10, outgoing)));
  await expectOk(session.request(encodeToken(10, incoming)));
}

const throughputPayload = Buffer.alloc(65536, 0x6b);
const throughputOperations = 128;
const throughputStarted = process.hrtime.bigint();
for (let index = 0; index < throughputOperations; index += 1) {
  const written = await expectOk(session.request(encodeWrite(clientToken, throughputPayload)));
  assert.equal(Number(written.readBigUInt64LE()), throughputPayload.length);
  assert.deepEqual(await readExact(session, serverToken, throughputPayload.length), throughputPayload);
}
const throughputElapsedNs = Number(process.hrtime.bigint() - throughputStarted);
const throughputBytes = throughputOperations * throughputPayload.length;
const throughputMibPerSecond = throughputBytes / (1024 * 1024) / (throughputElapsedNs / 1e9);
assert.ok(throughputMibPerSecond >= 25, `loopback TCP throughput too low: ${throughputMibPerSecond.toFixed(2)} MiB/s`);

await expectOk(session.request(encodeToken(9, clientToken)));
assert.equal((await expectOk(session.request(encodeRead(serverToken, 1)))).length, 0);
await expectOk(session.request(encodeToken(10, clientToken)));
await expectOk(session.request(encodeToken(10, serverToken)));
const staleStream = await session.request(encodeRead(clientToken, 1));
assert.equal(staleStream.status, -9);
await expectOk(session.request(encodeToken(10, listenerToken)));
const staleListener = await session.request(encodeToken(4, listenerToken));
assert.equal(staleListener.status, -9);
await session.close();

const exports = command("nm", ["-D", "--defined-only", adapter]);
assert.match(exports, /\bwasmc_boundary_v1_invoke\b/);
const rustText = fs.readFileSync(rustSource, "utf8");
for (const forbidden of ["AF_INET", "SOCK_STREAM", "sockaddr", "TcpListener", "TcpStream", "accept4", "getsockname", "getpeername"]) {
  assert.equal(rustText.includes(forbidden), false, `network semantics leaked into fixed executor: ${forbidden}`);
}
const adapterText = fs.readFileSync(adapterSource, "utf8");
assert.equal(adapterText.includes("127.0.0.1"), false, "endpoint selection leaked into socket adapter");

const invalidDescriptor = JSON.parse(fs.readFileSync(descriptorPath, "utf8"));
invalidDescriptor.adapter.sha256 = "0".repeat(64);
const invalidDescriptorPath = path.join(target, "invalid-native-boundary.json");
fs.writeFileSync(invalidDescriptorPath, JSON.stringify(invalidDescriptor));
const rejected = spawnSync(executor, ["--session", invalidDescriptorPath], { cwd: root, encoding: "utf8" });
assert.notEqual(rejected.status, 0);
assert.match(`${rejected.stdout}\n${rejected.stderr}`, /adapter identity mismatch/);

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.linux-socket-lib-defined-boundary-qualification/v1",
  candidate: "wasmc-system-linux-socket",
  platform: process.platform,
  architecture: process.arch,
  kernel: os.release(),
  rustc: command("rustc", rustArgs(["--version"])).trim(),
  identity: "wasmc:system-linux-socket@0.0.1-dev.1",
  executor_sha256: executorSha256,
  adapter_sha256: adapterSha256,
  exported_symbols: ["wasmc_boundary_v1_invoke"],
  wit_parsed: true,
  fixed_executor_network_apis: 0,
  fixed_executor_matches_endpoint_v7: true,
  adapter_endpoint_literals: 0,
  real_loopback_tcp: true,
  bind_ephemeral_listen_connect_accept: true,
  bidirectional_stream: true,
  readiness_poll: true,
  write_half_close: true,
  endpoint_identity: true,
  wrong_resource_kind_rejection: true,
  generation_checked_stale_stream_rejection: true,
  generation_checked_stale_listener_rejection: true,
  concurrent_connections: concurrentConnections,
  performance: {
    operations: throughputOperations,
    bytes: throughputBytes,
    mib_per_second: Number(throughputMibPerSecond.toFixed(2)),
    minimum_mib_per_second: 25,
  },
  adapter_identity_rejection: true,
  https_transport_migrated: false,
  lifecycle: "prototype-qualified-on-this-linux-not-admitted-not-released",
}));
