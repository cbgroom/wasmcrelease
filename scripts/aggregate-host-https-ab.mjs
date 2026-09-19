import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [inputArg, outputArg, previousArg, expectedArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error('usage: node scripts/aggregate-host-https-ab.mjs INPUT OUTPUT [PREVIOUS.json] [EXPECTED_COUNT]');
}
const inputDir = resolve(inputArg);
const outputDir = resolve(outputArg);
const files = (await readdir(inputDir, { recursive: true })).filter(name => name.endsWith('.json'));
const reports = [];
const shardSweeps = [];
for (const name of files) {
  const value = JSON.parse(await readFile(join(inputDir, name), 'utf8'));
  if (value.schema === 'wasmc-host-https-ab/v1') reports.push(value);
  if (value.schema === 'wasmc-host-transport-shard-sweep/v1') shardSweeps.push(value);
}
if (!reports.length) throw new Error('no HTTPS A/B reports');
reports.sort((a, b) => a.platform.localeCompare(b.platform));
shardSweeps.sort((a, b) => a.platform.localeCompare(b.platform));
if (expectedArg && reports.length !== Number(expectedArg)) {
  throw new Error('expected ' + expectedArg + ' platform reports, got ' + reports.length);
}
if (expectedArg && shardSweeps.length !== Number(expectedArg)) {
  throw new Error('expected ' + expectedArg + ' shard sweep reports, got ' + shardSweeps.length);
}
const commit = reports[0].commit;
if (reports.some(report => report.commit !== commit)) throw new Error('mixed HTTPS A/B commits');
if (shardSweeps.some(report => report.commit !== commit)) throw new Error('mixed shard sweep commits');
if (reports.some(report => report.qualification.semantic_parity !== true)) {
  throw new Error('semantic parity failed on at least one platform');
}
if (shardSweeps.some(report => report.semantic_parity !== true)) {
  throw new Error('shard sweep semantic parity failed on at least one platform');
}

let history = [];
if (previousArg) {
  try {
    const previous = JSON.parse(await readFile(resolve(previousArg), 'utf8'));
    if (previous.schema === 'wasmc-host-https-ab-history/v1' && Array.isArray(previous.entries)) {
      history = previous.entries;
    }
  } catch {}
}
const previousEntry = [...history].reverse().find(entry => entry.commit !== commit);
const previousByPlatform = new Map((previousEntry?.summary ?? []).map(row => [row.platform, row]));
const sweepByPlatform = new Map(shardSweeps.map(report => [report.platform, report]));

const summary = reports.map(report => {
  const p = report.performance.summary;
  const sweep = sweepByPlatform.get(report.platform);
  if (!sweep) throw new Error('missing shard sweep report for ' + report.platform);
  const best = sweep.best;
  const current = {
    platform: report.platform,
    semantic_parity: report.qualification.semantic_parity,
    baseline_rps_p50: p.baseline.rps.p50,
    candidate_rps_p50: p.candidate.rps.p50,
    paired_rps_ratio_p50: p.paired_delta.rps_ratio.p50,
    paired_rps_pct_p50: p.paired_delta.rps_pct.p50,
    baseline_avg_ns_p50: p.baseline.avg_ns_per_valid_request.p50,
    candidate_avg_ns_p50: p.candidate.avg_ns_per_valid_request.p50,
    paired_latency_pct_p50: p.paired_delta.avg_ns_per_valid_request_pct.p50,
    baseline_host_operations: report.qualification.baseline.host_operations,
    candidate_host_operations: report.qualification.candidate.host_operations,
    forced_partial_writes_baseline: report.qualification.baseline.host_partial_writes,
    forced_partial_writes_candidate: report.qualification.candidate.host_partial_writes,
    baseline_polling_cycles_per_op:
      report.scheduling_diagnostics.baseline.polling_owner_cycles_per_host_operation,
    candidate_reactor_polls_per_op:
      report.scheduling_diagnostics.candidate.reactor_polls_per_host_operation,
    candidate_reactor_readiness_events_per_op:
      report.scheduling_diagnostics.candidate.reactor_readiness_events_per_host_operation,
    baseline_dominant_guest_operation:
      report.qualification.baseline.dominant_guest_operation?.operation ?? null,
    candidate_dominant_guest_operation:
      report.qualification.candidate.dominant_guest_operation?.operation ?? null,
    c32_best_shards: best.shards,
    c32_dedicated_ops_p50: best.dedicated_ops_p50,
    c32_shared_ops_p50: best.sharded_ops_p50,
    c32_paired_throughput_pct_p50: best.paired_throughput_pct_p50,
    c32_positive_pairs: best.positive_pairs,
    c32_pairs: best.pairs,
    c32_dedicated_threads: best.dedicated_threads,
    c32_shared_threads: best.sharded_threads,
    c32_dedicated_control_per_op: best.dedicated_control_per_op,
    c32_shared_control_per_op: best.sharded_control_per_op,
    c32_shard_results: sweep.results,
  };
  const previous = previousByPlatform.get(report.platform);
  if (previous) {
    current.history_delta = {
      candidate_rps_pct:
        Number((((current.candidate_rps_p50 / previous.candidate_rps_p50) - 1) * 100).toFixed(2)),
      paired_ratio_pct:
        Number((((current.paired_rps_ratio_p50 / previous.paired_rps_ratio_p50) - 1) * 100).toFixed(2)),
      baseline_commit: previousEntry.commit,
    };
  }
  return current;
});

const baselineDominance = {};
const candidateDominance = {};
for (const row of summary) {
  const b = row.baseline_dominant_guest_operation ?? 'unavailable';
  const c = row.candidate_dominant_guest_operation ?? 'unavailable';
  baselineDominance[b] = (baselineDominance[b] ?? 0) + 1;
  candidateDominance[c] = (candidateDominance[c] ?? 0) + 1;
}
const ratios = summary.map(row => row.paired_rps_ratio_p50);
const minRatio = Math.min(...ratios);
const maxRatio = Math.max(...ratios);
const c32Deltas = summary.map(row => row.c32_paired_throughput_pct_p50);
const observations = [
  {
    kind: 'cross_platform_semantic_parity',
    passed: summary.every(row => row.semantic_parity),
    platforms: summary.length,
  },
  {
    kind: 'cross_platform_paired_ratio_range',
    min_p50_ratio: minRatio,
    max_p50_ratio: maxRatio,
    interpretation:
      'Hosted single-connection qualification ratio; mechanism evidence against the polling baseline, not a production throughput multiplier.',
  },
  {
    kind: 'cross_platform_guest_operation_profile',
    baseline_counts: baselineDominance,
    candidate_counts: candidateDominance,
    interpretation:
      'Guest operation samples help separate Guest compute from Host scheduling; they do not establish root cause by themselves.',
  },
  {
    kind: 'cross_platform_c32_host_scheduling',
    min_p50_throughput_pct: Math.min(...c32Deltas),
    max_p50_throughput_pct: Math.max(...c32Deltas),
    best_shards_by_platform: Object.fromEntries(summary.map(row => [row.platform, row.c32_best_shards])),
    all_platforms_semantic_parity: shardSweeps.every(report => report.semantic_parity),
    interpretation:
      '32-connection real-TCP Host lifecycle shard sweep comparing event-driven dedicated owners against 1/2/4/8/16 shared-reactor shards. This is Host scheduling evidence, not HTTPS product throughput.',
  },
];

const current = {
  schema: 'wasmc-host-https-ab-summary/v1',
  commit,
  measured_at: new Date().toISOString(),
  platform_count: reports.length,
  policy:
    'Artifact identity and HTTPS lifecycle/semantic parity are hard gates. Paired GitHub-hosted timing is observational mechanism evidence, not an SLA.',
  summary,
  observations,
  reports,
  shard_sweeps: shardSweeps,
};
history = history.filter(entry => entry.commit !== commit);
history.push({ commit, measured_at: current.measured_at, summary, observations });
history = history.slice(-100);
const historyDoc = { schema: 'wasmc-host-https-ab-history/v1', entries: history };

const table = [
  '| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  ...summary.map(row =>
    '| ' + row.platform +
    ' | ' + row.baseline_rps_p50.toFixed(3) +
    ' | ' + row.candidate_rps_p50.toFixed(3) +
    ' | ' + row.paired_rps_ratio_p50.toFixed(2) + 'x' +
    ' | ' + row.c32_best_shards +
    ' | ' + row.c32_dedicated_ops_p50.toFixed(1) +
    ' | ' + row.c32_shared_ops_p50.toFixed(1) +
    ' | ' + row.c32_paired_throughput_pct_p50.toFixed(2) + '%' +
    ' | ' + row.c32_dedicated_threads + '->' + row.c32_shared_threads +
    ' | ' + (row.semantic_parity ? 'PASS' : 'FAIL') + ' |'
  ),
].join('\n');
const markdown =
  '# WAsmC Host HTTPS paired A/B flywheel\n\n' +
  'Commit: ' + commit + '  \n' +
  'Measured: ' + current.measured_at + '  \n' +
  'Platforms: ' + reports.length + '\n\n' +
  table +
  '\n\nHTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.\n';

const htmlRows = summary.map(row =>
  '<tr><td>' + row.platform +
  '</td><td>' + row.baseline_rps_p50.toFixed(3) +
  '</td><td>' + row.candidate_rps_p50.toFixed(3) +
  '</td><td>' + row.paired_rps_ratio_p50.toFixed(2) + 'x' +
  '</td><td>' + row.c32_best_shards +
  '</td><td>' + row.c32_dedicated_ops_p50.toFixed(1) +
  '</td><td>' + row.c32_shared_ops_p50.toFixed(1) +
  '</td><td>' + row.c32_paired_throughput_pct_p50.toFixed(2) + '%' +
  '</td><td>' + row.c32_dedicated_threads + '->' + row.c32_shared_threads +
  '</td><td>' + (row.semantic_parity ? 'PASS' : 'FAIL') +
  '</td></tr>'
).join('');
const html =
  '<!doctype html><meta charset="utf-8"><title>WAsmC HTTPS A/B flywheel</title>' +
  '<style>body{font-family:system-ui,sans-serif;max-width:1500px;margin:40px auto;padding:0 20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:right}th:first-child,td:first-child{text-align:left}code{background:#f4f4f4;padding:2px 4px}</style>' +
  '<h1>WAsmC Host HTTPS paired A/B flywheel</h1><p>Commit <code>' + commit + '</code> · ' + current.measured_at + '</p>' +
  '<p>Artifact/lifecycle/semantic parity are hard gates. Timings are observational mechanism evidence.</p>' +
  '<table><thead><tr><th>Platform</th><th>HTTPS polling RPS</th><th>HTTPS reactor RPS</th><th>HTTPS ratio</th><th>c32 best shards</th><th>c32 dedicated ops/s</th><th>c32 sharded ops/s</th><th>c32 delta</th><th>c32 threads</th><th>Parity</th></tr></thead><tbody>' +
  htmlRows +
  '</tbody></table><p><a href="latest.json">latest.json</a> · <a href="history.json">history.json</a> · <a href="latest.md">Markdown</a></p>';

await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'latest.json'), JSON.stringify(current, null, 2) + '\n');
await writeFile(join(outputDir, 'history.json'), JSON.stringify(historyDoc, null, 2) + '\n');
await writeFile(join(outputDir, 'latest.md'), markdown);
await writeFile(join(outputDir, 'index.html'), html);
console.log(JSON.stringify({
  accepted: true,
  commit,
  platforms: reports.length,
  semantic_parity: summary.every(row => row.semantic_parity),
  paired_ratio_p50_range: [minRatio, maxRatio],
}));
