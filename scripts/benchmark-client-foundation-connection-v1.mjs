import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ClientFoundation } from "../runtime/client-foundation-v1/foundation.mjs";
import { ClientFoundationGateway } from "../runtime/client-foundation-gateway-v1/gateway.mjs";
import { connectWss } from "../runtime/client-foundation-v1/wss-transport.mjs";

const root = process.cwd();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cert = readFileSync(path.join(root, "scripts/fixtures/ios-wss-cert.pem"));
const key = readFileSync(path.join(root, "scripts/fixtures/ios-wss-key.pem"));
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "wasmc-connection-benchmark-"));
const protectedPaths = ["current/cli.mjs", "current/wasmc.mjs", "host/runtime/lib-boundary/reference.mjs"];
const protectedBefore = Object.fromEntries(protectedPaths.map((relative) => [relative, sha256(readFileSync(path.join(root, relative)))]));
const now = () => process.hrtime.bigint();
const milliseconds = (elapsed) => Number(elapsed) / 1e6;
const percentile = (sorted, fraction) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
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
const immediate = () => new Promise((resolve) => setImmediate(resolve));

let pollRequests = 0;
let agent;
async function api(origin, method, pathname, body = null) {
  const bytes = body === null ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const request = https.request(new URL(pathname, origin), {
      method,
      agent,
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

async function waitReceipt(origin, messageId) {
  pollRequests += 1;
  const result = await api(origin, "GET", `/v1/clients/bench-client/commands/${encodeURIComponent(messageId)}?wait_ms=5000`);
  if (result.status !== 200 || !result.value.command?.receipt) throw new Error(`receipt wait failed: ${JSON.stringify(result.value)}`);
  return result.value.command.receipt;
}

async function measureCommands(origin, { label, payloadBytes, samples }) {
  const payload = "x".repeat(payloadBytes);
  const latencies = [];
  const startGroup = now();
  for (let index = 0; index < samples; index += 1) {
    const messageId = `${label}-${index}`;
    const start = now();
    const queued = await api(origin, "POST", "/v1/clients/bench-client/commands", {
      message_id: messageId,
      operation: "invoke",
      payload: { value: payload },
    });
    if (queued.status !== 201) throw new Error(`enqueue failed: ${JSON.stringify(queued.value)}`);
    const receipt = await waitReceipt(origin, messageId);
    if (receipt.response.value !== `factory:${payload}`) throw new Error("receipt payload mismatch");
    latencies.push(milliseconds(now() - start));
  }
  const elapsedNs = Number(now() - startGroup);
  const logicalBytes = payloadBytes * samples;
  return {
    label,
    logical_payload_bytes_each: payloadBytes,
    ...summarize(latencies),
    commands_per_second: Number((samples / (elapsedNs / 1e9)).toFixed(2)),
    logical_payload_mib_per_second: Number((logicalBytes / 1048576 / (elapsedNs / 1e9)).toFixed(3)),
    logical_ns_per_payload_byte: logicalBytes === 0 ? null : Number((elapsedNs / logicalBytes).toFixed(2)),
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
    maxCompletedCommandsPerClient: 8,
    maxArchiveSegmentsPerClient: 4,
  });
  const address = await gateway.start();
  agent = new https.Agent({ keepAlive: true, maxSockets: 1, ca: cert, rejectUnauthorized: true });

  for (let index = 0; index < 8; index += 1) {
    const connection = await connectWss(`${address.wss_base}/v1/clients/handshake/control`, { ca: cert });
    const closed = once(connection, "close");
    connection.close();
    await closed;
  }
  const handshakes = [];
  for (let index = 0; index < 64; index += 1) {
    const start = now();
    const connection = await connectWss(`${address.wss_base}/v1/clients/handshake/control`, { ca: cert });
    handshakes.push(milliseconds(now() - start));
    const closed = once(connection, "close");
    connection.close();
    await closed;
  }

  foundation = new ClientFoundation({
    stateRoot: path.join(temporaryRoot, "client"),
    factoryRoot: path.join(root, "runtime/client-foundation-v1/factory-provider"),
    gatewayUrl: `${address.wss_base}/v1/clients/bench-client/control`,
    ca: cert,
    reconnectDelayMs: 25,
  });
  const running = foundation.run(controller.signal);
  while (!(await api(address.origin, "GET", "/v1/clients/bench-client")).value.connected) await immediate();

  for (let index = 0; index < 8; index += 1) {
    const messageId = `warm-${index}`;
    await api(address.origin, "POST", "/v1/clients/bench-client/commands", {
      message_id: messageId,
      operation: "invoke",
      payload: { value: "warm" },
    });
    await waitReceipt(address.origin, messageId);
  }
  pollRequests = 0;
  const commandCases = [];
  for (const specification of [
    { label: "empty", payloadBytes: 0, samples: 40 },
    { label: "1kib", payloadBytes: 1024, samples: 40 },
    { label: "32kib", payloadBytes: 32768, samples: 40 },
  ]) commandCases.push(await measureCommands(address.origin, specification));

  controller.abort();
  await running;
  await foundation.close();
  agent.destroy();
  console.log(JSON.stringify({
    accepted: true,
    schema: "wasmc.client-foundation-connection-baseline/v1",
    lifecycle: "local-diagnostic-not-qualification-not-release",
    source_commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    environment: {
      platform: process.platform,
      architecture: process.arch,
      os_release: os.release(),
      node: process.version,
      cpu: os.cpus()[0]?.model ?? null,
    },
    topology: "one local Node process, loopback TLS/WSS, repository-local certificate, temporary state root",
    fresh_tls_wss_upgrade: summarize(handshakes),
    durable_command_round_trip: commandCases,
    management_poll_requests: pollRequests,
    fixed_host_api_changed: false,
    minimal_cli_changed: false,
    non_claims: [
      "public network latency or throughput",
      "multi-client concurrency",
      "multi-process or clustered storage",
      "physical mobile device performance",
      "raw network bandwidth or DRAM utilization",
    ],
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
