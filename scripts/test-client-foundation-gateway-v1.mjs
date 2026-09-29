import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import tls from "node:tls";
import os from "node:os";
import path from "node:path";
import { ClientFoundation } from "../runtime/client-foundation-v1/foundation.mjs";
import { ClientFoundationGateway } from "../runtime/client-foundation-gateway-v1/gateway.mjs";
import { encodeFrame } from "../runtime/client-foundation-v1/websocket-wire.mjs";

const root = process.cwd();
const cert = readFileSync(path.join(root, "scripts/fixtures/ios-wss-cert.pem"));
const key = readFileSync(path.join(root, "scripts/fixtures/ios-wss-key.pem"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function makeBundle(relativeRoot) {
  const packageRoot = path.join(root, relativeRoot);
  const files = ["lib.wit", "native-boundary.json", "native-adapter.mjs"].map((name) => {
    const bytes = readFileSync(path.join(packageRoot, name));
    return { path: name, sha256: sha256(bytes), base64: bytes.toString("base64") };
  });
  const descriptor = JSON.parse(readFileSync(path.join(packageRoot, "native-boundary.json"), "utf8"));
  return Buffer.from(JSON.stringify({
    schema: "wasmc.client-foundation-bundle/v1",
    identity: descriptor.identity,
    api: "wasmc:client-foundation-block@0.0.1",
    files,
  }));
}

async function api(origin, method, pathname, body = null) {
  const url = new URL(pathname, origin);
  const bytes = body === null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method,
      ca: cert,
      rejectUnauthorized: true,
      headers: bytes ? { "content-type": "application/json", "content-length": bytes.length } : {},
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve({ status: response.statusCode, value });
      });
    });
    request.on("error", reject);
    if (bytes) request.write(bytes);
    request.end();
  });
}

async function waitFor(origin, predicate, timeoutMs = 5000, clientId = "client-a") {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await api(origin, "GET", `/v1/clients/${clientId}`);
    if (predicate(result.value)) return result.value;
    await wait(25);
  }
  throw new Error("gateway state wait timed out");
}

async function connectSilentClient(port) {
  const socket = tls.connect({ host: "localhost", port, servername: "localhost", ca: cert, rejectUnauthorized: true });
  await once(socket, "secureConnect");
  const websocketKey = randomBytes(16).toString("base64");
  socket.write([
    "GET /v1/clients/silent-client/control HTTP/1.1",
    `Host: localhost:${port}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Key: ${websocketKey}`,
    "Sec-WebSocket-Version: 13",
    "",
    "",
  ].join("\r\n"));
  let response = Buffer.alloc(0);
  while (!response.includes("\r\n\r\n")) {
    const [chunk] = await once(socket, "data");
    response = Buffer.concat([response, chunk]);
  }
  assert.match(response.toString("latin1"), /^HTTP\/1\.1 101\b/);
  socket.write(encodeFrame(JSON.stringify({
    type: "hello",
    schema: "wasmc.client-foundation-control/v1",
    last_server_sequence: 0,
    graph_revision: 1,
    active: { kind: "factory" },
  }), { mask: true }));
  return socket;
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "wasmc-foundation-gateway-"));
const gatewayRoot = path.join(temporaryRoot, "gateway");
const clientRoot = path.join(temporaryRoot, "client");
const gatewayOptions = {
  dataRoot: gatewayRoot,
  tlsKey: key,
  tlsCert: cert,
  maxCompletedCommandsPerClient: 2,
  maxArchiveSegmentsPerClient: 2,
  heartbeatIntervalMs: 20,
  heartbeatTimeoutMs: 120,
};
let gateway = new ClientFoundationGateway(gatewayOptions);
let foundation;
const controller = new AbortController();

try {
  const firstAddress = await gateway.start();
  const origin = firstAddress.origin;
  const contender = new ClientFoundationGateway(gatewayOptions);
  await assert.rejects(() => contender.start(), /already locked/);
  await contender.close();
  assert.equal((await api(origin, "GET", "/healthz")).status, 200);
  const artifact = await api(origin, "POST", "/v1/artifacts", makeBundle("runtime/client-foundation-v1/fixtures/dynamic-provider"));
  assert.equal(artifact.status, 201);
  assert.equal(artifact.value.sha256.length, 64);

  const inventoryInput = { message_id: "gw-m1", operation: "inventory.report", payload: {} };
  const inventory = await api(origin, "POST", "/v1/clients/client-a/commands", inventoryInput);
  assert.equal(inventory.status, 201);
  assert.equal(inventory.value.command.sequence, 1);
  const duplicate = await api(origin, "POST", "/v1/clients/client-a/commands", inventoryInput);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.value.duplicate, true);
  assert.equal(duplicate.value.command.sequence, 1);
  const graphInput = {
    message_id: "gw-m2",
    operation: "graph.apply",
    payload: { expected_graph_revision: 1, artifact_sha256: artifact.value.sha256 },
  };
  const graph = await api(origin, "POST", "/v1/clients/client-a/commands", graphInput);
  assert.equal(graph.status, 201);
  assert.equal(graph.value.command.sequence, 2);
  assert.equal(graph.value.command.payload.artifact_url, `${origin}/v1/artifacts/${artifact.value.sha256}`);

  foundation = new ClientFoundation({
    stateRoot: clientRoot,
    factoryRoot: path.join(root, "runtime/client-foundation-v1/factory-provider"),
    gatewayUrl: `${firstAddress.wss_base}/v1/clients/client-a/control`,
    ca: cert,
    reconnectDelayMs: 25,
  });
  const running = foundation.run(controller.signal);
  const firstState = await waitFor(origin, (state) => state.commands.length === 2 && state.commands.every((command) => command.receipt));
  assert.equal(firstState.commands[1].receipt.outcome, "committed");
  assert.equal(foundation.snapshot().active.identity, "wasmc:client-foundation-dynamic@0.0.1-dev.1");
  const heartbeatState = await waitFor(origin, (state) => state.connection?.pongs >= 1);
  assert.ok(heartbeatState.connection.last_pong_at > 0);
  const silentSocket = await connectSilentClient(firstAddress.port);
  await waitFor(origin, (state) => state.connected === true, 1000, "silent-client");
  await waitFor(origin, (state) => state.connected === false, 2000, "silent-client");
  silentSocket.destroy();

  const fixedPort = firstAddress.port;
  await gateway.close();
  await writeFile(path.join(gatewayRoot, ".gateway.lock"), `${JSON.stringify({ token: "stale", pid: 2147483647 })}\n`);
  gateway = new ClientFoundationGateway({
    ...gatewayOptions,
    port: fixedPort,
    advertiseOrigin: origin,
  });
  await gateway.start();
  await waitFor(origin, (state) => state.connected === true && state.commands.length === 2);
  const invoke = await api(origin, "POST", "/v1/clients/client-a/commands", {
    message_id: "gw-m3",
    operation: "invoke",
    payload: { value: "after-gateway-restart" },
  });
  assert.equal(invoke.status, 201);
  assert.equal(invoke.value.command.sequence, 3);
  const finalState = await waitFor(origin, (state) => state.commands[2]?.receipt);
  assert.equal(finalState.commands[2].receipt.response.value, "dynamic:after-gateway-restart");
  assert.equal(finalState.next_sequence, 4);
  assert.equal(finalState.commands.filter((command) => command.message_id === "gw-m1").length, 1);

  for (let sequence = 4; sequence <= 13; sequence += 1) {
    const messageId = `gw-m${sequence}`;
    const value = `compact-${sequence}`;
    const queued = await api(origin, "POST", "/v1/clients/client-a/commands", {
      message_id: messageId,
      operation: "invoke",
      payload: { value },
    });
    assert.equal(queued.status, 201);
    await waitFor(origin, (state) => state.commands.some((command) => command.message_id === messageId && command.receipt));
  }
  const compactedState = await waitFor(origin, (state) => state.archives.length === 3 && state.compacted_through_sequence === 10);
  assert.deepEqual(compactedState.commands.map((command) => command.sequence), [11, 12, 13]);
  const archivedDuplicate = await api(origin, "POST", "/v1/clients/client-a/commands", inventoryInput);
  assert.equal(archivedDuplicate.status, 200);
  assert.equal(archivedDuplicate.value.duplicate, true);
  assert.equal(archivedDuplicate.value.command.status, "archived");
  assert.equal(archivedDuplicate.value.command.sequence, 1);
  const reorderedGraphDuplicate = await api(origin, "POST", "/v1/clients/client-a/commands", {
    message_id: "gw-m2",
    operation: "graph.apply",
    payload: { artifact_sha256: artifact.value.sha256, expected_graph_revision: 1 },
  });
  assert.equal(reorderedGraphDuplicate.status, 200);
  assert.equal(reorderedGraphDuplicate.value.command.status, "archived");
  assert.equal(reorderedGraphDuplicate.value.command.sequence, 2);
  const activeReceiptLookup = await api(origin, "GET", "/v1/clients/client-a/commands/gw-m13?wait_ms=100");
  assert.equal(activeReceiptLookup.status, 200);
  assert.equal(activeReceiptLookup.value.command.receipt.response.value, "dynamic:compact-13");
  const archivedReceiptLookup = await api(origin, "GET", "/v1/clients/client-a/commands/gw-m1?wait_ms=100");
  assert.equal(archivedReceiptLookup.status, 200);
  assert.equal(archivedReceiptLookup.value.command.sequence, 1);

  controller.abort();
  await running;
  await foundation.close();
  assert.deepEqual(foundation.boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  const diskState = JSON.parse(await readFile(path.join(gatewayRoot, "state.json"), "utf8"));
  assert.equal(diskState.clients["client-a"].commands.length, 3);
  assert.equal(Object.keys(diskState.clients["client-a"].message_index).length, 3);
  assert.equal(diskState.clients["client-a"].commands.every((command) => command.receipt), true);
  assert.equal(diskState.clients["client-a"].archives.length, 3);
  const archiveMetadata = diskState.clients["client-a"].archives[0];
  const archivePath = path.join(gatewayRoot, "archives", archiveMetadata.path);
  const archiveBytes = await readFile(archivePath);
  assert.equal(sha256(archiveBytes), archiveMetadata.sha256);
  assert.equal(archiveBytes.toString("utf8").trim().split("\n").length, archiveMetadata.commands);
  assert.equal(archiveMetadata.from_sequence, 1);
  assert.equal(archiveMetadata.through_sequence, 6);
  assert.equal((await readdir(path.dirname(archivePath))).filter((name) => name.endsWith(".jsonl")).length, 3);
  const artifactPath = path.join(gatewayRoot, "artifacts", `${artifact.value.sha256}.json`);
  const artifactBytes = await readFile(artifactPath);
  await gateway.close();

  await writeFile(archivePath, Buffer.concat([archiveBytes, Buffer.from("corrupt") ]));
  const archiveRejected = new ClientFoundationGateway(gatewayOptions);
  await assert.rejects(() => archiveRejected.start(), /archive identity mismatch/);
  await archiveRejected.close();
  await writeFile(archivePath, archiveBytes);

  await writeFile(artifactPath, Buffer.concat([artifactBytes, Buffer.from("corrupt") ]));
  const artifactRejected = new ClientFoundationGateway(gatewayOptions);
  await assert.rejects(() => artifactRejected.start(), /stored artifact identity mismatch/);
  await artifactRejected.close();
  await writeFile(artifactPath, artifactBytes);

  const orphanPath = path.join(path.dirname(archivePath), "orphan.jsonl");
  await writeFile(orphanPath, "orphan\n");
  gateway = new ClientFoundationGateway(gatewayOptions);
  await gateway.start();
  await assert.rejects(() => readFile(orphanPath), (error) => error.code === "ENOENT");
  await gateway.close();
  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.client-foundation-gateway-local-qualification/v1",
    lifecycle: "incubating-product-surface-local-qualified-not-lib-admitted",
    artifacts_persistent: Object.keys(diskState.artifacts).length,
    clients_persistent: Object.keys(diskState.clients).length,
    active_commands_persistent: diskState.clients["client-a"].commands.length,
    command_sequences: Array.from({ length: 13 }, (_, index) => index + 1),
    duplicate_enqueue_idempotent: true,
    archived_duplicate_idempotent: true,
    canonical_payload_identity: true,
    bounded_receipt_wait: true,
    single_writer_lock: true,
    stale_lock_recovery: true,
    heartbeat_pongs: heartbeatState.connection.pongs,
    stale_connection_evicted: true,
    compacted_through_sequence: diskState.clients["client-a"].compacted_through_sequence,
    bounded_archive_metadata: diskState.clients["client-a"].archives.length,
    merged_archive_range: [archiveMetadata.from_sequence, archiveMetadata.through_sequence],
    archive_sha256: archiveMetadata.sha256,
    bounded_message_index: Object.keys(diskState.clients["client-a"].message_index).length,
    archive_corruption_rejected: true,
    artifact_corruption_rejected: true,
    repaired_state_restart: true,
    orphan_archive_collected: true,
    gateway_restart_reconnect: true,
    post_restart_invoke: finalState.commands[2].receipt.response.value,
    fixed_host_api_changed: false,
    minimal_cli_changed: false,
  }));
} finally {
  controller.abort();
  await foundation?.close().catch(() => {});
  await gateway.close().catch(() => {});
  await rm(temporaryRoot, { recursive: true, force: true });
}
