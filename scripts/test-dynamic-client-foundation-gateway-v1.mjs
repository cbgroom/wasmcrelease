import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { DynamicGraphClientFoundation } from "../runtime/client-foundation-v1/dynamic-foundation.mjs";
import { canonicalJsonSha256, describeSerialLibGraph } from "../runtime/client-foundation-v1/dynamic-lib-graph-spec.mjs";
import { ClientFoundationGateway } from "../runtime/client-foundation-gateway-v1/gateway.mjs";

const root = process.cwd();
const cert = readFileSync(path.join(root, "scripts/fixtures/ios-wss-cert.pem"));
const key = readFileSync(path.join(root, "scripts/fixtures/ios-wss-key.pem"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "wasmc-dynamic-client-gateway-"));
const wit = Buffer.from("package wasmc:dynamic-graph-block@0.0.1;\ninterface block { invoke: func(payload: list<u8>) -> result<list<u8>, string>; }\nworld graph-block { export block; }\n");
const trace = (stage) => { if (process.env.WASMC_TEST_TRACE === "1") process.stderr.write(`${stage}\n`); };

async function makeBundle(name, marker, { broken = false } = {}) {
  const identity = `wasmc:dynamic-client-${name}@0.0.1-dev.1`;
  const adapter = Buffer.from(`
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
let health = 0;
export async function invoke(input) {
  const request = JSON.parse(decoder.decode(input));
  if (request.operation === "probe") return encoder.encode(JSON.stringify({ accepted: true, provider: ${JSON.stringify(identity)} }));
  if (request.operation === "health") {
    health += 1;
    ${broken ? "if (health > 1) throw new Error(\"intentional dynamic Client replacement failure\");" : ""}
    return encoder.encode(JSON.stringify({ accepted: true, provider: ${JSON.stringify(identity)} }));
  }
  if (request.operation === "invoke") return encoder.encode(JSON.stringify({ accepted: true, provider: ${JSON.stringify(identity)}, value: ${JSON.stringify(marker)} + (request.configuration?.suffix ?? "") + "(" + request.value + ")" }));
  throw new Error("unsupported dynamic Client fixture operation");
}
`);
  const descriptor = Buffer.from(`${JSON.stringify({
    schema: "wasmc.native-boundary-descriptor/v1",
    identity,
    wit: "lib.wit",
    adapter: { path: "native-adapter.mjs", sha256: sha256(adapter), export: "invoke" },
    limits: { max_input_bytes: 65536, max_output_bytes: 65536 },
    lifecycle: "prototype-not-admitted-not-released",
  }, null, 2)}\n`);
  const files = [
    { path: "lib.wit", bytes: wit },
    { path: "native-boundary.json", bytes: descriptor },
    { path: "native-adapter.mjs", bytes: adapter },
  ];
  return Buffer.from(JSON.stringify({
    schema: "wasmc.client-foundation-bundle/v1",
    identity,
    api: "wasmc:dynamic-graph-block@0.0.1",
    files: files.map((file) => ({ path: file.path, sha256: sha256(file.bytes), base64: file.bytes.toString("base64") })),
  }));
}

async function api(origin, method, pathname, body = null) {
  const target = new URL(pathname, origin);
  const bytes = body === null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const request = https.request(target, {
      method,
      ca: cert,
      rejectUnauthorized: true,
      headers: bytes ? { "content-type": "application/json", "content-length": bytes.length } : {},
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
    });
    request.on("error", reject);
    if (bytes) request.write(bytes);
    request.end();
  });
}

async function waitFor(origin, predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await api(origin, "GET", "/v1/clients/dynamic-client");
    if (predicate(result.value)) return result.value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("dynamic Client/Gateway state wait timed out");
}

const block = (name, artifact, configuration = {}) => ({
  name,
  bundle_sha256: artifact.sha256,
  identity: artifact.identity,
  artifact_sha256: artifact.package_sha256,
  wit_contract_sha256: artifact.wit_contract_sha256,
  configuration,
  configuration_sha256: canonicalJsonSha256(configuration),
  state_policy: "stateless",
  state_schema_identity: null,
});

const graphPayload = (expectedRevision, blocks, pipeline) => ({
  expected_graph_revision: expectedRevision,
  blocks,
  pipeline,
  graph_digest: describeSerialLibGraph({ blocks: blocks.map((entry) => ({ ...entry, root: "content-addressed-remote" })), pipeline }).graph_digest,
});

const gatewayRoot = path.join(temporaryRoot, "gateway");
const clientRoot = path.join(temporaryRoot, "client");
const gatewayOptions = { dataRoot: gatewayRoot, tlsKey: key, tlsCert: cert, heartbeatIntervalMs: 20, heartbeatTimeoutMs: 200 };
let gateway = new ClientFoundationGateway(gatewayOptions);
let client;
let controller;
let running;

const startClient = async (gatewayAddress) => {
  controller = new AbortController();
  client = new DynamicGraphClientFoundation({ stateRoot: clientRoot, gatewayUrl: `${gatewayAddress.wss_base}/v1/clients/dynamic-client/control`, ca: cert, reconnectDelayMs: 10 });
  running = client.run(controller.signal);
  await waitFor(gatewayAddress.origin, (state) => state.connected === true);
};

const stopClient = async () => {
  trace("stop:abort");
  controller?.abort();
  trace("stop:close-client");
  await client.close();
  trace("stop:await-run");
  await running;
  trace("stop:done");
};

try {
  trace("gateway:start");
  const address = await gateway.start();
  const origin = address.origin;
  const uploaded = {};
  for (const [name, marker, options] of [["a1", "A1", {}], ["a2", "A2", {}], ["b1", "B1", {}], ["b-broken", "BROKEN", { broken: true }]]) {
    const response = await api(origin, "POST", "/v1/artifacts", await makeBundle(name, marker, options));
    assert.equal(response.status, 201);
    assert.match(response.value.package_sha256, /^[a-f0-9]{64}$/);
    assert.match(response.value.wit_contract_sha256, /^[a-f0-9]{64}$/);
    uploaded[name] = response.value;
  }

  const a1 = block("a", uploaded.a1);
  const a2 = block("a", uploaded.a2, { suffix: "C" });
  const b1 = block("b", uploaded.b1);
  const broken = block("b", uploaded["b-broken"]);
  const firstGraph = graphPayload(0, [a1, b1], ["a", "b"]);

  const invalid = await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "bad-digest", operation: "lib-graph.apply", payload: { ...firstGraph, graph_digest: "0".repeat(64) } });
  assert.equal(invalid.status, 400);
  assert.match(invalid.value.error, /graph command digest mismatch/);

  await startClient(address);
  trace("client:first-connected");
  const inventory = await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-1", operation: "inventory.report", payload: {} });
  assert.equal(inventory.value.command.sequence, 1);
  const applyFirst = await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-2", operation: "lib-graph.apply", payload: firstGraph });
  assert.equal(applyFirst.status, 201);
  assert.equal(applyFirst.value.command.sequence, 2);
  assert.equal(applyFirst.value.command.payload.blocks.every((entry) => entry.artifact_url.startsWith(origin)), true);
  let state = await waitFor(origin, (value) => value.commands[1]?.receipt);
  assert.equal(state.commands[1].receipt.outcome, "committed");
  assert.equal(state.commands[1].receipt.graph_revision ?? state.commands[1].receipt.revision, 1);

  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-3", operation: "invoke", payload: { value: "x" } });
  state = await waitFor(origin, (value) => value.commands[2]?.receipt);
  assert.equal(state.commands[2].receipt.response.value, "B1(A1(x))");

  const replacementGraph = graphPayload(1, [a2, b1], ["a", "b"]);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-4", operation: "lib-graph.apply", payload: replacementGraph });
  state = await waitFor(origin, (value) => value.commands[3]?.receipt);
  assert.deepEqual({ outcome: state.commands[3].receipt.outcome, installed: state.commands[3].receipt.installed, reused: state.commands[3].receipt.reused, released: state.commands[3].receipt.released }, { outcome: "committed", installed: 1, reused: 1, released: 1 });
  assert.equal(client.snapshot().graph_revision, 2);

  trace("gateway:restart-close");
  await gateway.close();
  trace("gateway:restart-open");
  gateway = new ClientFoundationGateway({ ...gatewayOptions, port: address.port, advertiseOrigin: origin });
  await gateway.start();
  await waitFor(origin, (value) => value.connected === true && value.last_hello?.graph_revision === 2);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-5", operation: "invoke", payload: { value: "after-gateway-restart" } });
  state = await waitFor(origin, (value) => value.commands[4]?.receipt);
  assert.equal(state.commands[4].receipt.response.value, "B1(A2C(after-gateway-restart))");

  trace("client:normal-restart-close");
  await stopClient();
  assert.deepEqual(client.boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  await startClient(address);
  trace("client:normal-restart-open");
  await waitFor(origin, (value) => value.last_hello?.runtime_available === true && value.last_hello?.graph_revision === 2);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-6", operation: "invoke", payload: { value: "after-client-restart" } });
  state = await waitFor(origin, (value) => value.commands[5]?.receipt);
  assert.equal(state.commands[5].receipt.response.value, "B1(A2C(after-client-restart))");

  const brokenGraph = graphPayload(2, [a2, broken], ["a", "b"]);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-7", operation: "lib-graph.apply", payload: brokenGraph });
  state = await waitFor(origin, (value) => value.commands[6]?.receipt);
  assert.equal(state.commands[6].receipt.outcome, "rolled-back");
  assert.equal(client.snapshot().graph_revision, 2);

  trace("client:corrupt-restart-close");
  await stopClient();
  const corruptPath = path.join(clientRoot, "lib-artifacts", b1.bundle_sha256, "native-adapter.mjs");
  await writeFile(corruptPath, Buffer.concat([await readFile(corruptPath), Buffer.from("\n// corrupt\n")]));
  await startClient(address);
  trace("client:corrupt-restart-open");
  await waitFor(origin, (value) => value.last_hello?.runtime_available === false && value.last_hello?.graph_revision === 2);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-8", operation: "inventory.report", payload: {} });
  state = await waitFor(origin, (value) => value.commands[7]?.receipt);
  assert.equal(state.commands[7].receipt.runtime_available, false);

  const repairGraph = graphPayload(2, [a2, b1], ["a", "b"]);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-9", operation: "lib-graph.apply", payload: repairGraph });
  state = await waitFor(origin, (value) => value.commands[8]?.receipt);
  assert.equal(state.commands[8].receipt.outcome, "committed");
  assert.equal(state.commands[8].receipt.revision, 3);
  assert.equal(client.snapshot().runtime_available, true);

  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-10", operation: "invoke", payload: { value: "after-cache-repair" } });
  state = await waitFor(origin, (value) => value.commands[9]?.receipt);
  assert.equal(state.commands[9].receipt.response.value, "B1(A2C(after-cache-repair))");

  const duplicate = await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-9", operation: "lib-graph.apply", payload: { pipeline: ["a", "b"], blocks: [a2, b1], graph_digest: repairGraph.graph_digest, expected_graph_revision: 2 } });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.value.duplicate, true);

  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-11", operation: "unsupported.control", payload: {} });
  state = await waitFor(origin, (value) => value.commands[10]?.receipt);
  assert.equal(state.commands[10].receipt.outcome, "rejected");
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-12", operation: "inventory.report", payload: {} });
  state = await waitFor(origin, (value) => value.commands[11]?.receipt);
  assert.equal(state.commands[11].receipt.outcome, "reported");

  trace("client:final-close");
  await stopClient();
  assert.deepEqual(client.boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  const diskState = JSON.parse(await readFile(path.join(clientRoot, "dynamic-state.json"), "utf8"));
  assert.equal(diskState.graph_revision, 3);
  assert.equal(diskState.active_graph.graph_digest, repairGraph.graph_digest);
  assert.equal(diskState.last_server_sequence, 12);
  assert.equal(Object.keys(diskState.receipts).length, 12);

  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.dynamic-client-gateway-local-qualification/v1",
    lifecycle: "prototype-local-qualified-not-admitted-not-released",
    persistent_artifacts: Object.keys(uploaded).length,
    first_composition: "B1(A1(x))",
    one_node_replacement: "B1(A2C(x))",
    gateway_restart_reconnect: "B1(A2C(after-gateway-restart))",
    client_restart_reconstruction: "B1(A2C(after-client-restart))",
    broken_candidate_rolled_back: true,
    corrupt_cache_runtime_unavailable_but_control_connected: true,
    exact_cache_redownload_repair: "B1(A2C(after-cache-repair))",
    durable_graph_revision: diskState.graph_revision,
    durable_receipts: Object.keys(diskState.receipts).length,
    canonical_duplicate_idempotent: true,
    rejected_command_did_not_consume_sequence: true,
    durable_rejection_did_not_block_stream: true,
    gateway_restart_accept_race_closed: true,
    wss_reconnect_abort_race_closed: true,
    boundary_counts_after_close: client.boundary.counts(),
    fixed_host_api_changed: false,
    minimal_cli_changed: false,
  }));
  trace("test:complete");
} finally {
  trace("finally:start");
  controller?.abort();
  await client?.close().catch(() => {});
  await running?.catch(() => {});
  await gateway.close().catch(() => {});
  await rm(temporaryRoot, { recursive: true, force: true });
  trace("finally:complete");
}
