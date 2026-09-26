#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { evaluateTraceText } from './wasmc-live-agent-trace-evaluation-v1.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const protocol = JSON.parse(readFileSync(new URL('../agent-evaluation/fresh-agent-learning-v1.json', import.meta.url), 'utf8'));
const prompt = 'Using only this pinned public checkout, answer whether ordinary-source u64 is fixed or supported now. Lead with one sentence that distinguishes the exact producer master implementation from the current immutable release, report qualified/admitted/released/discoverable/installable for the release capability, and state the status of u32 and char. Do not generate source or infer a future release.';

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
  out.output ??= join(root, 'target/fresh-agent', out.commit, out.model.split('/').at(-1), 'producer-release-u64-delta.json');
  out.output = isAbsolute(out.output) ? out.output : resolve(process.cwd(), out.output);
  return out;
}

function semanticOracle(answer) {
  const normalized = answer.replace(/\s+/g, ' ');
  const opening = normalized.slice(0, 420);
  const checks = {
    exact_producer_commit: answer.includes('94328ed760f93bf24b595a71facdcc773d43b762'),
    producer_implemented: /producer[^\n]*(?:implement|support)|(?:implement|support)[^\n]*producer/i.test(answer),
    immutable_release_named: answer.includes('v0.0.13'),
    opening_authority_split: /producer/i.test(opening) && /v0\.0\.13/i.test(opening) &&
      /(?:implement|support|yes|已实现)/i.test(opening) && /(?:unsupported|not contain|no|不支持|未包含)/i.test(opening),
    release_u64_unsupported: /v0\.0\.13.{0,240}(?:unsupported|不支持|does not contain|not contained|未包含)|(?:unsupported|不支持|does not contain|not contained|未包含).{0,240}v0\.0\.13/i.test(normalized),
    five_false_states: ['qualified', 'admitted', 'released', 'discoverable', 'installable'].every(state =>
      new RegExp(`${state}[^\\n]{0,24}(?:false|否|未)`, 'i').test(answer)
    ),
    u32_already_released: /u32[^\n]*(?:already[^\n]*released|已(?:经)?发布|v0\.0\.13)/i.test(answer),
    char_not_implemented: /char[^\n]*(?:not implemented|unsupported|未实现|不支持)/i.test(answer),
    no_source_block: !/```(?:wasmc|rust|wit|javascript|js)?/i.test(answer)
  };
  return { accepted: Object.values(checks).every(Boolean), checks };
}

const input = options(process.argv.slice(2));
const temporary = mkdtempSync(join(tmpdir(), 'wasmc-pi-u64-delta-'));
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
    '-p', prompt
  ], {
    cwd: checkout,
    encoding: 'utf8',
    timeout: input.timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    killSignal: 'SIGTERM'
  });
  const trace = evaluateTraceText(result.stdout ?? '', 'status-query');
  const oracle = semanticOracle(trace.final_answer.text);
  const [provider, identity] = input.model.split('/', 2);
  const receipt = {
    schema: 'wasmc.pi-producer-release-delta/v1',
    guidance_commit: input.commit,
    agent: { implementation: 'pi', version: execFileSync('pi', ['--version'], { encoding: 'utf8' }).trim() },
    model: { provider, identity },
    prompt_sha256: createHash('sha256').update(prompt).digest('hex'),
    process: {
      status: result.status,
      signal: result.signal,
      timed_out: result.error?.code === 'ETIMEDOUT',
      wall_ms: Date.now() - started,
      stderr_characters: (result.stderr ?? '').length,
      stderr_sha256: createHash('sha256').update(result.stderr ?? '').digest('hex')
    },
    structural: {
      accepted: trace.accepted,
      budget: trace.budget,
      hygiene_findings: trace.hygiene_findings,
      tokens: trace.tokens,
      provider: trace.provider,
      model: trace.model
    },
    semantic_oracle: oracle,
    final_answer: {
      characters: trace.final_answer.characters,
      sha256: trace.final_answer.sha256
    },
    raw_trace_retained: false,
    hidden_reasoning_retained: false,
    accepted: result.status === 0 && !result.error && trace.accepted && oracle.accepted
  };
  mkdirSync(dirname(input.output), { recursive: true });
  writeFileSync(input.output, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${trace.final_answer.text}\n`);
  process.stdout.write(`${JSON.stringify({ accepted: receipt.accepted, output: input.output, semantic_oracle: oracle, structural: trace.budget.observed })}\n`);
  if (!receipt.accepted) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
