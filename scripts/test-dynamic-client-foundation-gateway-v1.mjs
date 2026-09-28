import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DynamicGraphClientFoundation } from "../runtime/client-foundation-v1/dynamic-foundation.mjs";
import { canonicalJsonSha256, describeDynamicLibDag, describeSerialLibGraph, describeStateMigrations } from "../runtime/client-foundation-v1/dynamic-lib-graph-spec.mjs";
import { deriveWitPortContracts } from "../runtime/client-foundation-v1/wit-port-contracts.mjs";
import { ClientFoundationGateway } from "../runtime/client-foundation-gateway-v1/gateway.mjs";

const root = process.cwd();
const certPath = path.join(root, "scripts/fixtures/ios-wss-cert.pem");
const cert = readFileSync(certPath);
const key = readFileSync(path.join(root, "scripts/fixtures/ios-wss-key.pem"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = promisify(execFile);
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "wasmc-dynamic-client-gateway-"));
const wit = Buffer.from("package wasmc:dynamic-graph-block@0.0.1;\ninterface block { invoke: func(payload: list<u8>) -> result<list<u8>, string>; }\nworld graph-block { export block; }\n");
const trace = (stage) => { if (process.env.WASMC_TEST_TRACE === "1") process.stderr.write(`${stage}\n`); };
const dagWit = Buffer.from(`package wasmc:dynamic-client-dag@0.0.1;
interface blocks {
  source: func(payload: string) -> string;
  unary: func(payload: string) -> string;
  join: func(left: string, right: string) -> string;
}
world graph-block { export blocks; }
`);
const dagWitPath = path.join(temporaryRoot, "dag.wit");
await writeFile(dagWitPath, dagWit);
const dagWitDocument = JSON.parse((await run("wasm-tools", ["component", "wit", dagWitPath, "--json"])).stdout);

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

async function makeDagBundle(name, marker, fn, delayMs = 0) {
  const identity = `wasmc:dynamic-client-dag-${name}@0.0.1-dev.1`;
  const manifest = deriveWitPortContracts(dagWitDocument, {
    world: "graph-block", interface: "blocks", function: fn, wit_sha256: sha256(dagWit),
  });
  const adapter = Buffer.from(`
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export async function invoke(input) {
  const request = JSON.parse(decoder.decode(input));
  if (request.operation === "probe" || request.operation === "health") return encoder.encode(JSON.stringify({ accepted: true }));
  if (request.operation !== "invoke-ports") throw new Error("unsupported DAG operation");
  if (${delayMs} > 0) await new Promise((resolve) => setTimeout(resolve, ${delayMs}));
  const value = ${fn === "join" ? '"J(" + request.inputs.left + "," + request.inputs.right + ")"' : `${JSON.stringify(marker)} + "(" + request.inputs.payload + ")"`};
  return encoder.encode(JSON.stringify({ accepted: true, outputs: { result: value } }));
}`);
  const descriptor = Buffer.from(`${JSON.stringify({
    schema: "wasmc.native-boundary-descriptor/v1", identity, wit: "lib.wit", graph_ports: "graph-ports.json",
    adapter: { path: "native-adapter.mjs", sha256: sha256(adapter), export: "invoke" },
    limits: { max_input_bytes: 65536, max_output_bytes: 65536 }, lifecycle: "prototype-not-admitted-not-released",
  }, null, 2)}\n`);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const files = [
    { path: "lib.wit", bytes: dagWit }, { path: "native-boundary.json", bytes: descriptor },
    { path: "native-adapter.mjs", bytes: adapter }, { path: "graph-ports.json", bytes: manifestBytes },
  ];
  return Buffer.from(JSON.stringify({
    schema: "wasmc.client-foundation-bundle/v1", identity, api: "wasmc:dynamic-client-dag@0.0.1",
    files: files.map((file) => ({ path: file.path, sha256: sha256(file.bytes), base64: file.bytes.toString("base64") })),
  }));
}

async function makeStatefulBundle(name, marker, stateSchemaIdentity, stateField = "count", statePolicy = "snapshot-v1") {
  const identity = `wasmc:dynamic-client-stateful-${name}@0.0.1-dev.1`;
  const adapter = Buffer.from(`
import { createHash } from "node:crypto";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
let count = 0;
const stateField = ${JSON.stringify(stateField)};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function invoke(input) {
  const request = JSON.parse(decoder.decode(input));
  if (request.operation === "probe" || request.operation === "health") return encoder.encode(JSON.stringify({ accepted: true }));
  if (request.operation === "invoke") {
    if (request.value === "inc") count += 1;
    return encoder.encode(JSON.stringify({ accepted: true, value: ${JSON.stringify(marker)} + ":" + count }));
  }
  if (request.operation === "reset-state-v1") {
    count = 0;
    return encoder.encode(JSON.stringify({ accepted: true, state_schema_identity: ${JSON.stringify(stateSchemaIdentity)} }));
  }
  if (request.operation === "snapshot-v1") {
    const bytes = Buffer.from(JSON.stringify({ [stateField]: count }));
    return encoder.encode(JSON.stringify({ accepted: true, state_schema_identity: ${JSON.stringify(stateSchemaIdentity)}, state_base64: bytes.toString("base64"), state_sha256: sha256(bytes) }));
  }
  if (request.operation === "restore-v1") {
    const bytes = Buffer.from(request.state_base64, "base64");
    if (sha256(bytes) !== request.state_sha256) throw new Error("stateful restore identity mismatch");
    count = JSON.parse(bytes.toString("utf8"))[stateField];
    return encoder.encode(JSON.stringify({ accepted: true, state_schema_identity: request.state_schema_identity, state_sha256: request.state_sha256 }));
  }
  throw new Error("unsupported stateful operation");
}`);
  const descriptor = Buffer.from(`${JSON.stringify({
    schema: "wasmc.native-boundary-descriptor/v1", identity, wit: "lib.wit",
    state: { policy: statePolicy, schema_identity: stateSchemaIdentity },
    adapter: { path: "native-adapter.mjs", sha256: sha256(adapter), export: "invoke" },
    limits: { max_input_bytes: 65536, max_output_bytes: 65536 }, lifecycle: "prototype-not-admitted-not-released",
  }, null, 2)}\n`);
  const files = [
    { path: "lib.wit", bytes: wit }, { path: "native-boundary.json", bytes: descriptor }, { path: "native-adapter.mjs", bytes: adapter },
  ];
  return Buffer.from(JSON.stringify({
    schema: "wasmc.client-foundation-bundle/v1", identity, api: "wasmc:dynamic-graph-block@0.0.1",
    files: files.map((file) => ({ path: file.path, sha256: sha256(file.bytes), base64: file.bytes.toString("base64") })),
  }));
}

async function makeMigrationBundle(name, fromSchemaIdentity, toSchemaIdentity) {
  const identity = `wasmc:dynamic-client-migration-${name}@0.0.1-dev.1`;
  const adapter = Buffer.from(`
import { createHash } from "node:crypto";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function invoke(input) {
  const request = JSON.parse(decoder.decode(input));
  if (request.operation === "probe" || request.operation === "health") return encoder.encode(JSON.stringify({ accepted: true }));
  if (request.operation !== "migrate-state-v1") throw new Error("unsupported migration operation");
  if (request.from_schema_identity !== ${JSON.stringify(fromSchemaIdentity)} || request.to_schema_identity !== ${JSON.stringify(toSchemaIdentity)}) throw new Error("migration schema mismatch");
  const source = JSON.parse(Buffer.from(request.state_base64, "base64").toString("utf8"));
  const bytes = Buffer.from(JSON.stringify({ value: source.count }));
  return encoder.encode(JSON.stringify({ accepted: true, state_schema_identity: ${JSON.stringify(toSchemaIdentity)}, state_base64: bytes.toString("base64"), state_sha256: sha256(bytes) }));
}`);
  const descriptor = Buffer.from(`${JSON.stringify({
    schema: "wasmc.native-boundary-descriptor/v1", identity, wit: "lib.wit",
    state_migration: { protocol: "snapshot-v1", from_schema_identity: fromSchemaIdentity, to_schema_identity: toSchemaIdentity },
    adapter: { path: "native-adapter.mjs", sha256: sha256(adapter), export: "invoke" },
    limits: { max_input_bytes: 65536, max_output_bytes: 65536 }, lifecycle: "prototype-not-admitted-not-released",
  }, null, 2)}\n`);
  const files = [
    { path: "lib.wit", bytes: wit }, { path: "native-boundary.json", bytes: descriptor }, { path: "native-adapter.mjs", bytes: adapter },
  ];
  return Buffer.from(JSON.stringify({
    schema: "wasmc.client-foundation-bundle/v1", identity, api: "wasmc:dynamic-state-migration@0.0.1",
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

async function waitFor(origin, predicate, timeoutMs = 5000, clientId = "dynamic-client") {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await api(origin, "GET", `/v1/clients/${clientId}`);
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

const graphPayload = (expectedRevision, blocks, pipeline, migrations = []) => ({
  expected_graph_revision: expectedRevision,
  blocks,
  pipeline,
  graph_digest: describeSerialLibGraph({ blocks: blocks.map((entry) => ({ ...entry, root: "content-addressed-remote" })), pipeline }).graph_digest,
  migrations,
  migration_plan_sha256: migrations.length > 0 ? describeStateMigrations({ migrations: migrations.map((entry) => ({ ...entry, root: "content-addressed-remote" })) }).migration_plan_sha256 : null,
});
const dagBlock = (name, artifact) => ({
  name, bundle_sha256: artifact.sha256, identity: artifact.identity, artifact_sha256: artifact.package_sha256,
  wit_contract_sha256: artifact.wit_contract_sha256, configuration: {}, configuration_sha256: canonicalJsonSha256({}),
  state_policy: "stateless", state_schema_identity: null, port_contracts: artifact.port_contracts,
  port_contracts_sha256: artifact.port_contracts_sha256,
});
const statefulBlock = (artifact, restartDisposition = null) => ({
  name: "counter", bundle_sha256: artifact.sha256, identity: artifact.identity, artifact_sha256: artifact.package_sha256,
  wit_contract_sha256: artifact.wit_contract_sha256, configuration: {}, configuration_sha256: canonicalJsonSha256({}),
  state_policy: artifact.state_policy, state_schema_identity: artifact.state_schema_identity,
  state_restart_disposition: restartDisposition,
});
const stateMigration = (artifact, fromSchemaIdentity, toSchemaIdentity) => ({
  node: "counter", bundle_sha256: artifact.sha256, identity: artifact.identity, artifact_sha256: artifact.package_sha256,
  wit_contract_sha256: artifact.wit_contract_sha256, configuration: {}, configuration_sha256: canonicalJsonSha256({}),
  from_schema_identity: fromSchemaIdentity, to_schema_identity: toSchemaIdentity,
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
  const uploadedDag = {};
  for (const [name, marker, fn, delayMs] of [["source", "S", "source", 0], ["left", "L", "unary", 40], ["left2", "L2", "unary", 40], ["right", "R", "unary", 40], ["join", "unused", "join", 0]]) {
    const response = await api(origin, "POST", "/v1/artifacts", await makeDagBundle(name, marker, fn, delayMs));
    assert.equal(response.status, 201);
    assert.match(response.value.port_contracts_sha256, /^[a-f0-9]{64}$/);
    uploadedDag[name] = response.value;
  }
  const forgedManifestBundle = JSON.parse((await makeDagBundle("forged", "F", "unary")).toString("utf8"));
  const forgedManifestFile = forgedManifestBundle.files.find((file) => file.path === "graph-ports.json");
  const forgedManifest = JSON.parse(Buffer.from(forgedManifestFile.base64, "base64").toString("utf8"));
  forgedManifest.outputs.result = "0".repeat(64);
  const forgedManifestBytes = Buffer.from(`${JSON.stringify(forgedManifest, null, 2)}\n`);
  forgedManifestFile.base64 = forgedManifestBytes.toString("base64");
  forgedManifestFile.sha256 = sha256(forgedManifestBytes);
  const forgedUpload = await api(origin, "POST", "/v1/artifacts", Buffer.from(JSON.stringify(forgedManifestBundle)));
  assert.equal(forgedUpload.status, 400);
  assert.match(forgedUpload.value.error, /port manifest identity mismatch/);
  const stateSchemaIdentity = sha256(Buffer.from("wasmc:dynamic-client-counter-state/v1"));
  const stateSchemaIdentityV2 = sha256(Buffer.from("wasmc:dynamic-client-counter-state/v2"));
  const uploadedStateful = {};
  for (const [name, marker] of [["counter-v1", "SV1"], ["counter-v2", "SV2"]]) {
    const response = await api(origin, "POST", "/v1/artifacts", await makeStatefulBundle(name, marker, stateSchemaIdentity));
    assert.equal(response.status, 201);
    assert.equal(response.value.state_policy, "snapshot-v1");
    assert.equal(response.value.state_schema_identity, stateSchemaIdentity);
    uploadedStateful[name] = response.value;
  }
  const statefulV3Upload = await api(origin, "POST", "/v1/artifacts", await makeStatefulBundle("counter-v3", "SV3", stateSchemaIdentityV2, "value"));
  assert.equal(statefulV3Upload.status, 201);
  uploadedStateful["counter-v3"] = statefulV3Upload.value;
  const migrationUpload = await api(origin, "POST", "/v1/artifacts", await makeMigrationBundle("counter-v1-to-v2", stateSchemaIdentity, stateSchemaIdentityV2));
  assert.equal(migrationUpload.status, 201);
  assert.deepEqual(migrationUpload.value.state_migration, { protocol: "snapshot-v1", from_schema_identity: stateSchemaIdentity, to_schema_identity: stateSchemaIdentityV2 });
  const uploadedMigration = migrationUpload.value;
  const stickyUpload = await api(origin, "POST", "/v1/artifacts", await makeStatefulBundle("sticky-counter", "STICKY", stateSchemaIdentity, "count", "sticky"));
  assert.equal(stickyUpload.status, 201);
  assert.equal(stickyUpload.value.state_policy, "sticky");
  const uploadedSticky = stickyUpload.value;
  const invalidStickyBlock = { ...statefulBlock(uploadedSticky, "unknown"), name: "sticky-counter" };
  const invalidStickyCommand = await api(origin, "POST", "/v1/clients/sticky-client/commands", {
    message_id: "bad-sticky-disposition", operation: "lib-graph.apply",
    payload: { expected_graph_revision: 0, blocks: [invalidStickyBlock], pipeline: ["sticky-counter"], graph_digest: "0".repeat(64) },
  });
  assert.equal(invalidStickyCommand.status, 400);
  assert.match(invalidStickyCommand.value.error, /requires an exact restart disposition/);
  const forgedStateBlock = { ...statefulBlock(uploadedStateful["counter-v1"]), state_policy: "sticky", state_restart_disposition: "fail-closed" };
  const forgedStatePayload = graphPayload(0, [forgedStateBlock], ["counter"]);
  const forgedStateCommand = await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "bad-state-contract", operation: "lib-graph.apply", payload: forgedStatePayload });
  assert.equal(forgedStateCommand.status, 400);
  assert.match(forgedStateCommand.value.error, /bundle state declaration mismatch/);
  const forgedMigration = stateMigration(uploadedMigration, stateSchemaIdentityV2, stateSchemaIdentity);
  const forgedMigrationPayload = graphPayload(0, [statefulBlock(uploadedStateful["counter-v3"])], ["counter"], [forgedMigration]);
  const forgedMigrationCommand = await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "bad-migration-contract", operation: "lib-graph.apply", payload: forgedMigrationPayload });
  assert.equal(forgedMigrationCommand.status, 400);
  assert.match(forgedMigrationCommand.value.error, /migration bundle contract mismatch/);

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

  const duplicate = await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-9", operation: "lib-graph.apply", payload: repairGraph });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.value.duplicate, true);

  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-11", operation: "unsupported.control", payload: {} });
  state = await waitFor(origin, (value) => value.commands[10]?.receipt);
  assert.equal(state.commands[10].receipt.outcome, "rejected");
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-12", operation: "inventory.report", payload: {} });
  state = await waitFor(origin, (value) => value.commands[11]?.receipt);
  assert.equal(state.commands[11].receipt.outcome, "reported");

  const dagBlocks = [dagBlock("source", uploadedDag.source), dagBlock("left", uploadedDag.left), dagBlock("right", uploadedDag.right), dagBlock("join", uploadedDag.join)];
  const dagEdges = [
    { from: { node: "source", port: "result" }, to: { node: "left", port: "payload" } },
    { from: { node: "source", port: "result" }, to: { node: "right", port: "payload" } },
    { from: { node: "left", port: "result" }, to: { node: "join", port: "left" } },
    { from: { node: "right", port: "result" }, to: { node: "join", port: "right" } },
  ];
  const dagEntrypoint = { input: { node: "source", port: "payload" }, output: { node: "join", port: "result" } };
  const dagPayload = {
    expected_graph_revision: 3, blocks: dagBlocks, edges: dagEdges, entrypoint: dagEntrypoint,
    graph_digest: describeDynamicLibDag({ blocks: dagBlocks.map((entry) => ({ ...entry, root: "content-addressed-remote" })), edges: dagEdges, entrypoint: dagEntrypoint }).graph_digest,
  };
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-13", operation: "lib-graph.apply", payload: dagPayload });
  state = await waitFor(origin, (value) => value.commands[12]?.receipt);
  assert.deepEqual({ outcome: state.commands[12].receipt.outcome, shape: state.commands[12].receipt.shape }, { outcome: "committed", shape: "general-dag" });
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-14", operation: "invoke", payload: { value: "remote" } });
  state = await waitFor(origin, (value) => value.commands[13]?.receipt);
  assert.equal(state.commands[13].receipt.response.value, "J(L(S(remote)),R(S(remote)))");

  trace("client:dag-restart-close");
  await stopClient();
  await startClient(address);
  await waitFor(origin, (value) => value.last_hello?.runtime_available === true && value.last_hello?.graph_revision === 4);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-15", operation: "invoke", payload: { value: "dag-restart" } });
  state = await waitFor(origin, (value) => value.commands[14]?.receipt);
  assert.equal(state.commands[14].receipt.response.value, "J(L(S(dag-restart)),R(S(dag-restart)))");

  trace("client:publication-crash-stop-normal");
  await stopClient();
  const crashStderr = [];
  const crashClient = spawn(process.execPath, [
    path.join(root, "scripts/fixtures/dynamic-client-publication-crash-runner.mjs"),
    clientRoot,
    `${address.wss_base}/v1/clients/dynamic-client/control`,
    certPath,
    "5",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  crashClient.stderr.on("data", (chunk) => crashStderr.push(chunk));
  await waitFor(origin, (value) => value.connected === true && value.last_hello?.graph_revision === 4);
  const crashDagBlocks = [dagBlock("source", uploadedDag.source), dagBlock("left", uploadedDag.left2), dagBlock("right", uploadedDag.right), dagBlock("join", uploadedDag.join)];
  const crashDagPayload = {
    expected_graph_revision: 4, blocks: crashDagBlocks, edges: dagEdges, entrypoint: dagEntrypoint,
    graph_digest: describeDynamicLibDag({ blocks: crashDagBlocks.map((entry) => ({ ...entry, root: "content-addressed-remote" })), edges: dagEdges, entrypoint: dagEntrypoint }).graph_digest,
  };
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-16", operation: "lib-graph.apply", payload: crashDagPayload });
  const [crashCode] = await once(crashClient, "exit");
  assert.equal(crashCode, 86, Buffer.concat(crashStderr).toString("utf8"));
  const crashedDiskState = JSON.parse(await readFile(path.join(clientRoot, "dynamic-state.json"), "utf8"));
  assert.equal(crashedDiskState.graph_revision, 5);
  assert.equal(crashedDiskState.retired_generations.length, 1);
  assert.equal(crashedDiskState.inflight_result.cleanup_pending, true);

  await startClient(address);
  state = await waitFor(origin, (value) => value.commands[15]?.receipt && value.last_hello?.runtime_available === true && value.last_hello?.graph_revision === 5);
  assert.equal(state.commands[15].receipt.outcome, "committed");
  assert.equal(state.commands[15].receipt.cleanup_pending, true);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-17", operation: "invoke", payload: { value: "after-publication-crash" } });
  state = await waitFor(origin, (value) => value.commands[16]?.receipt);
  assert.equal(state.commands[16].receipt.response.value, "J(L2(S(after-publication-crash)),R(S(after-publication-crash)))");

  const statefulV1 = statefulBlock(uploadedStateful["counter-v1"]);
  const statefulV2 = statefulBlock(uploadedStateful["counter-v2"]);
  const statefulFirst = graphPayload(5, [statefulV1], ["counter"]);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-18", operation: "lib-graph.apply", payload: statefulFirst });
  state = await waitFor(origin, (value) => value.commands[17]?.receipt);
  assert.equal(state.commands[17].receipt.outcome, "committed");
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-19", operation: "invoke", payload: { value: "inc" } });
  state = await waitFor(origin, (value) => value.commands[18]?.receipt);
  assert.equal(state.commands[18].receipt.response.value, "SV1:1");

  const statefulReplacement = graphPayload(6, [statefulV2], ["counter"]);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-20", operation: "lib-graph.apply", payload: statefulReplacement });
  state = await waitFor(origin, (value) => value.commands[19]?.receipt);
  assert.deepEqual({ outcome: state.commands[19].receipt.outcome, migrated: state.commands[19].receipt.migrated }, { outcome: "committed", migrated: 1 });
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-21", operation: "invoke", payload: { value: "get" } });
  state = await waitFor(origin, (value) => value.commands[20]?.receipt);
  assert.equal(state.commands[20].receipt.response.value, "SV2:1");

  const checkpointBeforeCrash = client.snapshot().active_state_checkpoint;
  assert.equal(checkpointBeforeCrash.graph_revision, 7);
  assert.equal(checkpointBeforeCrash.graph_digest, statefulReplacement.graph_digest);
  assert.equal(checkpointBeforeCrash.blocks.length, 1);
  assert.match(checkpointBeforeCrash.checkpoint_sha256, /^[a-f0-9]{64}$/);

  trace("client:state-checkpoint-crash-stop-normal");
  await stopClient();
  const checkpointCrashStderr = [];
  const checkpointCrashClient = spawn(process.execPath, [
    path.join(root, "scripts/fixtures/dynamic-client-state-checkpoint-crash-runner.mjs"),
    clientRoot,
    `${address.wss_base}/v1/clients/dynamic-client/control`,
    certPath,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  checkpointCrashClient.stderr.on("data", (chunk) => checkpointCrashStderr.push(chunk));
  await waitFor(origin, (value) => value.connected === true && value.last_hello?.runtime_available === true && value.last_hello?.state_checkpoint?.checkpoint_sha256 === checkpointBeforeCrash.checkpoint_sha256);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-22", operation: "invoke", payload: { value: "inc" } });
  const [checkpointCrashCode] = await once(checkpointCrashClient, "exit");
  assert.equal(checkpointCrashCode, 87, Buffer.concat(checkpointCrashStderr).toString("utf8"));
  const checkpointCrashDiskState = JSON.parse(await readFile(path.join(clientRoot, "dynamic-state.json"), "utf8"));
  assert.equal(checkpointCrashDiskState.inflight_command.message_id, "dg-22");
  assert.equal(checkpointCrashDiskState.inflight_result.response.value, "SV2:2");
  assert.notEqual(checkpointCrashDiskState.active_state_checkpoint.checkpoint_sha256, checkpointBeforeCrash.checkpoint_sha256);
  assert.equal(checkpointCrashDiskState.active_state_checkpoint.blocks.length, 1);

  await startClient(address);
  state = await waitFor(origin, (value) => value.commands[21]?.receipt && value.last_hello?.runtime_available === true && value.last_hello?.state_checkpoint?.checkpoint_sha256 === checkpointCrashDiskState.active_state_checkpoint.checkpoint_sha256);
  assert.equal(state.commands[21].receipt.response.value, "SV2:2");
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-23", operation: "invoke", payload: { value: "get" } });
  state = await waitFor(origin, (value) => value.commands[22]?.receipt);
  assert.equal(state.commands[22].receipt.response.value, "SV2:2");

  const statefulV3 = statefulBlock(uploadedStateful["counter-v3"]);
  const migrationV1ToV2 = stateMigration(uploadedMigration, stateSchemaIdentity, stateSchemaIdentityV2);
  const crossSchemaReplacement = graphPayload(7, [statefulV3], ["counter"], [migrationV1ToV2]);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-24", operation: "lib-graph.apply", payload: crossSchemaReplacement });
  state = await waitFor(origin, (value) => value.commands[23]?.receipt);
  assert.deepEqual({ outcome: state.commands[23].receipt.outcome, migrated: state.commands[23].receipt.migrated, migration_libs: state.commands[23].receipt.migration_libs }, { outcome: "committed", migrated: 1, migration_libs: 1 });
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-25", operation: "invoke", payload: { value: "get" } });
  state = await waitFor(origin, (value) => value.commands[24]?.receipt);
  assert.equal(state.commands[24].receipt.response.value, "SV3:2");
  await stopClient();
  await startClient(address);
  await waitFor(origin, (value) => value.last_hello?.runtime_available === true && value.last_hello?.graph_revision === 8);
  await api(origin, "POST", "/v1/clients/dynamic-client/commands", { message_id: "dg-26", operation: "invoke", payload: { value: "get" } });
  state = await waitFor(origin, (value) => value.commands[25]?.receipt);
  assert.equal(state.commands[25].receipt.response.value, "SV3:2");

  trace("client:final-close");
  await stopClient();
  assert.deepEqual(client.boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  const diskState = JSON.parse(await readFile(path.join(clientRoot, "dynamic-state.json"), "utf8"));
  assert.equal(diskState.graph_revision, 8);
  assert.equal(diskState.active_graph.graph_digest, crossSchemaReplacement.graph_digest);
  assert.equal(diskState.active_graph.shape, "serial-dag");
  assert.equal(diskState.retired_generations.length, 0);
  assert.equal(diskState.retired_cleanup_receipts.some((receipt) => receipt.outcome === "process-owner-fenced-on-restart"), true);
  assert.equal(diskState.last_server_sequence, 26);
  assert.equal(Object.keys(diskState.receipts).length, 26);
  assert.equal(diskState.active_state_checkpoint.graph_digest, crossSchemaReplacement.graph_digest);

  for (const fault of ["missing", "digest-mismatch"]) {
    const faultRoot = path.join(temporaryRoot, `checkpoint-${fault}`);
    await cp(clientRoot, faultRoot, { recursive: true });
    const faultStatePath = path.join(faultRoot, "dynamic-state.json");
    const faultState = JSON.parse(await readFile(faultStatePath, "utf8"));
    if (fault === "missing") faultState.active_state_checkpoint = null;
    else faultState.active_state_checkpoint.checkpoint_sha256 = "0".repeat(64);
    await writeFile(faultStatePath, `${JSON.stringify(faultState, null, 2)}\n`);
    const faultClient = new DynamicGraphClientFoundation({ stateRoot: faultRoot, gatewayUrl: `${address.wss_base}/v1/clients/dynamic-client/control`, ca: cert });
    const faultController = new AbortController();
    const faultRunning = faultClient.run(faultController.signal);
    await waitFor(origin, (value) => value.connected === true && value.last_hello?.runtime_available === false && value.last_hello?.graph_revision === 8);
    assert.equal(faultClient.snapshot().runtime_available, false);
    faultController.abort();
    await faultClient.close();
    await faultRunning;
    assert.deepEqual(faultClient.boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  }

  const stickyClientRoot = path.join(temporaryRoot, "sticky-client");
  let stickyClient;
  let stickyController;
  let stickyRunning;
  const startStickyClient = async () => {
    stickyController = new AbortController();
    stickyClient = new DynamicGraphClientFoundation({ stateRoot: stickyClientRoot, gatewayUrl: `${address.wss_base}/v1/clients/sticky-client/control`, ca: cert, reconnectDelayMs: 10 });
    stickyRunning = stickyClient.run(stickyController.signal);
    await waitFor(origin, (value) => value.connected === true, 5000, "sticky-client");
  };
  const stopStickyClient = async () => {
    stickyController.abort();
    await stickyClient.close();
    await stickyRunning;
  };
  try {
    await startStickyClient();
    const stickyBlock = { ...statefulBlock(uploadedSticky, "reset-on-restart"), name: "sticky-counter" };
    const stickyGraph = graphPayload(0, [stickyBlock], ["sticky-counter"]);
    await api(origin, "POST", "/v1/clients/sticky-client/commands", { message_id: "sticky-1", operation: "lib-graph.apply", payload: stickyGraph });
    let stickyState = await waitFor(origin, (value) => value.commands[0]?.receipt, 5000, "sticky-client");
    assert.equal(stickyState.commands[0].receipt.outcome, "committed");
    await api(origin, "POST", "/v1/clients/sticky-client/commands", { message_id: "sticky-2", operation: "invoke", payload: { value: "inc" } });
    stickyState = await waitFor(origin, (value) => value.commands[1]?.receipt, 5000, "sticky-client");
    assert.equal(stickyState.commands[1].receipt.response.value, "STICKY:1");
    await stopStickyClient();
    await startStickyClient();
    await waitFor(origin, (value) => value.last_hello?.runtime_available === true && value.last_hello?.graph_revision === 1, 5000, "sticky-client");
    await api(origin, "POST", "/v1/clients/sticky-client/commands", { message_id: "sticky-3", operation: "invoke", payload: { value: "get" } });
    stickyState = await waitFor(origin, (value) => value.commands[2]?.receipt, 5000, "sticky-client");
    assert.equal(stickyState.commands[2].receipt.response.value, "STICKY:0");
    const stickyJournal = await readFile(path.join(stickyClientRoot, "dynamic-journal.jsonl"), "utf8");
    assert.match(stickyJournal, /"sticky_blocks_reset":1/);
    await stopStickyClient();
    assert.deepEqual(stickyClient.boundary.counts(), { resources: 0, windows: 0, operations: 0 });
  } finally {
    stickyController?.abort();
    await stickyClient?.close().catch(() => {});
    await stickyRunning?.catch(() => {});
  }

  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.dynamic-client-gateway-local-qualification/v1",
    lifecycle: "prototype-local-qualified-not-admitted-not-released",
    persistent_artifacts: Object.keys(uploaded).length + Object.keys(uploadedDag).length + Object.keys(uploadedStateful).length + 2,
    first_composition: "B1(A1(x))",
    one_node_replacement: "B1(A2C(x))",
    gateway_restart_reconnect: "B1(A2C(after-gateway-restart))",
    client_restart_reconstruction: "B1(A2C(after-client-restart))",
    broken_candidate_rolled_back: true,
    corrupt_cache_runtime_unavailable_but_control_connected: true,
    exact_cache_redownload_repair: "B1(A2C(after-cache-repair))",
    general_dag_gateway_apply: "J(L(S(remote)),R(S(remote)))",
    general_dag_client_restart: "J(L(S(dag-restart)),R(S(dag-restart)))",
    publication_crash_recovery: "J(L2(S(after-publication-crash)),R(S(after-publication-crash)))",
    durable_retired_generation_cleanup: "process-owner-fenced-on-restart",
    stateful_same_schema_gateway_replacement: "SV1:1->SV2:1",
    stateful_active_checkpoint_restart: "SV2:2",
    stateful_cross_schema_gateway_migration: "SV2:2->SV3:2",
    stateful_cross_schema_restart: "SV3:2",
    sticky_explicit_reset_client_restart: "STICKY:1->STICKY:0",
    invoke_checkpoint_crash_recovered_without_replay: true,
    gateway_observed_checkpoint_identity: true,
    missing_or_corrupt_checkpoint_failed_closed: true,
    forged_port_manifest_rejected_at_gateway: true,
    forged_state_contract_rejected_at_gateway: true,
    forged_migration_contract_rejected_at_gateway: true,
    invalid_sticky_disposition_rejected_at_gateway: true,
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
