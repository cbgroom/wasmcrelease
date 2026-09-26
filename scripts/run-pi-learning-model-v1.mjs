import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateTraceText } from './wasmc-live-agent-trace-evaluation-v1.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const protocol = JSON.parse(readFileSync(new URL('../agent-evaluation/fresh-agent-learning-v1.json', import.meta.url), 'utf8'));

function options(argv) {
  const out = { model: null, commit: null, output: null, timeoutMs: 180000 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--model') out.model = argv[++index];
    else if (argv[index] === '--commit') out.commit = argv[++index];
    else if (argv[index] === '--out') out.output = argv[++index];
    else if (argv[index] === '--timeout-ms') out.timeoutMs = Number(argv[++index]);
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  assert.ok(out.model, '--model is required');
  const allowed = protocol.cohort_gate.required_models.map(row => `${row.provider}/${row.identity}`);
  assert.ok(allowed.includes(out.model), `model is not in controlled pair: ${out.model}`);
  out.commit ??= execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.match(out.commit, /^[0-9a-f]{40}$/);
  assert.ok(Number.isSafeInteger(out.timeoutMs) && out.timeoutMs >= 1000 && out.timeoutMs <= 600000);
  out.output ??= join(root, 'target/fresh-agent', out.commit, out.model.split('/').at(-1), 'runner-summary.json');
  out.output = isAbsolute(out.output) ? out.output : resolve(process.cwd(), out.output);
  return out;
}

function structural(report, limits) {
  const observed = {
    tool_calls: report.tool_calls.length,
    assistant_turns: report.assistant_turns,
    tool_result_characters: report.tool_result_characters,
    error_results: report.error_results,
    retries: report.retries,
    exact_duplicate_calls: report.exact_duplicate_calls.length,
    repeated_reads: report.repeated_reads.length,
    zero_yield_results: report.zero_yield_results
  };
  const failures = Object.entries(limits)
    .filter(([key, limit]) => observed[key.replace(/^max_/, '')] > limit)
    .map(([key, limit]) => ({ metric: key.replace(/^max_/, ''), observed: observed[key.replace(/^max_/, '')], limit }));
  return { accepted: failures.length === 0 && report.hygiene_findings.length === 0, observed, limits, failures };
}

const input = options(process.argv.slice(2));
const piVersion = execFileSync('pi', ['--version'], { encoding: 'utf8' }).trim();
const [provider, identity] = input.model.split('/', 2);
const summary = {
  schema: 'wasmc.pi-learning-model-run/v1',
  protocol: protocol.schema,
  release_guidance_commit: input.commit,
  agent: { implementation: 'pi', version: piVersion },
  model: { provider, identity },
  timeout_ms: input.timeoutMs,
  raw_trace_retained: false,
  hidden_reasoning_retained: false,
  cases: []
};

for (const caseDefinition of protocol.cases) {
  const temporary = mkdtempSync(join(tmpdir(), 'wasmc-pi-learning-'));
  const checkout = join(temporary, 'checkout');
  try {
    execFileSync('git', ['clone', '--quiet', '--no-checkout', '--shared', root, checkout]);
    execFileSync('git', ['checkout', '--quiet', '--detach', input.commit], { cwd: checkout });
    const started = Date.now();
    const result = spawnSync('pi', [
      '--model', input.model,
      '--no-session',
      '--mode', 'json',
      '--tools', 'read,grep,find,ls,bash',
      '--no-skills',
      '--no-prompt-templates',
      '--no-extensions',
      '--approve',
      '-p', caseDefinition.prompt
    ], {
      cwd: checkout,
      encoding: 'utf8',
      timeout: input.timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      killSignal: 'SIGTERM'
    });
    const report = evaluateTraceText(result.stdout ?? '', 'general');
    const limits = protocol.cohort_gate.structural_efficiency[caseDefinition.class];
    summary.cases.push({
      id: caseDefinition.id,
      class: caseDefinition.class,
      process: {
        status: result.status,
        signal: result.signal,
        timed_out: result.error?.code === 'ETIMEDOUT',
        wall_ms: Date.now() - started,
        stderr_characters: (result.stderr ?? '').length,
        stderr_sha256: createHash('sha256').update(result.stderr ?? '').digest('hex')
      },
      structural: structural(report, limits),
      trace: report
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  const current = summary.cases.at(-1);
  process.stdout.write(`${caseDefinition.id} structural=${current.structural.accepted} timeout=${current.process.timed_out} wall_ms=${current.process.wall_ms}\n`);
}

summary.structural_pass = summary.cases.every(row => row.structural.accepted && !row.process.timed_out && row.process.status === 0);
mkdirSync(dirname(input.output), { recursive: true });
writeFileSync(input.output, `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ accepted: summary.structural_pass, output: input.output })}\n`);
if (!summary.structural_pass) process.exitCode = 1;
