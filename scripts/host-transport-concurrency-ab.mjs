import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [dedicatedArg, sharedArg, platformId, outputArg] = process.argv.slice(2);
if (!dedicatedArg || !sharedArg || !platformId || !outputArg) {
  throw new Error('usage: node scripts/host-transport-concurrency-ab.mjs DEDICATED SHARED PLATFORM OUTPUT.json');
}
const dedicatedBinary = resolve(dedicatedArg);
const sharedBinary = resolve(sharedArg);
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
const connections = Number(process.env.WASMC_HOST_AB_CONCURRENCY ?? 32);
const iterations = Number(process.env.WASMC_HOST_AB_ITERATIONS ?? 2000);
const pairs = Number(process.env.WASMC_HOST_AB_PAIRS ?? 6);
if (!Number.isInteger(connections) || connections < 2 || connections > 256) throw new Error('invalid concurrency');
if (!Number.isInteger(iterations) || iterations < 1) throw new Error('invalid iterations');
if (!Number.isInteger(pairs) || pairs < 2 || pairs > 20) throw new Error('invalid pairs');

function execute(binary, lane, runIterations = iterations) {
  const started = process.hrtime.bigint();
  const result = spawnSync(binary, [], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 8 << 20,
    env: {
      ...process.env,
      WASMC_HOST_CONCURRENCY: String(connections),
      WASMC_HOST_ITERATIONS: String(runIterations),
    },
  });
  const processWallMs = Number(process.hrtime.bigint() - started) / 1e6;
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(lane + ' failed (' + result.status + '): ' + result.stderr);
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error(lane + ' returned no receipt');
  const receipt = JSON.parse(lines.at(-1));
  const expectedOperations = connections * runIterations * 2;
  assert.equal(receipt.accepted, true, lane);
  assert.equal(receipt.connections, connections, lane);
  assert.equal(receipt.iterations, runIterations, lane);
  assert.equal(receipt.host_operations, expectedOperations, lane + ': operations');
  assert.equal(receipt.host_waits, expectedOperations, lane + ': waits');
  assert.equal(receipt.host_claimed, expectedOperations, lane + ': claims');
  assert.equal(receipt.logical_transfers, expectedOperations, lane + ': logical transfers');
  assert.equal(receipt.host_pending_peak, 1, lane + ': pending peak');
  return { lane, receipt, processWallMs };
}

function sample(run, pair, order) {
  const r = run.receipt;
  return {
    pair,
    order,
    operations_per_sec: r.logical_transfers_per_sec,
    elapsed_ns: r.elapsed_ns,
    process_wall_ms: Number(run.processWallMs.toFixed(3)),
    host_operations: r.host_operations,
    owner_threads_started: r.owner_threads_started,
    owner_cycles: r.owner_cycles,
    reactor_poll_calls: r.reactor_poll_calls,
    reactor_readiness_events: r.reactor_readiness_events,
    control_events_per_operation:
      run.lane === 'dedicated'
        ? r.owner_cycles / r.host_operations
        : r.reactor_poll_calls / r.host_operations,
  };
}

const warmIterations = Math.min(iterations, 500);
execute(dedicatedBinary, 'dedicated-warmup', warmIterations);
execute(sharedBinary, 'shared-warmup', warmIterations);

const dedicatedSamples = [];
const sharedSamples = [];
const pairDeltas = [];
for (let pair = 0; pair < pairs; pair++) {
  const dedicatedFirst = pair % 2 === 0;
  const order = dedicatedFirst
    ? [[dedicatedBinary, 'dedicated'], [sharedBinary, 'shared']]
    : [[sharedBinary, 'shared'], [dedicatedBinary, 'dedicated']];
  const results = {};
  for (let index = 0; index < order.length; index++) {
    const [binary, lane] = order[index];
    const run = execute(binary, lane);
    results[lane] = sample(run, pair, index);
  }
  dedicatedSamples.push(results.dedicated);
  sharedSamples.push(results.shared);
  pairDeltas.push({
    pair,
    order: dedicatedFirst ? 'dedicated-shared' : 'shared-dedicated',
    throughput_ratio: results.shared.operations_per_sec / results.dedicated.operations_per_sec,
    throughput_pct:
      (results.shared.operations_per_sec / results.dedicated.operations_per_sec - 1) * 100,
    elapsed_pct:
      (results.shared.elapsed_ns / results.dedicated.elapsed_ns - 1) * 100,
  });
}
assert.ok(dedicatedSamples.every(row => row.owner_threads_started === connections));
assert.ok(sharedSamples.every(row => row.owner_threads_started === 1));

const binaryInfo = async binary => {
  const bytes = await readFile(binary);
  const info = await stat(binary);
  return { bytes: info.size, sha256: sha256(bytes) };
};
const report = {
  schema: 'wasmc-host-transport-concurrency-ab/v1',
  measured_at: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? null,
  platform: platformId,
  host: { os: process.platform, arch: process.arch, node: process.version },
  workload: {
    connections,
    iterations_per_connection: iterations,
    pairs,
    frame_bytes: 64,
    expected_operations_per_run: connections * iterations * 2,
  },
  binaries: {
    dedicated: await binaryInfo(dedicatedBinary),
    shared: await binaryInfo(sharedBinary),
  },
  policy: {
    semantic_lifecycle_gate: 'hard',
    hosted_timing: 'observational',
    claim_scope: 'Host TCP lifecycle scheduling canary only; not HTTPS product throughput',
  },
  semantic_parity: true,
  topology: {
    dedicated_owner_threads: connections,
    shared_reactor_threads: 1,
  },
  performance: {
    dedicated: {
      operations_per_sec: stats(dedicatedSamples.map(row => row.operations_per_sec)),
      elapsed_ns: stats(dedicatedSamples.map(row => row.elapsed_ns)),
      control_events_per_operation: stats(dedicatedSamples.map(row => row.control_events_per_operation)),
      samples: dedicatedSamples,
    },
    shared: {
      operations_per_sec: stats(sharedSamples.map(row => row.operations_per_sec)),
      elapsed_ns: stats(sharedSamples.map(row => row.elapsed_ns)),
      control_events_per_operation: stats(sharedSamples.map(row => row.control_events_per_operation)),
      samples: sharedSamples,
    },
    paired_delta: {
      throughput_ratio: stats(pairDeltas.map(row => row.throughput_ratio)),
      throughput_pct: stats(pairDeltas.map(row => row.throughput_pct)),
      elapsed_pct: stats(pairDeltas.map(row => row.elapsed_pct)),
      positive_throughput_pairs: pairDeltas.filter(row => row.throughput_pct > 0).length,
      pairs: pairDeltas,
    },
  },
};
await writeFile(resolve(outputArg), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  accepted: true,
  platform: platformId,
  semantic_parity: true,
  connections,
  dedicated_threads: connections,
  shared_threads: 1,
  dedicated_ops_s_p50: report.performance.dedicated.operations_per_sec.p50,
  shared_ops_s_p50: report.performance.shared.operations_per_sec.p50,
  paired_throughput_pct_p50: report.performance.paired_delta.throughput_pct.p50,
  positive_pairs: report.performance.paired_delta.positive_throughput_pairs,
  pairs,
}));
