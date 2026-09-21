import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [inputDirArg, outputDirArg, previousHistoryArg] = process.argv.slice(2);
if (!inputDirArg || !outputDirArg) throw new Error('usage: node scripts/aggregate-native-cli-perf.mjs INPUT_DIR OUTPUT_DIR [PREVIOUS_HISTORY.json]');

const inputDir = resolve(inputDirArg);
const outputDir = resolve(outputDirArg);
const benchmarkManifest = JSON.parse(await readFile(resolve('bench/manifest.json'), 'utf8'));
const baselinePolicy = benchmarkManifest.relative_baseline_policy ?? {
  comparison: 'same-platform-only',
  history_window: 5,
  minimum_history: 1,
  advisory_regression_ratio: 1.25,
  hard_gate: false,
};
if (baselinePolicy.comparison !== 'same-platform-only' || baselinePolicy.hard_gate !== false) {
  throw new Error('unsupported public performance baseline policy');
}

const files = (await readdir(inputDir, { recursive: true })).filter(name => name.endsWith('.json'));
const reports = [];
for (const name of files) {
  const value = JSON.parse(await readFile(join(inputDir, name), 'utf8'));
  if (value.schema === 'wasmc-native-cli-performance/v1') reports.push(value);
}
if (!reports.length) throw new Error('no performance reports found');
reports.sort((a, b) => a.platform.localeCompare(b.platform));
const commit = reports[0].commit;
if (reports.some(report => report.commit !== commit)) throw new Error('mixed performance commits');

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const gm = values => Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);

const summary = reports.map(report => {
  const rows = Object.values(report.cases);
  const build = rows.map(row => row.build_wasm.p50_ms);
  const miss = rows.map(row => row.native_build_miss.p50_ms);
  const hit = rows.map(row => row.native_build_hit.p50_ms);
  const small = report.cases.small_scalar;
  return {
    platform: report.platform,
    cli_bytes: report.cli.bytes,
    build_wasm_geomean_ms: Number(gm(build).toFixed(3)),
    native_miss_geomean_ms: Number(gm(miss).toFixed(3)),
    native_hit_geomean_ms: Number(gm(hit).toFixed(3)),
    run_wasmi_p50_ms: small.run_wasmi?.p50_ms ?? null,
    native_run_p50_ms: small.native_run?.p50_ms ?? null,
  };
});

let history = [];
if (previousHistoryArg) {
  try {
    const old = JSON.parse(await readFile(resolve(previousHistoryArg), 'utf8'));
    if (old.schema === 'wasmc-public-performance-history/v1' && Array.isArray(old.entries)) history = old.entries;
  } catch {}
}
const priorHistory = history.filter(entry => entry.commit !== commit);
const metricNames = [
  'build_wasm_geomean_ms',
  'native_miss_geomean_ms',
  'native_hit_geomean_ms',
  'run_wasmi_p50_ms',
  'native_run_p50_ms',
];

const relativeBaselines = summary.map(row => {
  const historicalRows = priorHistory
    .flatMap(entry => (entry.summary ?? []).filter(old => old.platform === row.platform))
    .slice(-baselinePolicy.history_window);
  const metrics = {};
  for (const name of metricNames) {
    const values = historicalRows.map(old => old[name]).filter(Number.isFinite);
    const baseline = values.length ? median(values) : null;
    const current = row[name];
    const ratio = Number.isFinite(current) && Number.isFinite(baseline) && baseline > 0
      ? Number((current / baseline).toFixed(4))
      : null;
    metrics[name] = { current, baseline, ratio };
  }
  const ratios = Object.values(metrics).map(value => value.ratio).filter(Number.isFinite);
  const state = historicalRows.length < baselinePolicy.minimum_history
    ? 'bootstrap'
    : ratios.some(ratio => ratio > baselinePolicy.advisory_regression_ratio)
      ? 'advisory-regression'
      : 'within-baseline';
  return {
    platform: row.platform,
    state,
    history_samples: historicalRows.length,
    history_window: baselinePolicy.history_window,
    advisory_regression_ratio: baselinePolicy.advisory_regression_ratio,
    metrics,
  };
});

const current = {
  schema: 'wasmc-public-performance-summary/v1',
  commit,
  measured_at: new Date().toISOString(),
  platform_count: reports.length,
  corpus_count: Object.keys(reports[0].cases).length,
  policy: 'GitHub-hosted timings are same-platform comparative observations. Source/Wasm identity and behavior are hard gates; timing ratios are advisory under the current policy.',
  relative_baseline_policy: baselinePolicy,
  relative_baselines: relativeBaselines,
  summary,
  reports,
};

history = priorHistory;
history.push({ commit, measured_at: current.measured_at, summary });
history = history.slice(-100);
const historyDoc = { schema: 'wasmc-public-performance-history/v1', entries: history };

const runMedian = median(summary.map(row => row.run_wasmi_p50_ms).filter(Number.isFinite));
const nativeMedian = median(summary.map(row => row.native_run_p50_ms).filter(Number.isFinite));
const buildMedian = median(summary.map(row => row.build_wasm_geomean_ms));
const badge = (label, message) => ({ schemaVersion: 1, label, message, color: 'brightgreen' });
const baselineByPlatform = new Map(relativeBaselines.map(row => [row.platform, row]));
const ratioText = (row, metric) => {
  const ratio = baselineByPlatform.get(row.platform)?.metrics?.[metric]?.ratio;
  return Number.isFinite(ratio) ? ratio.toFixed(2) + 'x' : '-';
};

const tableLines = [
  '| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |',
  '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
];
for (const row of summary) {
  tableLines.push(
    '| ' + row.platform +
    ' | ' + (baselineByPlatform.get(row.platform)?.state ?? 'bootstrap') +
    ' | ' + (row.cli_bytes / 1048576).toFixed(2) + ' MiB' +
    ' | ' + row.build_wasm_geomean_ms.toFixed(3) + ' ms' +
    ' | ' + ratioText(row, 'build_wasm_geomean_ms') +
    ' | ' + row.native_miss_geomean_ms.toFixed(3) + ' ms' +
    ' | ' + row.native_hit_geomean_ms.toFixed(3) + ' ms' +
    ' | ' + (row.run_wasmi_p50_ms?.toFixed(3) ?? '-') + ' ms' +
    ' | ' + ratioText(row, 'run_wasmi_p50_ms') +
    ' | ' + (row.native_run_p50_ms?.toFixed(3) ?? '-') + ' ms' +
    ' | ' + ratioText(row, 'native_run_p50_ms') + ' |'
  );
}
const markdown = [
  '# WAsmC public performance',
  '',
  'Commit: ' + commit,
  'Measured: ' + current.measured_at,
  'Platforms: ' + reports.length,
  'Canonical corpus: ' + current.corpus_count,
  '',
  ...tableLines,
  '',
  'GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.',
  'Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.',
  'Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.',
  ''
].join('\n');

const htmlRows = summary.map(row => {
  return '<tr><td>' + row.platform +
    '</td><td>' + (baselineByPlatform.get(row.platform)?.state ?? 'bootstrap') +
    '</td><td>' + (row.cli_bytes / 1048576).toFixed(2) + ' MiB' +
    '</td><td>' + row.build_wasm_geomean_ms.toFixed(3) + ' ms' +
    '</td><td>' + ratioText(row, 'build_wasm_geomean_ms') +
    '</td><td>' + row.native_miss_geomean_ms.toFixed(3) + ' ms' +
    '</td><td>' + row.native_hit_geomean_ms.toFixed(3) + ' ms' +
    '</td><td>' + (row.run_wasmi_p50_ms?.toFixed(3) ?? '-') + ' ms' +
    '</td><td>' + ratioText(row, 'run_wasmi_p50_ms') +
    '</td><td>' + (row.native_run_p50_ms?.toFixed(3) ?? '-') + ' ms' +
    '</td><td>' + ratioText(row, 'native_run_p50_ms') + '</td></tr>';
}).join('');

const html = '<!doctype html><meta charset="utf-8"><title>WAsmC performance</title>' +
  '<style>body{font-family:system-ui,sans-serif;max-width:1400px;margin:40px auto;padding:0 20px}' +
  'table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:right}' +
  'th:first-child,td:first-child{text-align:left}code{background:#f4f4f4;padding:2px 4px}</style>' +
  '<h1>WAsmC public performance</h1><p>Commit <code>' + commit + '</code> · ' + current.measured_at + '</p>' +
  '<p>GitHub-hosted timings compare only with recent history from the same platform. Ratios are current / baseline; cross-platform absolute equality is not a gate.</p>' +
  '<table><thead><tr><th>Platform</th><th>Baseline</th><th>CLI</th><th>build Wasm</th><th>build/base</th>' +
  '<th>native miss</th><th>native hit</th><th>run/Wasmi</th><th>run/base</th><th>native run</th><th>native/base</th>' +
  '</tr></thead><tbody>' + htmlRows + '</tbody></table>' +
  '<p><a href="latest.json">latest.json</a> · <a href="history.json">history.json</a> · <a href="latest.md">Markdown</a></p>';

await mkdir(join(outputDir, 'badges'), { recursive: true });
await writeFile(join(outputDir, 'latest.json'), JSON.stringify(current, null, 2) + '\n');
await writeFile(join(outputDir, 'history.json'), JSON.stringify(historyDoc, null, 2) + '\n');
await writeFile(join(outputDir, 'latest.md'), markdown);
await writeFile(join(outputDir, 'index.html'), html);
await writeFile(join(outputDir, 'badges', 'perf.json'), JSON.stringify(badge('perf', reports.length + ' platforms')) + '\n');
await writeFile(join(outputDir, 'badges', 'run.json'), JSON.stringify(badge('run/wasmi', runMedian.toFixed(2) + ' ms median')) + '\n');
await writeFile(join(outputDir, 'badges', 'native.json'), JSON.stringify(badge('native run', nativeMedian.toFixed(2) + ' ms median')) + '\n');
await writeFile(join(outputDir, 'badges', 'build.json'), JSON.stringify(badge('build wasm', buildMedian.toFixed(2) + ' ms median')) + '\n');

console.log(JSON.stringify({
  accepted: true,
  commit,
  platforms: reports.length,
  runMedian,
  nativeMedian,
  buildMedian,
  baseline_comparison: baselinePolicy.comparison,
  advisory_regressions: relativeBaselines.filter(row => row.state === 'advisory-regression').map(row => row.platform),
}));
