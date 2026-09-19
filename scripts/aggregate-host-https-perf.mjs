import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [inputArg, outputArg, previousArg, expectedArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error('usage: node scripts/aggregate-host-https-perf.mjs INPUT OUTPUT [PREVIOUS.json] [EXPECTED_COUNT]');
}

const inputDir = resolve(inputArg);
const outputDir = resolve(outputArg);
const files = (await readdir(inputDir, { recursive: true })).filter(name => name.endsWith('.json'));
const reports = [];
for (const name of files) {
  const value = JSON.parse(await readFile(join(inputDir, name), 'utf8'));
  if (value.schema === 'wasmc-host-https-performance/v1') reports.push(value);
}
if (!reports.length) throw new Error('no HTTPS performance reports');
reports.sort((a, b) => a.platform.localeCompare(b.platform));
if (expectedArg && reports.length !== Number(expectedArg)) {
  throw new Error('expected ' + expectedArg + ' platform reports, got ' + reports.length);
}
const commit = reports[0].commit;
if (reports.some(report => report.commit !== commit)) throw new Error('mixed HTTPS commits');

let history = [];
if (previousArg) {
  try {
    const previous = JSON.parse(await readFile(resolve(previousArg), 'utf8'));
    if (previous.schema === 'wasmc-host-https-performance-history/v1' && Array.isArray(previous.entries)) {
      history = previous.entries;
    }
  } catch {}
}

const previousEntry = [...history].reverse().find(entry => entry.commit !== commit);
const previousByPlatform = new Map((previousEntry?.summary ?? []).map(row => [row.platform, row]));
const summary = reports.map(report => {
  const current = {
    platform: report.platform,
    rps_p50: report.performance.summary.rps.p50,
    avg_ns_per_valid_request_p50: report.performance.summary.avg_ns_per_valid_request.p50,
    process_wall_ms_p50: report.performance.summary.process_wall_ms.p50,
    host_operations: report.qualification.host_operations,
    host_partial_writes: report.qualification.host_partial_writes,
    dominant_guest_operation: report.learning.dominant_guest_operation?.operation ?? null,
  };
  const previous = previousByPlatform.get(report.platform);
  if (previous) {
    current.history_delta = {
      rps_pct: Number((((current.rps_p50 / previous.rps_p50) - 1) * 100).toFixed(2)),
      avg_ns_per_valid_request_pct: Number((((current.avg_ns_per_valid_request_p50 / previous.avg_ns_per_valid_request_p50) - 1) * 100).toFixed(2)),
      baseline_commit: previousEntry.commit,
    };
  }
  return current;
});

const dominance = {};
for (const row of summary) {
  const key = row.dominant_guest_operation ?? 'unavailable';
  dominance[key] = (dominance[key] ?? 0) + 1;
}
const observations = [];
for (const row of summary) {
  if (row.history_delta) {
    observations.push({
      kind: 'history_delta',
      platform: row.platform,
      ...row.history_delta,
      interpretation: 'observational hosted-runner delta; not an automatic acceptance decision',
    });
  }
}
observations.push({
  kind: 'cross_platform_operation_profile',
  counts: dominance,
  interpretation: 'sampled operation dominance can guide profiling hypotheses; it does not prove root cause',
});

const current = {
  schema: 'wasmc-host-https-performance-summary/v1',
  commit,
  measured_at: new Date().toISOString(),
  platform_count: reports.length,
  policy: 'Functional/lifecycle and artifact identity are hard gates. Hosted timing and history deltas are observational evidence for the next engineering iteration.',
  summary,
  observations,
  reports,
};

history = history.filter(entry => entry.commit !== commit);
history.push({ commit, measured_at: current.measured_at, summary, observations });
history = history.slice(-100);
const historyDoc = { schema: 'wasmc-host-https-performance-history/v1', entries: history };

const table = [
  '| Platform | HTTPS RPS p50 | avg ns/request p50 | process wall p50 | Host ops | forced partial writes | dominant sampled guest op | history RPS delta |',
  '|---|---:|---:|---:|---:|---:|---|---:|',
  ...summary.map(row =>
    '| ' + row.platform +
    ' | ' + row.rps_p50.toFixed(1) +
    ' | ' + row.avg_ns_per_valid_request_p50.toFixed(1) +
    ' | ' + row.process_wall_ms_p50.toFixed(1) + ' ms' +
    ' | ' + row.host_operations +
    ' | ' + row.host_partial_writes +
    ' | ' + (row.dominant_guest_operation ?? '-') +
    ' | ' + (row.history_delta ? row.history_delta.rps_pct.toFixed(2) + '%' : '-') + ' |'
  ),
].join('\n');
const markdown =
  '# WAsmC Host + Lib HTTPS flywheel\n\n' +
  'Commit: ' + commit + '  \n' +
  'Measured: ' + current.measured_at + '  \n' +
  'Platforms: ' + reports.length + '\n\n' +
  table +
  '\n\nFunctional/lifecycle and artifact identity are hard gates. GitHub-hosted timing is observational evidence, not an SLA.\n';

const htmlRows = summary.map(row =>
  '<tr><td>' + row.platform +
  '</td><td>' + row.rps_p50.toFixed(1) +
  '</td><td>' + row.avg_ns_per_valid_request_p50.toFixed(1) +
  '</td><td>' + row.process_wall_ms_p50.toFixed(1) + ' ms' +
  '</td><td>' + row.host_operations +
  '</td><td>' + row.host_partial_writes +
  '</td><td>' + (row.dominant_guest_operation ?? '-') +
  '</td><td>' + (row.history_delta ? row.history_delta.rps_pct.toFixed(2) + '%' : '-') +
  '</td></tr>'
).join('');
const html =
  '<!doctype html><meta charset="utf-8"><title>WAsmC HTTPS flywheel</title>' +
  '<style>body{font-family:system-ui,sans-serif;max-width:1400px;margin:40px auto;padding:0 20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:right}th:first-child,td:first-child{text-align:left}code{background:#f4f4f4;padding:2px 4px}</style>' +
  '<h1>WAsmC Host + Lib HTTPS flywheel</h1><p>Commit <code>' + commit + '</code> · ' + current.measured_at + '</p>' +
  '<p>Functional and artifact checks are hard gates; timings are observational.</p>' +
  '<table><thead><tr><th>Platform</th><th>RPS p50</th><th>avg ns/request</th><th>process wall</th><th>Host ops</th><th>partial writes</th><th>dominant guest op</th><th>history RPS delta</th></tr></thead><tbody>' +
  htmlRows +
  '</tbody></table><p><a href="latest.json">latest.json</a> · <a href="history.json">history.json</a> · <a href="latest.md">Markdown</a></p>';

await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'latest.json'), JSON.stringify(current, null, 2) + '\n');
await writeFile(join(outputDir, 'history.json'), JSON.stringify(historyDoc, null, 2) + '\n');
await writeFile(join(outputDir, 'latest.md'), markdown);
await writeFile(join(outputDir, 'index.html'), html);
console.log(JSON.stringify({ accepted: true, commit, platforms: reports.length, observations: observations.length }));
