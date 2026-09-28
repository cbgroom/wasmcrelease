import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { ClientFoundation } from "../runtime/client-foundation-v1/foundation.mjs";
import { ClientFoundationGateway } from "../runtime/client-foundation-gateway-v1/gateway.mjs";

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

async function waitFor(origin, predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await api(origin, "GET", "/v1/clients/client-a");
    if (predicate(result.value)) return result.value;
    await wait(25);
  }
  throw new Error("gateway state wait timed out");
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "wasmc-foundation-gateway-"));
const gatewayRoot = path.join(temporaryRoot, "gateway");
const clientRoot = path.join(temporaryRoot, "client");
let gateway = new ClientFoundationGateway({ dataRoot: gatewayRoot, tlsKey: key, tlsCert: cert });
let foundation;
const controller = new AbortController();

try {
  const firstAddress = await gateway.start();
  const origin = firstAddress.origin;
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

  const fixedPort = firstAddress.port;
  await gateway.close();
  gateway = new ClientFoundationGateway({
    dataRoot: gatewayRoot,
    tlsKey: key,
    tlsCert: cert,
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

  controller.abort();
  await running;
  await foundation.close();
  assert.deepEqual(foundation.boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  const diskState = JSON.parse(await readFile(path.join(gatewayRoot, "state.json"), "utf8"));
  assert.equal(diskState.clients["client-a"].commands.length, 3);
  assert.equal(diskState.clients["client-a"].commands.every((command) => command.receipt), true);
  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.client-foundation-gateway-local-qualification/v1",
    lifecycle: "prototype-local-qualified-not-admitted-not-released",
    artifacts_persistent: Object.keys(diskState.artifacts).length,
    clients_persistent: Object.keys(diskState.clients).length,
    commands_persistent: diskState.clients["client-a"].commands.length,
    command_sequences: diskState.clients["client-a"].commands.map((command) => command.sequence),
    duplicate_enqueue_idempotent: true,
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
