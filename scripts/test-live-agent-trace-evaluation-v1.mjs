import assert from 'node:assert/strict';
import { evaluateTraceText } from './wasmc-live-agent-trace-evaluation-v1.mjs';

const line = value => JSON.stringify(value);
const assistant = (content, usage = {}) => line({
  type: 'message_end',
  message: {
    role: 'assistant',
    provider: 'fixture-provider',
    model: 'fixture-model',
    content,
    usage: { input: 10, output: 5, reasoning: 1, cacheRead: 2, cacheWrite: 0, ...usage },
    timestamp: 2
  }
});
const toolResult = (text, isError = false) => line({
  type: 'message_end',
  message: { role: 'toolResult', toolName: 'read', isError, content: [{ type: 'text', text }], timestamp: 3 }
});

const good = [
  line({ type: 'session', id: 'good', timestamp: 1 }),
  assistant([{ type: 'toolCall', name: 'read', arguments: { path: 'release.json' } }]),
  toolResult('{"tag":"v0.0.13"}'),
  assistant([{ type: 'text', text: 'Pinned release v0.0.13; full digest 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.' }])
].join('\n');
const goodReport = evaluateTraceText(good, 'status-query');
assert.equal(goodReport.accepted, true);
assert.equal(goodReport.tool_calls.length, 1);
assert.equal(goodReport.error_results, 0);
assert.deepEqual(goodReport.hygiene_findings, []);

const repeated = { type: 'toolCall', name: 'read', arguments: { path: 'release.json' } };
const bad = [
  line({ type: 'session', id: 'bad', timestamp: 1 }),
  assistant([repeated]),
  toolResult('No matches found'),
  assistant([repeated]),
  toolResult('permission denied', true),
  line({ type: 'retry', willRetry: true, timestamp: 4 }),
  assistant([{ type: 'text', text: 'Use digest 01234567... and Node 22+.' }])
].join('\n');
const badReport = evaluateTraceText(bad, 'status-query');
assert.equal(badReport.accepted, false);
assert.equal(badReport.exact_duplicate_calls.length, 1);
assert.equal(badReport.repeated_reads.length, 1);
assert.equal(badReport.error_results, 1);
assert.equal(badReport.retries, 1);
assert.deepEqual(badReport.hygiene_findings.sort(), [
  'ellipsized-identity',
  'inferred-engine-version-range'
]);

const missingAnswer = [
  line({ type: 'session', id: 'missing-answer', timestamp: 1 }),
  assistant([{ type: 'toolCall', name: 'read', arguments: { path: 'release.json' } }]),
  toolResult('x'.repeat(60001))
].join('\n');
const missingAnswerReport = evaluateTraceText(missingAnswer, 'status-query');
assert.equal(missingAnswerReport.accepted, false);
assert.ok(missingAnswerReport.hygiene_findings.includes('missing-final-answer'));
assert.ok(missingAnswerReport.budget_failures.some(row => row.metric === 'tool_result_characters'));

const negatedRange = [
  line({ type: 'session', id: 'negated-range', timestamp: 1 }),
  assistant([{ type: 'text', text: 'Exact versions are observations; never infer Node 22+.' }])
].join('\n');
const negatedRangeReport = evaluateTraceText(negatedRange, 'status-query');
assert.equal(negatedRangeReport.accepted, true);
assert.deepEqual(negatedRangeReport.hygiene_findings, []);

console.log(JSON.stringify({
  accepted: true,
  schema: goodReport.schema,
  profiles: ['general', 'status-query'],
  negative_signals: 9
}));
