import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [baselineArg, candidateArg, platformId, outputArg] = process.argv.slice(2);
if (!baselineArg || !candidateArg || !platformId || !outputArg) {
  throw new Error('usage: node scripts/host-https-ab.mjs BASELINE CANDIDATE PLATFORM OUTPUT.json');
}

const root = process.cwd();
const baselineBinary = resolve(baselineArg);
const candidateBinary = resolve(candidateArg);
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
  const valid = Number(receipt.keep_alive_requests) + Number(receipt.recovery_requests);
  return valid * 1e9 / Number(receipt.elapsed_ns);
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

function execute(binary, lane, extraEnv = {}) {
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
    throw new Error(lane + ' HTTPS run failed (' + result.status + '): ' + result.stderr);
  }
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error(lane + ' returned no receipt');
  return { lane, receipt: JSON.parse(lines.at(-1)), stderr: result.stderr, wallMs };
}

function assertLifecycle(run, exactKeepAlive = null, requirePartial = false) {
  const r = run.receipt;
  assert.equal(r.accepted, true, run.lane);
  assert.equal(r.https, true, run.lane);
  assert.equal(r.recovery_requests, 1, run.lane);
  assert.equal(r.malformed_requests, 1, run.lane);
  assert.equal(r.graceful_tls_close, true, run.lane);
  assert.equal(r.host_operations, r.host_waits, run.lane + ': issue/wait');
  assert.equal(r.host_operations, r.host_claimed, run.lane + ': issue/claim');
  assert.equal(r.host_write_operations, r.tls_commits, run.lane + ': writes/commits');
  assert.equal(r.host_read_bytes, r.ciphertext_in, run.lane + ': read bytes');
  assert.equal(r.host_write_bytes, r.ciphertext_out, run.lane + ': write bytes');
  assert.ok(r.keep_alive_requests > 0, run.lane);
  if (exactKeepAlive !== null) assert.equal(r.keep_alive_requests, exactKeepAlive, run.lane);
  if (requirePartial) assert.ok(r.host_partial_writes > 0, run.lane);
  assert.equal((run.stderr.match(/tls-resource-drop-ok/g) ?? []).length, 3, run.lane);
  assert.equal((run.stderr.match(/host-transport-close-ack/g) ?? []).length, 3, run.lane);
  assert.equal(run.stderr.includes('tls-resource-drop-err'), false, run.lane);
  assert.equal(run.stderr.includes('host-transport-close-err'), false, run.lane);
  assert.equal(run.stderr.includes('cannot enter component instance'), false, run.lane);
}

function topOperations(receipt) {
  return [...(Array.isArray(receipt.operation_profile) ? receipt.operation_profile : [])]
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
}

function sample(run, pair, order) {
  const r = run.receipt;
  return {
    pair,
    order,
    rps: exactRps(r),
    elapsed_ns: Number(r.elapsed_ns),
    avg_ns_per_valid_request: Number(r.avg_ns_per_valid_request),
    keep_alive_requests: r.keep_alive_requests,
    host_operations: r.host_operations,
    host_waits: r.host_waits,
    host_claimed: r.host_claimed,
    host_pending_peak: r.host_pending_peak,
    host_owner_wake_cycles: r.host_owner_wake_cycles,
    host_reactor_poll_calls: r.host_reactor_poll_calls ?? 0,
    host_reactor_readiness_events: r.host_reactor_readiness_events ?? 0,
    process_wall_ms: Number(run.wallMs.toFixed(3)),
  };
}

const qualificationEnv = {
  WASMC_HOST_TRANSPORT_MAX_WRITE: '7',
  WASMC_HTTPS_KEEPALIVE_REQUESTS: '256',
  WASMC_PROFILE_OPERATION_SAMPLE_EVERY: '64',
};
const baselineQualification = execute(baselineBinary, 'baseline', qualificationEnv);
const candidateQualification = execute(candidateBinary, 'candidate', qualificationEnv);
assertLifecycle(baselineQualification, 256, true);
assertLifecycle(candidateQualification, 256, true);
for (const key of ['keep_alive_requests', 'recovery_requests', 'malformed_requests', 'checksum']) {
  assert.equal(candidateQualification.receipt[key], baselineQualification.receipt[key], 'A/B semantic parity: ' + key);
}

for (const [binary, lane] of [[baselineBinary, 'baseline-warmup'], [candidateBinary, 'candidate-warmup']]) {
  const run = execute(binary, lane, {
    WASMC_HTTPS_KEEPALIVE_DURATION_MS: '250',
    WASMC_PROFILE_OPERATION_SAMPLE_EVERY: '0',
  });
  assertLifecycle(run);
}

const baselineSamples = [];
const candidateSamples = [];
const pairDeltas = [];
const pairs = 6;
for (let pair = 0; pair < pairs; pair++) {
  const baselineFirst = pair % 2 === 0;
  const order = baselineFirst
    ? [[baselineBinary, 'baseline'], [candidateBinary, 'candidate']]
    : [[candidateBinary, 'candidate'], [baselineBinary, 'baseline']];
  const results = {};
  for (let index = 0; index < order.length; index++) {
    const [binary, lane] = order[index];
    const run = execute(binary, lane, {
      WASMC_HTTPS_KEEPALIVE_DURATION_MS: '1000',
      WASMC_PROFILE_OPERATION_SAMPLE_EVERY: '0',
    });
    assertLifecycle(run);
    results[lane] = sample(run, pair, index);
  }
  baselineSamples.push(results.baseline);
  candidateSamples.push(results.candidate);
  pairDeltas.push({
    pair,
    order: baselineFirst ? 'baseline-candidate' : 'candidate-baseline',
    rps_ratio: results.candidate.rps / results.baseline.rps,
    rps_pct: (results.candidate.rps / results.baseline.rps - 1) * 100,
    avg_ns_per_valid_request_pct:
      (results.candidate.avg_ns_per_valid_request / results.baseline.avg_ns_per_valid_request - 1) * 100,
  });
}

const binaryInfo = async path => {
  const bytes = await readFile(path);
  const info = await stat(path);
  return { bytes: info.size, sha256: sha256(bytes) };
};
const baselineTop = topOperations(baselineQualification.receipt);
const candidateTop = topOperations(candidateQualification.receipt);
const bq = baselineQualification.receipt;
const cq = candidateQualification.receipt;

const report = {
  schema: 'wasmc-host-https-ab/v1',
  measured_at: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? null,
  platform: platformId,
  host: { os: process.platform, arch: process.arch, node: process.version },
  authority: {
    https_source_commit: manifest.https_source_commit,
    host_transport_baseline_commit: manifest.host_transport_baseline_commit,
    reactor_candidate_commit: manifest.reactor_candidate_commit ?? null,
    reactor_candidate_readiness_sha256: manifest.reactor_candidate_readiness_sha256 ?? null,
    reactor_candidate_adapter_sha256: manifest.reactor_candidate_adapter_sha256 ?? null,
  },
  artifact_manifest_sha256: sha256(manifestBytes),
  binaries: {
    baseline: await binaryInfo(baselineBinary),
    candidate: await binaryInfo(candidateBinary),
  },
  policy: {
    functional_and_identity_gates: 'hard',
    semantic_parity_gates: ['keep_alive_requests', 'recovery_requests', 'malformed_requests', 'checksum'],
    github_hosted_timing: 'observational',
    performance_regression_gate: false,
    only_transport_implementation_changes: true,
  },
  qualification: {
    baseline: {
      host_operations: bq.host_operations,
      host_waits: bq.host_waits,
      host_claimed: bq.host_claimed,
      host_partial_writes: bq.host_partial_writes,
      host_pending_peak: bq.host_pending_peak,
      owner_wake_cycles: bq.host_owner_wake_cycles,
      owner_threads_started: bq.host_owner_threads_started,
      reactor_poll_calls: bq.host_reactor_poll_calls ?? 0,
      reactor_readiness_events: bq.host_reactor_readiness_events ?? 0,
      checksum: bq.checksum,
      fuel_total: bq.fuel_total,
      dominant_guest_operation: baselineTop[0] ?? null,
      top_guest_operations: baselineTop,
    },
    candidate: {
      host_operations: cq.host_operations,
      host_waits: cq.host_waits,
      host_claimed: cq.host_claimed,
      host_partial_writes: cq.host_partial_writes,
      host_pending_peak: cq.host_pending_peak,
      owner_wake_cycles: cq.host_owner_wake_cycles,
      owner_threads_started: cq.host_owner_threads_started,
      reactor_poll_calls: cq.host_reactor_poll_calls ?? 0,
      reactor_readiness_events: cq.host_reactor_readiness_events ?? 0,
      checksum: cq.checksum,
      fuel_total: cq.fuel_total,
      dominant_guest_operation: candidateTop[0] ?? null,
      top_guest_operations: candidateTop,
    },
    semantic_parity: true,
  },
  scheduling_diagnostics: {
    baseline: {
      polling_owner_cycles_per_host_operation:
        Number((bq.host_owner_wake_cycles / bq.host_operations).toFixed(6)),
    },
    candidate: {
      reactor_polls_per_host_operation:
        Number(((cq.host_reactor_poll_calls ?? 0) / cq.host_operations).toFixed(6)),
      reactor_readiness_events_per_host_operation:
        Number(((cq.host_reactor_readiness_events ?? 0) / cq.host_operations).toFixed(6)),
    },
    interpretation:
      'Polling owner cycles and reactor poll calls are different counters. The mechanism comparison is scheduling strategy, not raw counter subtraction.',
  },
  performance: {
    pairs,
    samples: { baseline: baselineSamples, candidate: candidateSamples },
    summary: {
      baseline: {
        rps: stats(baselineSamples.map(row => row.rps)),
        avg_ns_per_valid_request: stats(baselineSamples.map(row => row.avg_ns_per_valid_request)),
        process_wall_ms: stats(baselineSamples.map(row => row.process_wall_ms)),
      },
      candidate: {
        rps: stats(candidateSamples.map(row => row.rps)),
        avg_ns_per_valid_request: stats(candidateSamples.map(row => row.avg_ns_per_valid_request)),
        process_wall_ms: stats(candidateSamples.map(row => row.process_wall_ms)),
      },
      paired_delta: {
        rps_ratio: stats(pairDeltas.map(row => row.rps_ratio)),
        rps_pct: stats(pairDeltas.map(row => row.rps_pct)),
        avg_ns_per_valid_request_pct: stats(pairDeltas.map(row => row.avg_ns_per_valid_request_pct)),
      },
    },
    pair_deltas: pairDeltas,
  },
  interpretation: {
    accepted: true,
    mechanism:
      'The baseline uses a 1 ms polling/retry owner. The candidate uses one process-level mio shared reactor with command wake coalescing and activity coalescing from accepted private authority.',
    non_claims: [
      'GitHub-hosted timing is not an SLA.',
      'This single-connection HTTPS corpus is not the same as the private c32 throughput benchmark.',
      'A large A/B delta does not by itself establish production service throughput.',
      'No Host ABI, Lib artifact, TLS/HTTP/JSON/compression/router semantic, retry, or socket-custody rule is changed.',
    ],
  },
};
await writeFile(resolve(outputArg), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  accepted: true,
  platform: platformId,
  baseline_rps_p50: report.performance.summary.baseline.rps.p50,
  candidate_rps_p50: report.performance.summary.candidate.rps.p50,
  paired_rps_ratio_p50: report.performance.summary.paired_delta.rps_ratio.p50,
  paired_rps_pct_p50: report.performance.summary.paired_delta.rps_pct.p50,
  baseline_owner_cycles_per_op:
    report.scheduling_diagnostics.baseline.polling_owner_cycles_per_host_operation,
  candidate_reactor_polls_per_op:
    report.scheduling_diagnostics.candidate.reactor_polls_per_host_operation,
}));
