import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateTraceText } from './wasmc-live-agent-trace-evaluation-v1.mjs';
import { answerContract } from './fresh-agent-learning-v1.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const protocol = JSON.parse(readFileSync(new URL('../agent-evaluation/fresh-agent-learning-v3.json', import.meta.url), 'utf8'));

// Retain only allowlisted public execution JSON, never raw messages or reasoning.
function executionReceipts(text) {
  const receipts = [];
  const keys = ['accepted', 'compiler_sha256', 'source_sha256', 'core_bytes', 'core_sha256', 'imports', 'export', 'calls', 'call', 'value',
    'codec', 'package', 'apis', 'input_utf8', 'encoded_utf8', 'decoded_utf8', 'imports_verified', 'selected_Root_verified',
    'invalid_input_rejected', 'rounds', 'explicit_drops', 'persistent_provider_memory_bytes', 'expected_rejection', 'verifier_exit_code', 'execution_accepted', 'verifier_stderr'];
  for (const line of text.split(/\r?\n/)) {
    try {
      const event = JSON.parse(line), message = event.message;
      if (message?.role !== 'toolResult' || message.toolName !== 'bash') continue;
      for (const block of message.content ?? []) {
        if (block.type !== 'text') continue;
        for (const outputLine of block.text.split(/\r?\n/)) {
          try {
            const value = JSON.parse(outputLine);
            if (!(value.core_sha256 || value.codec || value.expected_rejection === true)) continue;
            receipts.push({ tool_call_id: message.toolCallId, is_error: !!message.isError,
              receipt: Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])) });
          } catch {}
        }
      }
    } catch {}
  }
  return receipts;
}

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

function structural(report, limits, contract) {
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
  const answer = answerContract(report, contract);
  return { accepted: failures.length === 0 && report.hygiene_findings.length === 0 && answer.accepted, observed, limits, failures, answer_contract: answer };
}

function authorityBoundContract(caseDefinition, checkout) {
  const contract = structuredClone(caseDefinition.answer_contract ?? {});
  if (caseDefinition.id !== 'release-orientation') return contract;
  const authority = JSON.parse(readFileSync(join(checkout, 'agent-release-orientation.json'), 'utf8'));
  assert.match(authority.release?.product_set_sha256 ?? '', /^[0-9a-f]{64}$/);
  contract.allowed_sha256 = [...new Set([
    ...(contract.allowed_sha256 ?? []),
    authority.release.product_set_sha256
  ])];
  return contract;
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
      '--no-mcp',
      '--no-session',
      '--mode', 'json',
      '--tools', 'read,grep,find,ls,bash',
      '--no-skills',
      '--no-prompt-templates',
      '--no-extensions',
      '--approve',
      '-p', `${protocol.session_preamble}\n\nTask: ${caseDefinition.prompt}`
    ], {
      cwd: checkout,
      encoding: 'utf8',
      timeout: input.timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      killSignal: 'SIGTERM'
    });
    const captured_public_files = [];
    for (const path of caseDefinition.capture_public_files ?? []) {
      assert.match(path, /^[A-Za-z0-9._-]+$/);
      try { const bytes = readFileSync(join(checkout, path)); assert.ok(bytes.length <= 65536); captured_public_files.push({path, sha256: createHash('sha256').update(bytes).digest('hex'), utf8: bytes.toString('utf8')}); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const report = evaluateTraceText(result.stdout ?? '', 'general');
    const limits = protocol.cohort_gate.structural_efficiency[caseDefinition.class];
    summary.cases.push({
      id: caseDefinition.id,
      class: caseDefinition.class,
      captured_public_files,
      public_execution_receipts: executionReceipts(result.stdout ?? ''),
      tracked_files_modified: execFileSync('git', ['diff', '--name-only'], { cwd: checkout, encoding: 'utf8' }).trim().split('\n').filter(Boolean),
      process: {
        status: result.status,
        signal: result.signal,
        timed_out: result.error?.code === 'ETIMEDOUT',
        wall_ms: Date.now() - started,
        stderr_characters: (result.stderr ?? '').length,
        stderr_sha256: createHash('sha256').update(result.stderr ?? '').digest('hex')
      },
      structural: structural(report, limits, authorityBoundContract(caseDefinition, checkout)),
      trace: report
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  const current = summary.cases.at(-1);
  mkdirSync(dirname(input.output), { recursive: true });
  writeFileSync(input.output + '.progress.json', `${JSON.stringify({ ...summary, completed: false }, null, 2)}\n`);
  process.stdout.write(`${caseDefinition.id} structural=${current.structural.accepted} timeout=${current.process.timed_out} wall_ms=${current.process.wall_ms}\n`);
}

summary.structural_pass = summary.cases.every(row => row.structural.accepted && !row.process.timed_out && row.process.status === 0 && row.tracked_files_modified.length === 0);
mkdirSync(dirname(input.output), { recursive: true });
writeFileSync(input.output, `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ accepted: summary.structural_pass, output: input.output })}\n`);
if (!summary.structural_pass) process.exitCode = 1;
