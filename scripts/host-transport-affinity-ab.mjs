import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [sharedArg, platformId, sweepArg, outputArg] = process.argv.slice(2);
if (!sharedArg || !platformId || !sweepArg || !outputArg) {
  throw new Error('usage: node scripts/host-transport-affinity-ab.mjs SHARED PLATFORM SWEEP.json OUTPUT.json');
}
const binary = resolve(sharedArg);
const sweep = JSON.parse(await readFile(resolve(sweepArg), 'utf8'));
assert.equal(sweep.schema, 'wasmc-host-transport-shard-sweep/v1');
assert.equal(sweep.semantic_parity, true);
const shards = Number(sweep.best.shards);
const connections = Number(process.env.WASMC_HOST_AFFINITY_CONCURRENCY ?? 32);
const iterations = Number(process.env.WASMC_HOST_AFFINITY_ITERATIONS ?? 2000);
const pairs = Number(process.env.WASMC_HOST_AFFINITY_PAIRS ?? 6);
assert.ok(Number.isInteger(shards) && shards >= 1 && shards <= 64);
assert.ok(Number.isInteger(connections) && connections >= 2 && connections <= 256);
assert.ok(Number.isInteger(iterations) && iterations >= 1);
assert.ok(Number.isInteger(pairs) && pairs >= 2 && pairs <= 20);

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

function execute(affinity, runIterations = iterations) {
  const started = process.hrtime.bigint();
  const result = spawnSync(binary, [], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 8 << 20,
    env: {
      ...process.env,
      WASMC_HOST_REACTOR_SHARDS: String(shards),
      WASMC_HOST_REACTOR_AFFINITY: affinity ? '1' : '0',
      WASMC_HOST_CONCURRENCY: String(connections),
      WASMC_HOST_ITERATIONS: String(runIterations),
    },
  });
  const processWallMs = Number(process.hrtime.bigint() - started) / 1e6;
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((affinity ? 'affinity' : 'free') + ' failed: ' + result.stderr);
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  const receipt = JSON.parse(lines.at(-1));
  const expected = connections * runIterations * 2;
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.host_operations, expected);
  assert.equal(receipt.host_waits, expected);
  assert.equal(receipt.host_claimed, expected);
  assert.equal(receipt.host_pending_peak, 1);
  assert.equal(receipt.owner_threads_started, shards);
  if (affinity) {
    assert.equal(receipt.placement_requested, shards);
    if (process.platform === 'linux') assert.equal(receipt.placement_applied, shards);
  } else {
    assert.equal(receipt.placement_requested, 0);
    assert.equal(receipt.placement_applied, 0);
  }
  return {
    operations_per_sec: receipt.logical_transfers_per_sec,
    elapsed_ns: receipt.elapsed_ns,
    process_wall_ms: Number(processWallMs.toFixed(3)),
    reactor_poll_calls: receipt.reactor_poll_calls,
    reactor_readiness_events: receipt.reactor_readiness_events,
    placement_requested: receipt.placement_requested,
    placement_applied: receipt.placement_applied,
  };
}

const warm = Math.min(iterations, 500);
execute(false, warm);
execute(true, warm);

const freeSamples = [];
const affinitySamples = [];
const deltas = [];
for (let pair = 0; pair < pairs; pair++) {
  const affinityFirst = pair % 2 === 1;
  let free;
  let affinity;
  if (affinityFirst) {
    affinity = execute(true);
    free = execute(false);
  } else {
    free = execute(false);
    affinity = execute(true);
  }
  freeSamples.push(free);
  affinitySamples.push(affinity);
  deltas.push({
    pair,
    order: affinityFirst ? 'affinity-free' : 'free-affinity',
    throughput_ratio: affinity.operations_per_sec / free.operations_per_sec,
    throughput_pct: (affinity.operations_per_sec / free.operations_per_sec - 1) * 100,
    elapsed_pct: (affinity.elapsed_ns / free.elapsed_ns - 1) * 100,
  });
}
const bytes = await readFile(binary);
const info = await stat(binary);
const report = {
  schema: 'wasmc-host-transport-affinity-ab/v1',
  measured_at: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? null,
  platform: platformId,
  host: { os: process.platform, arch: process.arch, node: process.version },
  binary: {
    bytes: info.size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  },
  workload: {
    connections,
    iterations_per_connection: iterations,
    pairs,
    reactor_shards: shards,
  },
  placement: {
    requested_mode: 'stable-cpu',
    exact_hard_affinity_supported: process.platform === 'linux',
    linux_policy: 'reactor ordinal -> current process allowed cpuset ordinal; endpoint remains shard-sticky',
  },
  semantic_parity: true,
  performance: {
    free: {
      operations_per_sec: stats(freeSamples.map(row => row.operations_per_sec)),
      elapsed_ns: stats(freeSamples.map(row => row.elapsed_ns)),
      samples: freeSamples,
    },
    affinity: {
      operations_per_sec: stats(affinitySamples.map(row => row.operations_per_sec)),
      elapsed_ns: stats(affinitySamples.map(row => row.elapsed_ns)),
      samples: affinitySamples,
    },
    paired_delta: {
      throughput_ratio: stats(deltas.map(row => row.throughput_ratio)),
      throughput_pct: stats(deltas.map(row => row.throughput_pct)),
      elapsed_pct: stats(deltas.map(row => row.elapsed_pct)),
      positive_pairs: deltas.filter(row => row.throughput_pct > 0).length,
      pairs: deltas,
    },
  },
};
await writeFile(resolve(outputArg), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  accepted: true,
  platform: platformId,
  shards,
  exact_affinity: process.platform === 'linux',
  free_ops_s_p50: report.performance.free.operations_per_sec.p50,
  affinity_ops_s_p50: report.performance.affinity.operations_per_sec.p50,
  paired_throughput_pct_p50: report.performance.paired_delta.throughput_pct.p50,
  positive_pairs: report.performance.paired_delta.positive_pairs,
  pairs,
}));
