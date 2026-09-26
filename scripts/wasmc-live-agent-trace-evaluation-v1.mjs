import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const profiles = {
  general: {
    max_tool_calls: 32,
    max_assistant_turns: 20,
    max_tool_result_characters: 200000,
    max_error_results: 0,
    max_retries: 1,
    max_exact_duplicate_calls: 0,
    max_repeated_reads: 1,
    max_zero_yield_results: 4
  },
  'status-query': {
    max_tool_calls: 8,
    max_assistant_turns: 6,
    max_tool_result_characters: 60000,
    max_error_results: 0,
    max_retries: 0,
    max_exact_duplicate_calls: 0,
    max_repeated_reads: 0,
    max_zero_yield_results: 1
  }
};

function parseArgs(argv) {
  const options = { trace: null, profile: 'general', jsonOut: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--trace') options.trace = argv[++index];
    else if (value === '--profile') options.profile = argv[++index];
    else if (value === '--json-out') options.jsonOut = argv[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  if (!profiles[options.profile]) throw new Error(`unknown profile: ${options.profile}`);
  return options;
}

function timestamp(value) {
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function resultText(message) {
  return (message.content ?? []).map(item => item.text ?? '').join('');
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

export function evaluateTraceText(input, profileName = 'general') {
  const profile = profiles[profileName];
  const report = {
    schema: 'wasmc.live-agent-trace-evaluation/v1',
    profile: profileName,
    provider: null,
    model: null,
    session_id: null,
    parse_errors: 0,
    assistant_turns: 0,
    tool_calls: [],
    tool_results: 0,
    tool_result_characters: 0,
    error_results: 0,
    zero_yield_results: 0,
    retries: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0 },
    elapsed_ms: null,
    final_answer: { characters: 0, sha256: null, text: '' },
    hygiene_findings: []
  };
  let started = null;
  let ended = null;
  let finalAnswer = '';
  for (const line of input.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); }
    catch { report.parse_errors += 1; continue; }
    const eventTime = timestamp(event.timestamp ?? event.message?.timestamp);
    if (eventTime !== null) {
      started = started === null ? eventTime : Math.min(started, eventTime);
      ended = ended === null ? eventTime : Math.max(ended, eventTime);
    }
    if (event.type === 'session') report.session_id = event.id ?? report.session_id;
    if (event.willRetry === true) report.retries += 1;
    if (event.type !== 'message_end' || !event.message) continue;
    const message = event.message;
    if (message.role === 'assistant') {
      report.assistant_turns += 1;
      report.provider ??= message.provider ?? null;
      report.model ??= message.model ?? null;
      const usage = message.usage ?? {};
      report.tokens.input += usage.input ?? 0;
      report.tokens.output += usage.output ?? 0;
      report.tokens.reasoning += usage.reasoning ?? 0;
      report.tokens.cache_read += usage.cacheRead ?? 0;
      report.tokens.cache_write += usage.cacheWrite ?? 0;
      for (const item of message.content ?? []) {
        if (item.type === 'toolCall') {
          report.tool_calls.push({ name: item.name, arguments: item.arguments ?? {} });
        } else if (item.type === 'text') finalAnswer = item.text;
      }
    } else if (message.role === 'toolResult') {
      const text = resultText(message);
      report.tool_results += 1;
      report.tool_result_characters += text.length;
      if (message.isError) report.error_results += 1;
      if (/^\s*(?:no matches?(?: found)?|no files?(?: found)?|\[\]|)\s*$/i.test(text)) {
        report.zero_yield_results += 1;
      }
    }
  }
  report.elapsed_ms = started !== null && ended !== null ? ended - started : null;
  report.final_answer.characters = finalAnswer.length;
  report.final_answer.text = finalAnswer;
  report.final_answer.sha256 = finalAnswer
    ? createHash('sha256').update(finalAnswer).digest('hex')
    : null;
  if (!finalAnswer.trim()) report.hygiene_findings.push('missing-final-answer');
  const signatures = report.tool_calls.map(call => `${call.name}:${JSON.stringify(call.arguments)}`);
  report.exact_duplicate_calls = countBy(signatures);
  const reads = report.tool_calls
    .filter(call => call.name === 'read' && typeof call.arguments.path === 'string')
    .map(call => call.arguments.path);
  report.repeated_reads = countBy(reads);
  if (/[0-9a-f]{8,}(?:\.{3}|…)[0-9a-f]*/i.test(finalAnswer)) {
    report.hygiene_findings.push('ellipsized-identity');
  }
  const claimedEngineRange = finalAnswer.split(/\r?\n/).some(line =>
    /\b(?:Node|Deno|Bun|Wasmi|Wasmtime)\s+v?\d+(?:\.\d+){0,2}\+/i.test(line) &&
    !/\b(?:never|do not|don't|must not|avoid|forbid(?:den)?|reject(?:ed)?|unsupported|invalid)\b/i.test(line)
  );
  if (claimedEngineRange) {
    report.hygiene_findings.push('inferred-engine-version-range');
  }
  if (report.parse_errors) report.hygiene_findings.push('non-json-trace-lines');
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
  report.budget = { limits: profile, observed };
  report.budget_failures = Object.entries(profile)
    .filter(([key, limit]) => observed[key.slice(4)] > limit)
    .map(([key, limit]) => ({ metric: key.slice(4), observed: observed[key.slice(4)], limit }));
  report.accepted = report.budget_failures.length === 0 && report.hygiene_findings.length === 0;
  return report;
}

function absolute(path) {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const options = parseArgs(process.argv.slice(2));
  const input = readFileSync(options.trace ? absolute(options.trace) : 0, 'utf8');
  const report = evaluateTraceText(input, options.profile);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.jsonOut) {
    const outputPath = absolute(options.jsonOut);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, output);
  }
  process.stdout.write(output);
  if (!report.accepted) process.exitCode = 1;
}
