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
for (const name of files) {
  const value = JSON.parse(await readFile(join(inputDir, name), 'utf8'));
  if (value.schema === 'wasmc-host-https-ab/v1') reports.push(value);
}
if (!reports.length) throw new Error('no HTTPS A/B reports');
reports.sort((a, b) => a.platform.localeCompare(b.platform));
if (expectedArg && reports.length !== Number(expectedArg)) {
  throw new Error('expected ' + expectedArg + ' platform reports, got ' + reports.length);
}
const commit = reports[0].commit;
if (reports.some(report => report.commit !== commit)) throw new Error('mixed HTTPS A/B commits');
if (reports.some(report => report.qualification.semantic_parity !== true)) {
  throw new Error('semantic parity failed on at least one platform');
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

const summary = reports.map(report => {
  const p = report.performance.summary;
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
};
history = history.filter(entry => entry.commit !== commit);
history.push({ commit, measured_at: current.measured_at, summary, observations });
history = history.slice(-100);
const historyDoc = { schema: 'wasmc-host-https-ab-history/v1', entries: history };

const table = [
  '| Platform | Baseline RPS | Reactor RPS | Paired ratio | Latency delta | Baseline cycles/op | Reactor polls/op | Reactor events/op | Semantic parity |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---|',
  ...summary.map(row =>
    '| ' + row.platform +
    ' | ' + row.baseline_rps_p50.toFixed(3) +
    ' | ' + row.candidate_rps_p50.toFixed(3) +
    ' | ' + row.paired_rps_ratio_p50.toFixed(2) + 'x' +
    ' | ' + row.paired_latency_pct_p50.toFixed(2) + '%' +
    ' | ' + row.baseline_polling_cycles_per_op.toFixed(3) +
    ' | ' + row.candidate_reactor_polls_per_op.toFixed(3) +
    ' | ' + row.candidate_reactor_readiness_events_per_op.toFixed(3) +
    ' | ' + (row.semantic_parity ? 'PASS' : 'FAIL') + ' |'
  ),
].join('\n');
const markdown =
  '# WAsmC Host HTTPS paired A/B flywheel\n\n' +
  'Commit: ' + commit + '  \n' +
  'Measured: ' + current.measured_at + '  \n' +
  'Platforms: ' + reports.length + '\n\n' +
  table +
  '\n\nThe baseline uses a 1 ms polling/retry owner. The candidate uses the accepted mio shared-reactor scheduling substrate. Functional and artifact checks are hard gates; paired hosted timings are observational mechanism evidence, not an SLA or production throughput multiplier.\n';

const htmlRows = summary.map(row =>
  '<tr><td>' + row.platform +
  '</td><td>' + row.baseline_rps_p50.toFixed(3) +
  '</td><td>' + row.candidate_rps_p50.toFixed(3) +
  '</td><td>' + row.paired_rps_ratio_p50.toFixed(2) + 'x' +
  '</td><td>' + row.paired_latency_pct_p50.toFixed(2) + '%' +
  '</td><td>' + row.baseline_polling_cycles_per_op.toFixed(3) +
  '</td><td>' + row.candidate_reactor_polls_per_op.toFixed(3) +
  '</td><td>' + row.candidate_reactor_readiness_events_per_op.toFixed(3) +
  '</td><td>' + (row.semantic_parity ? 'PASS' : 'FAIL') +
  '</td></tr>'
).join('');
const html =
  '<!doctype html><meta charset="utf-8"><title>WAsmC HTTPS A/B flywheel</title>' +
  '<style>body{font-family:system-ui,sans-serif;max-width:1500px;margin:40px auto;padding:0 20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:right}th:first-child,td:first-child{text-align:left}code{background:#f4f4f4;padding:2px 4px}</style>' +
  '<h1>WAsmC Host HTTPS paired A/B flywheel</h1><p>Commit <code>' + commit + '</code> · ' + current.measured_at + '</p>' +
  '<p>Artifact/lifecycle/semantic parity are hard gates. Timings are observational mechanism evidence.</p>' +
  '<table><thead><tr><th>Platform</th><th>Baseline RPS</th><th>Reactor RPS</th><th>Paired ratio</th><th>Latency delta</th><th>Baseline cycles/op</th><th>Reactor polls/op</th><th>Reactor events/op</th><th>Parity</th></tr></thead><tbody>' +
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
