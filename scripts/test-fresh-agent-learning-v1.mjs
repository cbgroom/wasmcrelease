import assert from 'node:assert/strict';
import { evaluateCohort, readProtocol, validateProtocol } from './fresh-agent-learning-v1.mjs';

const protocol = validateProtocol(readProtocol());
const traceFor = caseClass => ({
  tool_calls: caseClass === 'decision' ? 2 : 5,
  assistant_turns: caseClass === 'decision' ? 2 : 4,
  tool_result_characters: caseClass === 'decision' ? 12000 : 30000,
  error_results: 0,
  retries: 0,
  exact_duplicate_calls: 0,
  repeated_reads: 0,
  zero_yield_results: 0
});

function receiptsFor(agent, model, cohortRole = 'development') {
  return protocol.cases.map(row => ({
    schema: 'wasmc.fresh-agent-run/v1',
    case_id: row.id,
    agent,
    model,
    release_commit: '0123456789abcdef0123456789abcdef01234567',
    cohort_role: cohortRole,
    session_is_fresh: true,
    oracle_passed: true,
    first_final_correct: true,
    oracle_evaluator: row.class === 'execution' ? 'deterministic' : 'independent-review',
    evidence_sha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    trace: traceFor(row.class),
    elapsed_ms: 1000
  }));
}

const oneModel = receiptsFor(
  { implementation: 'agent-a', version: '1.0.0' },
  { provider: 'provider-a', identity: 'model-a' }
);
const oneModelReport = evaluateCohort(protocol, oneModel);
assert.equal(oneModelReport.accepted, false);
assert.equal(oneModelReport.checks.agent_implementations, false);
assert.equal(oneModelReport.checks.model_identities, false);

const cohort = [
  ...oneModel,
  ...receiptsFor(
    { implementation: 'agent-a', version: '1.0.0' },
    { provider: 'provider-b', identity: 'model-b' }
  ),
  ...receiptsFor(
    { implementation: 'agent-b', version: '2.0.0' },
    { provider: 'provider-a', identity: 'model-a' }
  ),
  ...receiptsFor(
    { implementation: 'agent-b', version: '2.0.0' },
    { provider: 'provider-c', identity: 'model-c' },
    'blind-holdout'
  )
];
const accepted = evaluateCohort(protocol, cohort);
assert.equal(accepted.accepted, true);
assert.equal(accepted.first_pass_rate, 1);

const criticalFailure = structuredClone(cohort);
const failed = criticalFailure.find(row => row.case_id === 'position-aware-capability-negative');
failed.oracle_passed = false;
failed.first_final_correct = false;
const rejected = evaluateCohort(protocol, criticalFailure);
assert.equal(rejected.accepted, false);
assert.equal(rejected.checks.critical_cases, false);

const retryFailure = structuredClone(cohort);
for (const row of retryFailure.slice(0, protocol.cases.length)) row.trace.retries = 1;
const retryRejected = evaluateCohort(protocol, retryFailure);
assert.equal(retryRejected.accepted, false);
assert.equal(retryRejected.checks.first_pass_rate, false);

console.log(JSON.stringify({
  accepted: true,
  schema: protocol.schema,
  cases: protocol.cases.length,
  rejects_single_model_claim: true,
  rejects_critical_error: true,
  rejects_retry_over_budget: true
}));
