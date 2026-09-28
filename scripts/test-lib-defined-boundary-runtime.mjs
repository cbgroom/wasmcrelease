import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LibDefinedBoundary } from "../host/runtime/lib-boundary/reference.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const utf8 = new TextEncoder();
const text = new TextDecoder();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const executorPath = path.join(root, "host/runtime/lib-boundary/reference.mjs");
const executorSha256 = hash(await readFile(executorPath));

const encodeStrings = (values) => {
  const strings = values.map((value) => utf8.encode(value));
  const size = 4 + strings.reduce((total, value) => total + 4 + value.length, 0);
  const output = new Uint8Array(size);
  const view = new DataView(output.buffer);
  view.setUint32(0, strings.length, true);
  let cursor = 4;
  for (const value of strings) {
    view.setUint32(cursor, value.length, true);
    cursor += 4;
    output.set(value, cursor);
    cursor += value.length;
  }
  return output;
};

const encodeExchange = (host, port, payload) => {
  const hostBytes = utf8.encode(host);
  const body = utf8.encode(payload);
  const output = new Uint8Array(4 + hostBytes.length + 2 + body.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, hostBytes.length, true);
  output.set(hostBytes, 4);
  view.setUint16(4 + hostBytes.length, port, true);
  output.set(body, 6 + hostBytes.length);
  return output;
};

const boundary = new LibDefinedBoundary();
const executorIdentities = [];
const execute = async (packageRoot, input) => {
  executorIdentities.push(hash(await readFile(executorPath)));
  const resource = await boundary.install(packageRoot);
  const window = boundary.acquireWindow(input);
  const operation = boundary.submit(resource, window);
  assert.throws(() => boundary.releaseWindow(window), /window busy/);
  assert.deepEqual(await boundary.wait([operation]), [{ operation, state: "completed" }]);
  const completion = boundary.claim(operation);
  assert.equal(completion.state, "completed");
  assert.throws(() => boundary.claim(operation), /already claimed/);
  boundary.releaseOperation(operation);
  boundary.releaseWindow(window);
  boundary.releaseResource(resource);
  assert.deepEqual(boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  return completion.bytes;
};

const temporary = await mkdtemp(path.join(os.tmpdir(), "wasmc-lib-boundary-"));
let server;
try {
  const fixture = path.join(temporary, "input.bin");
  await writeFile(fixture, utf8.encode("file-ok"));
  const fileBytes = await execute(
    path.join(root, "libsrc/wasmc-system-file-prototype"),
    utf8.encode(fixture),
  );
  assert.equal(text.decode(fileBytes), "file-ok");

  const cancelledResource = await boundary.install(path.join(root, "libsrc/wasmc-system-file-prototype"));
  const cancelledWindow = boundary.acquireWindow(utf8.encode(fixture));
  const cancelledOperation = boundary.submit(cancelledResource, cancelledWindow);
  assert.equal(boundary.cancel(cancelledOperation), true);
  assert.deepEqual(await boundary.wait([cancelledOperation]), [{ operation: cancelledOperation, state: "cancelled" }]);
  const cancelledCompletion = boundary.claim(cancelledOperation);
  assert.equal(cancelledCompletion.state, "cancelled");
  assert.equal(cancelledCompletion.bytes, null);
  boundary.releaseOperation(cancelledOperation);
  boundary.releaseWindow(cancelledWindow);
  boundary.releaseResource(cancelledResource);
  assert.deepEqual(boundary.counts(), { resources: 0, windows: 0, operations: 0 });

  const processBytes = await execute(
    path.join(root, "libsrc/wasmc-system-process-prototype"),
    encodeStrings([process.execPath, "-e", "process.stdout.write('process-ok')"]),
  );
  assert.equal(text.decode(processBytes), "process-ok");

  server = createServer((socket) => {
    const chunks = [];
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => socket.end(Buffer.concat([Buffer.from("network-ok:"), ...chunks])));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const networkBytes = await execute(
    path.join(root, "libsrc/wasmc-system-network-prototype"),
    encodeExchange("127.0.0.1", address.port, "ping"),
  );
  assert.equal(text.decode(networkBytes), "network-ok:ping");

  assert.deepEqual(new Set(executorIdentities), new Set([executorSha256]));
  const executorSource = await readFile(executorPath, "utf8");
  for (const forbidden of ["node:child_process", "node:net", "read-file", "file-open", "process-spawn", "tcp-connect"]) {
    assert.equal(executorSource.includes(forbidden), false, `domain logic leaked into fixed executor: ${forbidden}`);
  }

  const descriptor = JSON.parse(await readFile(path.join(root, "libsrc/wasmc-system-file-prototype/native-boundary.json"), "utf8"));
  descriptor.adapter.sha256 = "0".repeat(64);
  const invalidRoot = path.join(temporary, "invalid-lib");
  await mkdir(invalidRoot);
  await copyFile(path.join(root, "libsrc/wasmc-system-file-prototype/native-adapter.mjs"), path.join(invalidRoot, "native-adapter.mjs"));
  await writeFile(path.join(invalidRoot, "native-boundary.json"), JSON.stringify(descriptor));
  await assert.rejects(boundary.install(invalidRoot), /adapter identity mismatch/);

  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.lib-defined-boundary-runtime/v1",
    candidates: [
      "wasmc-system-file-prototype",
      "wasmc-system-process-prototype",
      "wasmc-system-network-prototype",
    ],
    executor_sha256: executorSha256,
    unchanged_executor_domains: 3,
    real_file: true,
    real_process: true,
    real_loopback_network: true,
    completion_claim_once: true,
    pinned_window_release_rejected: true,
    cancelled_late_delivery_suppressed: true,
    adapter_identity_rejection: true,
    final_counts: boundary.counts(),
    lifecycle: "prototype-not-admitted-not-released",
  }));
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
