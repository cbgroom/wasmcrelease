import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ClientFoundation } from "../runtime/client-foundation-v1/foundation.mjs";
import { ClientFoundationGateway } from "../runtime/client-foundation-gateway-v1/gateway.mjs";

const root = process.cwd();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cert = readFileSync(path.join(root, "scripts/fixtures/ios-wss-cert.pem"));
const key = readFileSync(path.join(root, "scripts/fixtures/ios-wss-key.pem"));
const providerRoot = path.join(root, "runtime/client-foundation-v1/fixtures/dynamic-provider");
const wit = readFileSync(path.join(providerRoot, "lib.wit"));
const baseAdapter = readFileSync(path.join(providerRoot, "native-adapter.mjs"));
const baseDescriptor = JSON.parse(readFileSync(path.join(providerRoot, "native-boundary.json"), "utf8"));
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "wasmc-content-benchmark-"));
const protectedPaths = ["current/cli.mjs", "current/wasmc.mjs", "host/runtime/lib-boundary/reference.mjs"];
const protectedBefore = Object.fromEntries(protectedPaths.map((relative) => [relative, sha256(readFileSync(path.join(root, relative)))]));
const now = () => process.hrtime.bigint();
const ms = (elapsed) => Number(elapsed) / 1e6;
const percentile = (values, fraction) => values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
const summarize = (samples) => {
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    samples: sorted.length,
    min_ms: Number(sorted[0].toFixed(3)),
    p50_ms: Number(percentile(sorted, 0.50).toFixed(3)),
    p95_ms: Number(percentile(sorted, 0.95).toFixed(3)),
    p99_ms: Number(percentile(sorted, 0.99).toFixed(3)),
    max_ms: Number(sorted.at(-1).toFixed(3)),
    mean_ms: Number((sorted.reduce((sum, value) => sum + value, 0) / sorted.length).toFixed(3)),
  };
};

function makeBundle(logicalBytes, nonce) {
  const suffixPrefix = Buffer.from(`\n/*${nonce}:`);
  const suffixEnd = Buffer.from("*/\n");
  const padding = Buffer.alloc(Math.max(0, logicalBytes - baseAdapter.length - suffixPrefix.length - suffixEnd.length), 0x78);
  const adapter = Buffer.concat([baseAdapter, suffixPrefix, padding, suffixEnd]);
  const descriptor = structuredClone(baseDescriptor);
  descriptor.adapter.sha256 = sha256(adapter);
  const descriptorBytes = Buffer.from(`${JSON.stringify(descriptor, null, 2)}\n`);
  const files = [
    ["lib.wit", wit],
    ["native-boundary.json", descriptorBytes],
    ["native-adapter.mjs", adapter],
  ].map(([filePath, bytes]) => ({ path: filePath, sha256: sha256(bytes), base64: bytes.toString("base64") }));
  const bytes = Buffer.from(JSON.stringify({
    schema: "wasmc.client-foundation-bundle/v1",
    identity: descriptor.identity,
    api: "wasmc:client-foundation-block@0.0.1",
    files,
  }));
  return { bytes, logicalBytes: adapter.length, sha256: sha256(bytes) };
}

let agent;
async function request(origin, method, pathname, body = null, parseJson = true) {
  return new Promise((resolve, reject) => {
    const call = https.request(new URL(pathname, origin), {
      method,
      agent,
      headers: body ? { "content-type": "application/json", "content-length": body.length } : {},
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const bytes = Buffer.concat(chunks);
        resolve({ status: response.statusCode, bytes, value: parseJson ? JSON.parse(bytes.toString("utf8")) : null });
      });
    });
    call.on("error", reject);
    if (body) call.write(body);
    call.end();
  });
}

const jsonBody = (value) => Buffer.from(JSON.stringify(value));
async function waitReceipt(origin, messageId) {
  const result = await request(origin, "GET", `/v1/clients/content-client/commands/${messageId}?wait_ms=10000`);
  if (result.status !== 200 || !result.value.command?.receipt) throw new Error("receipt wait failed");
  return result.value.command.receipt;
}

function normalized(samples, totalBytes, elapsedNs) {
  return {
    ...summarize(samples),
    transferred_bytes: totalBytes,
    effective_mib_per_second: Number((totalBytes / 1048576 / (elapsedNs / 1e9)).toFixed(3)),
    ns_per_transferred_byte: Number((elapsedNs / totalBytes).toFixed(2)),
  };
}

let gateway;
let foundation;
const controller = new AbortController();
try {
  gateway = new ClientFoundationGateway({
    dataRoot: path.join(temporaryRoot, "gateway"),
    tlsKey: key,
    tlsCert: cert,
    maxCompletedCommandsPerClient: 256,
  });
  const address = await gateway.start();
  agent = new https.Agent({ keepAlive: true, maxSockets: 1, ca: cert, rejectUnauthorized: true });
  foundation = new ClientFoundation({
    stateRoot: path.join(temporaryRoot, "client"),
    factoryRoot: path.join(root, "runtime/client-foundation-v1/factory-provider"),
    gatewayUrl: `${address.wss_base}/v1/clients/content-client/control`,
    ca: cert,
    reconnectDelayMs: 25,
  });
  const running = foundation.run(controller.signal);
  while (!(await request(address.origin, "GET", "/v1/clients/content-client")).value.connected) await new Promise((resolve) => setImmediate(resolve));

  const sizes = [4096, 262144, 1048576];
  const upload = [];
  const download = [];
  const coordinated = [];
  let nonce = 0;
  for (const logicalBytes of sizes) {
    const uploads = [];
    let uploadBytes = 0;
    const uploadStart = now();
    let retained;
    for (let index = 0; index < 8; index += 1) {
      const bundle = makeBundle(logicalBytes, `upload-${nonce++}`);
      const start = now();
      const response = await request(address.origin, "POST", "/v1/artifacts", bundle.bytes);
      uploads.push(ms(now() - start));
      assert.equal(response.status, 201);
      assert.equal(response.value.sha256, bundle.sha256);
      uploadBytes += bundle.bytes.length;
      retained = { bundle, url: new URL(response.value.url).pathname };
    }
    const uploadElapsed = Number(now() - uploadStart);
    upload.push({ logical_adapter_bytes_each: logicalBytes, bundle_bytes_each: retained.bundle.bytes.length, ...normalized(uploads, uploadBytes, uploadElapsed) });

    const downloads = [];
    let downloadBytes = 0;
    const downloadStart = now();
    for (let index = 0; index < 30; index += 1) {
      const start = now();
      const response = await request(address.origin, "GET", retained.url, null, false);
      downloads.push(ms(now() - start));
      assert.equal(response.status, 200);
      assert.equal(sha256(response.bytes), retained.bundle.sha256);
      downloadBytes += response.bytes.length;
    }
    download.push({ logical_adapter_bytes_each: logicalBytes, bundle_bytes_each: retained.bundle.bytes.length, ...normalized(downloads, downloadBytes, Number(now() - downloadStart)) });

    const activations = [];
    let coordinatedBytes = 0;
    let revision = foundation.snapshot().graph_revision;
    const coordinatedStart = now();
    for (let index = 0; index < 6; index += 1) {
      const bundle = makeBundle(logicalBytes, `activate-${nonce++}`);
      const messageId = `activate-${logicalBytes}-${index}`;
      const start = now();
      const published = await request(address.origin, "POST", "/v1/artifacts", bundle.bytes);
      assert.equal(published.status, 201);
      const queued = await request(address.origin, "POST", "/v1/clients/content-client/commands", jsonBody({
        message_id: messageId,
        operation: "graph.apply",
        payload: { expected_graph_revision: revision, artifact_sha256: published.value.sha256 },
      }));
      assert.equal(queued.status, 201);
      const receipt = await waitReceipt(address.origin, messageId);
      assert.equal(receipt.outcome, "committed");
      revision = receipt.graph_revision;
      activations.push(ms(now() - start));
      coordinatedBytes += bundle.bytes.length;
    }
    coordinated.push({
      logical_adapter_bytes_each: logicalBytes,
      bundle_bytes_each: makeBundle(logicalBytes, "shape").bytes.length,
      final_graph_revision: revision,
      ...normalized(activations, coordinatedBytes, Number(now() - coordinatedStart)),
    });
  }

  controller.abort();
  await running;
  await foundation.close();
  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.client-foundation-content-baseline/v1",
    lifecycle: "local-diagnostic-not-qualification-not-release",
    source_commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    environment: { platform: process.platform, architecture: process.arch, os_release: os.release(), node: process.version, cpu: os.cpus()[0]?.model ?? null },
    topology: "one local Node process, loopback HTTPS plus WSS, repository-local certificate, temporary durable roots",
    https_artifact_publish: upload,
    https_artifact_get_verified: download,
    https_publish_wss_activate_receipt: coordinated,
    fixed_host_api_changed: false,
    minimal_cli_changed: false,
    non_claims: ["public network throughput", "parallel clients", "physical storage durability", "mobile device performance", "raw NIC or DRAM bandwidth"],
    protected_sha256: (() => {
      const after = Object.fromEntries(protectedPaths.map((relative) => [relative, sha256(readFileSync(path.join(root, relative)))]));
      assert.deepEqual(after, protectedBefore);
      return after;
    })(),
  }));
} finally {
  controller.abort();
  await foundation?.close().catch(() => {});
  agent?.destroy();
  await gateway?.close().catch(() => {});
  await rm(temporaryRoot, { recursive: true, force: true });
}
