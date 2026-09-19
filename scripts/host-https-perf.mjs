import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [binaryArg, platformId, outputArg] = process.argv.slice(2);
if (!binaryArg || !platformId || !outputArg) {
  throw new Error('usage: node scripts/host-https-perf.mjs BINARY PLATFORM OUTPUT.json');
}

const root = process.cwd();
const binary = resolve(binaryArg);
const fixtureRoot = resolve('host/tests/https');
const manifestPath = resolve(fixtureRoot, 'artifact-manifest.json');
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const percentile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
};
const stats = values => ({
  samples: values.length,
  p50: Number(percentile(values, 0.50).toFixed(3)),
  p95: Number(percentile(values, 0.95).toFixed(3)),
  min: Number(Math.min(...values).toFixed(3)),
  max: Number(Math.max(...values).toFixed(3)),
});
const exactRps = receipt => {
  const validRequests = Number(receipt.keep_alive_requests) + Number(receipt.recovery_requests);
  return validRequests * 1e9 / Number(receipt.elapsed_ns);
};

for (const item of [...manifest.artifacts, ...manifest.fixtures]) {
  const bytes = await readFile(resolve(item.path));
  assert.equal(sha256(bytes), item.sha256, item.id + ': sha256 drift');
  if (item.bytes !== undefined) assert.equal(bytes.length, item.bytes, item.id + ': byte length drift');
}

const args = [
  resolve(fixtureRoot, 'artifacts/tls-server-direct.wasm'),
  resolve(fixtureRoot, 'artifacts/http1-server.wasm'),
  resolve(fixtureRoot, 'artifacts/json.wasm'),
  resolve(fixtureRoot, 'artifacts/compression.wasm'),
  resolve(fixtureRoot, 'artifacts/router-policy.wasm'),
  resolve(fixtureRoot, 'fixtures/server-cert.der'),
  resolve(fixtureRoot, 'fixtures/server-key.pkcs8.der'),
];

function execute(extraEnv = {}) {
  const started = process.hrtime.bigint();
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 64 << 20,
    env: { ...process.env, ...extraEnv },
  });
  const wallMs = Number(process.hrtime.bigint() - started) / 1e6;
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('HTTPS qualification failed (' + result.status + '): ' + result.stderr);
  }
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error('HTTPS qualification returned no receipt');
  return { receipt: JSON.parse(lines.at(-1)), stderr: result.stderr, wallMs };
}

function assertLifecycle(run, exactKeepAlive = null, requirePartial = false) {
  const { receipt, stderr } = run;
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.https, true);
  assert.equal(receipt.recovery_requests, 1);
  assert.equal(receipt.malformed_requests, 1);
  assert.equal(receipt.graceful_tls_close, true);
  assert.equal(receipt.host_operations, receipt.host_waits);
  assert.equal(receipt.host_operations, receipt.host_claimed);
  assert.equal(receipt.host_write_operations, receipt.tls_commits);
  assert.equal(receipt.host_read_bytes, receipt.ciphertext_in);
  assert.equal(receipt.host_write_bytes, receipt.ciphertext_out);
  assert.ok(receipt.keep_alive_requests > 0);
  if (exactKeepAlive !== null) assert.equal(receipt.keep_alive_requests, exactKeepAlive);
  if (requirePartial) assert.ok(receipt.host_partial_writes > 0);
  assert.equal((stderr.match(/tls-resource-drop-ok/g) ?? []).length, 3);
  assert.equal((stderr.match(/host-transport-close-ack/g) ?? []).length, 3);
  assert.equal(stderr.includes('tls-resource-drop-err'), false);
  assert.equal(stderr.includes('host-transport-close-err'), false);
  assert.equal(stderr.includes('cannot enter component instance'), false);
}

const qualification = execute({
  WASMC_HOST_TRANSPORT_MAX_WRITE: '7',
  WASMC_HTTPS_KEEPALIVE_REQUESTS: '256',
  WASMC_PROFILE_OPERATION_SAMPLE_EVERY: '64',
});
assertLifecycle(qualification, 256, true);

const warmup = execute({
  WASMC_HTTPS_KEEPALIVE_DURATION_MS: '250',
  WASMC_PROFILE_OPERATION_SAMPLE_EVERY: '0',
});
assertLifecycle(warmup);

const performanceRuns = [];
for (let index = 0; index < 5; index++) {
  const run = execute({
    WASMC_HTTPS_KEEPALIVE_DURATION_MS: '1000',
    WASMC_PROFILE_OPERATION_SAMPLE_EVERY: '0',
  });
  assertLifecycle(run);
  performanceRuns.push({
    index,
    rps: exactRps(run.receipt),
    receipt_rps_integer: run.receipt.rps,
    elapsed_ns: Number(run.receipt.elapsed_ns),
    avg_ns_per_valid_request: Number(run.receipt.avg_ns_per_valid_request),
    keep_alive_requests: run.receipt.keep_alive_requests,
    host_operations: run.receipt.host_operations,
    host_waits: run.receipt.host_waits,
    host_claimed: run.receipt.host_claimed,
    host_pending_peak: run.receipt.host_pending_peak,
    host_owner_wake_cycles: run.receipt.host_owner_wake_cycles,
    host_owner_threads_started: run.receipt.host_owner_threads_started,
    process_wall_ms: Number(run.wallMs.toFixed(3)),
  });
}

const operationRows = Array.isArray(qualification.receipt.operation_profile)
  ? qualification.receipt.operation_profile
  : [];
const topOperations = [...operationRows]
  .filter(row => Number(row.sampled_calls) > 0)
  .sort((a, b) => Number(b.wall_ns_sample_mean) - Number(a.wall_ns_sample_mean))
  .slice(0, 5)
  .map(row => ({
    component: row.component,
    operation: row.operation,
    sampled_calls: Number(row.sampled_calls),
    wall_ns_sample_mean: Number(row.wall_ns_sample_mean),
    wall_ns_p95_upper: Number(row.wall_ns_p95_upper),
    fuel_sample_mean: String(row.fuel_sample_mean),
  }));

const binaryBytes = await readFile(binary);
const binaryStat = await stat(binary);
const report = {
  schema: 'wasmc-host-https-performance/v1',
  measured_at: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? null,
  platform: platformId,
  host: { os: process.platform, arch: process.arch, node: process.version },
  binary: { bytes: binaryStat.size, sha256: sha256(binaryBytes) },
  artifact_manifest_sha256: sha256(manifestBytes),
  authority: {
    https_source_commit: manifest.https_source_commit,
    host_transport_baseline_commit: manifest.host_transport_baseline_commit,
  },
  policy: {
    functional_and_identity_gates: 'hard',
    github_hosted_timing: 'observational',
    performance_regression_gate: false,
  },
  qualification: {
    keep_alive_requests: qualification.receipt.keep_alive_requests,
    recovery_requests: qualification.receipt.recovery_requests,
    malformed_requests: qualification.receipt.malformed_requests,
    graceful_tls_close: qualification.receipt.graceful_tls_close,
    host_operations: qualification.receipt.host_operations,
    host_waits: qualification.receipt.host_waits,
    host_claimed: qualification.receipt.host_claimed,
    host_partial_writes: qualification.receipt.host_partial_writes,
    host_pending_peak: qualification.receipt.host_pending_peak,
    host_pending_issued: qualification.receipt.host_pending_issued,
    host_owner_wake_cycles: qualification.receipt.host_owner_wake_cycles,
    host_owner_threads_started: qualification.receipt.host_owner_threads_started,
    host_read_operations: qualification.receipt.host_read_operations,
    host_write_operations: qualification.receipt.host_write_operations,
    host_read_bytes: qualification.receipt.host_read_bytes,
    host_write_bytes: qualification.receipt.host_write_bytes,
    host_timeouts: qualification.receipt.host_timeouts,
    host_cancellations: qualification.receipt.host_cancellations,
    host_backpressure_rejections: qualification.receipt.host_backpressure_rejections,
    tls_commits: qualification.receipt.tls_commits,
    fuel_total: qualification.receipt.fuel_total,
    checksum: qualification.receipt.checksum,
    operation_profile: operationRows,
  },
  performance: {
    warmup: {
      rps: warmup.receipt.rps,
      keep_alive_requests: warmup.receipt.keep_alive_requests,
      process_wall_ms: Number(warmup.wallMs.toFixed(3)),
    },
    samples: performanceRuns,
    summary: {
      rps: stats(performanceRuns.map(row => row.rps)),
      avg_ns_per_valid_request: stats(performanceRuns.map(row => row.avg_ns_per_valid_request)),
      process_wall_ms: stats(performanceRuns.map(row => row.process_wall_ms)),
    },
  },
  learning: {
    top_guest_operations_by_sampled_wall_mean: topOperations,
    dominant_guest_operation: topOperations[0] ?? null,
    host_lifecycle_diagnostic: {
      owner_wake_cycles: qualification.receipt.host_owner_wake_cycles,
      host_operations: qualification.receipt.host_operations,
      owner_wake_cycles_per_host_operation:
        Number((qualification.receipt.host_owner_wake_cycles / qualification.receipt.host_operations).toFixed(6)),
      interpretation:
        'Diagnostic only. A high wake/operation ratio can motivate Host scheduling profiling but does not by itself prove root cause.',
    },
    interpretation: 'Use with platform history and same-workload evidence; do not infer an SLA from one hosted runner.',
  },
};
await writeFile(resolve(outputArg), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  accepted: true,
  platform: platformId,
  rps_p50: report.performance.summary.rps.p50,
  latency_ns_p50: report.performance.summary.avg_ns_per_valid_request.p50,
  dominant_operation: report.learning.dominant_guest_operation?.operation ?? null,
}));
