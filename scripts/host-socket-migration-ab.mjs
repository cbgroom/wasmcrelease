import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const [legacyArg, libArg, adapterArg, platform, outputArg] = process.argv.slice(2);
if (!legacyArg || !libArg || !adapterArg || !platform || !outputArg) {
  throw new Error("usage: node scripts/host-socket-migration-ab.mjs LEGACY LIB_HELPER ADAPTER PLATFORM OUTPUT.json");
}

const legacy = path.resolve(legacyArg);
const lib = path.resolve(libArg);
const adapter = path.resolve(adapterArg);
const pairs = Number(process.env.WASMC_SOCKET_AB_PAIRS ?? 9);
const iterations = Number(process.env.WASMC_SOCKET_AB_ITERATIONS ?? 128);
const frameBytes = Number(process.env.WASMC_SOCKET_AB_FRAME_BYTES ?? 65536);
assert.ok(Number.isInteger(pairs) && pairs >= 3 && pairs <= 31);
assert.ok(Number.isInteger(iterations) && iterations > 0);
assert.ok(Number.isInteger(frameBytes) && frameBytes >= 16 && frameBytes <= 1_048_576);

const execute = (program, args, env = {}) => {
  const result = spawnSync(program, args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} failed: ${result.stderr}`);
  return JSON.parse(result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1));
};

const runLegacy = () => execute(legacy, [], {
  WASMC_HOST_CONCURRENCY: "1",
  WASMC_HOST_ITERATIONS: String(iterations),
  WASMC_HOST_FRAME_BYTES: String(frameBytes),
  WASMC_HOST_REACTOR_SHARDS: "1",
});
const runLib = () => execute(lib, [adapter, String(iterations), String(frameBytes)]);
const validate = (receipt, lane) => {
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.iterations, iterations);
  assert.equal(receipt.frame_bytes, frameBytes);
  assert.equal(receipt.logical_transfers, iterations * 2);
  assert.ok(receipt.logical_transfers_per_sec > 0, `${lane}: invalid throughput`);
  if (lane === "legacy") {
    assert.equal(receipt.connections, 1);
    assert.equal(receipt.host_operations, receipt.host_waits);
    assert.equal(receipt.host_operations, receipt.host_claimed);
  } else {
    assert.equal(receipt.lane, "lib-defined-socket-adapter");
  }
};
const sample = (lane) => {
  const receipt = lane === "legacy" ? runLegacy() : runLib();
  validate(receipt, lane);
  return {
    operations_per_second: Number(receipt.logical_transfers_per_sec),
    mib_per_second: Number(receipt.logical_transfers_per_sec) * frameBytes / (1024 * 1024),
    elapsed_ns: Number(receipt.elapsed_ns),
  };
};
const percentile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];
};
const stats = (values) => ({
  samples: values.length,
  p50: Number(percentile(values, 0.5).toFixed(3)),
  min: Number(Math.min(...values).toFixed(3)),
  max: Number(Math.max(...values).toFixed(3)),
});

sample("legacy");
sample("lib");
const legacySamples = [];
const libSamples = [];
const pairedRatios = [];
const order = [];
for (let index = 0; index < pairs; index += 1) {
  const legacyFirst = index % 2 === 0;
  const lanes = legacyFirst ? ["legacy", "lib"] : ["lib", "legacy"];
  const current = {};
  for (const lane of lanes) current[lane] = sample(lane);
  legacySamples.push(current.legacy);
  libSamples.push(current.lib);
  pairedRatios.push(current.lib.mib_per_second / current.legacy.mib_per_second);
  order.push(legacyFirst ? "legacy-lib" : "lib-legacy");
}

const report = {
  schema: "wasmc.host-socket-migration-ab/v1",
  platform,
  workload: {
    connections: 1,
    iterations,
    frame_bytes: frameBytes,
    direction: "bidirectional-echo",
    logical_bytes_per_sample: iterations * 2 * frameBytes,
  },
  lanes: {
    legacy: "Rust HostEndpoint + operation/wait/claim + shared mio reactor",
    candidate: "Lib-owned Linux socket adapter through wasmc_boundary_v1_invoke",
  },
  policy: {
    semantic_and_lifecycle_checks: "hard",
    performance: "diagnostic-not-HTTPS-migration-acceptance",
    https_transport_migrated: false,
  },
  samples: { legacy: legacySamples, candidate: libSamples, order },
  summary: {
    legacy_mib_per_second: stats(legacySamples.map((row) => row.mib_per_second)),
    candidate_mib_per_second: stats(libSamples.map((row) => row.mib_per_second)),
    paired_ratio: stats(pairedRatios),
    paired_percent: stats(pairedRatios.map((ratio) => (ratio - 1) * 100)),
  },
};
writeFileSync(path.resolve(outputArg), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  accepted: true,
  platform,
  legacy_mib_per_second_p50: report.summary.legacy_mib_per_second.p50,
  candidate_mib_per_second_p50: report.summary.candidate_mib_per_second.p50,
  paired_ratio_p50: report.summary.paired_ratio.p50,
  paired_percent_p50: report.summary.paired_percent.p50,
  https_transport_migrated: false,
}));
