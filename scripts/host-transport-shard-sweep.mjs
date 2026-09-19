import assert from 'node:assert/strict';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [dedicatedArg, sharedArg, platformId, outputArg] = process.argv.slice(2);
if (!dedicatedArg || !sharedArg || !platformId || !outputArg) {
  throw new Error('usage: node scripts/host-transport-shard-sweep.mjs DEDICATED SHARED PLATFORM OUTPUT.json');
}
const dedicated = resolve(dedicatedArg);
const shared = resolve(sharedArg);
const output = resolve(outputArg);
const shards = (process.env.WASMC_HOST_SHARD_SWEEP ?? '1,2,4,8,16')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(Number.isFinite);
const pairs = Number(process.env.WASMC_HOST_SWEEP_PAIRS ?? 3);
const iterations = Number(process.env.WASMC_HOST_SWEEP_ITERATIONS ?? 1000);
assert.ok(shards.length > 0);
assert.ok(shards.every(value => Number.isInteger(value) && value >= 1 && value <= 64));
assert.ok(Number.isInteger(pairs) && pairs >= 2 && pairs <= 10);
assert.ok(Number.isInteger(iterations) && iterations >= 1);

const results = [];
for (const shardCount of shards) {
  const temp = output + '.shards-' + shardCount + '.tmp.json';
  const run = spawnSync(
    process.execPath,
    [
      resolve('scripts/host-transport-concurrency-ab.mjs'),
      dedicated,
      shared,
      platformId + '-shards-' + shardCount,
      temp,
    ],
    {
      encoding: 'utf8',
      maxBuffer: 16 << 20,
      timeout: 180000,
      env: {
        ...process.env,
        WASMC_HOST_REACTOR_SHARDS: String(shardCount),
        WASMC_HOST_AB_PAIRS: String(pairs),
        WASMC_HOST_AB_ITERATIONS: String(iterations),
      },
    },
  );
  if (run.error) throw run.error;
  if (run.status !== 0) {
    throw new Error('shard ' + shardCount + ' failed (' + run.status + '): ' + run.stderr);
  }
  const report = JSON.parse(await readFile(temp, 'utf8'));
  await unlink(temp).catch(() => {});
  assert.equal(report.schema, 'wasmc-host-transport-concurrency-ab/v1');
  assert.equal(report.semantic_parity, true);
  assert.equal(report.topology.shared_reactor_threads, shardCount);
  results.push({
    shards: shardCount,
    dedicated_ops_p50: report.performance.dedicated.operations_per_sec.p50,
    sharded_ops_p50: report.performance.shared.operations_per_sec.p50,
    paired_throughput_pct_p50: report.performance.paired_delta.throughput_pct.p50,
    positive_pairs: report.performance.paired_delta.positive_throughput_pairs,
    pairs: report.workload.pairs,
    dedicated_threads: report.topology.dedicated_owner_threads,
    sharded_threads: report.topology.shared_reactor_threads,
    dedicated_control_per_op: report.performance.dedicated.control_events_per_operation.p50,
    sharded_control_per_op: report.performance.shared.control_events_per_operation.p50,
  });
  console.log(JSON.stringify({
    platform: platformId,
    shards: shardCount,
    pct: results.at(-1).paired_throughput_pct_p50,
    positive_pairs: results.at(-1).positive_pairs,
    pairs,
  }));
}
results.sort((a, b) => a.shards - b.shards);
const best = [...results].sort((a, b) => {
  if (b.paired_throughput_pct_p50 !== a.paired_throughput_pct_p50) {
    return b.paired_throughput_pct_p50 - a.paired_throughput_pct_p50;
  }
  return a.shards - b.shards;
})[0];
const report = {
  schema: 'wasmc-host-transport-shard-sweep/v1',
  measured_at: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? null,
  platform: platformId,
  host: { os: process.platform, arch: process.arch, node: process.version },
  workload: {
    connections: Number(process.env.WASMC_HOST_AB_CONCURRENCY ?? 32),
    iterations_per_connection: iterations,
    pairs_per_shard: pairs,
    shard_candidates: shards,
  },
  policy: {
    semantic_lifecycle_gate: 'hard',
    hosted_timing: 'observational',
    selection: 'highest paired p50 throughput delta; tie -> fewer shards',
    promotion: 'evidence only; best shard count is not a production default',
  },
  semantic_parity: true,
  results,
  best,
};
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  accepted: true,
  platform: platformId,
  best_shards: best.shards,
  best_pct: best.paired_throughput_pct_p50,
  best_positive_pairs: best.positive_pairs + '/' + best.pairs,
  dedicated_threads: best.dedicated_threads,
  candidate_threads: best.sharded_threads,
}));
