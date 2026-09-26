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

function receiptsFor(agent, model) {
  return protocol.cases.map(row => ({
    schema: 'wasmc.fresh-agent-run/v1',
    case_id: row.id,
    agent,
    model,
    release_commit: '0123456789abcdef0123456789abcdef01234567',
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
  { implementation: 'pi', version: '0.87.1' },
  { provider: 'llm-m4dd', identity: 'deepseek-v4.1-flash' }
);
const oneModelReport = evaluateCohort(protocol, oneModel);
assert.equal(oneModelReport.accepted, false);
assert.equal(oneModelReport.checks.exact_model_pair, false);

const cohort = [
  ...oneModel,
  ...receiptsFor(
    { implementation: 'pi', version: '0.87.1' },
    { provider: 'llm-m4dd', identity: 'glm-5.3-flash' }
  )
];
const accepted = evaluateCohort(protocol, cohort);
assert.equal(accepted.accepted, true);
assert.equal(accepted.first_pass_rate, 1);

const splitPiVersion = structuredClone(cohort);
for (const row of splitPiVersion.slice(protocol.cases.length)) row.agent.version = '0.88.0';
const splitPiRejected = evaluateCohort(protocol, splitPiVersion);
assert.equal(splitPiRejected.accepted, false);
assert.equal(splitPiRejected.checks.same_agent_version, false);

const criticalFailure = structuredClone(cohort);
const failed = criticalFailure.find(row => row.case_id === 'position-aware-capability-negative');
failed.oracle_passed = false;
failed.first_final_correct = false;
const rejected = evaluateCohort(protocol, criticalFailure);
assert.equal(rejected.accepted, false);
assert.equal(rejected.checks.all_cases_first_pass, false);

const retryFailure = structuredClone(cohort);
retryFailure[0].trace.retries = 1;
const retryRejected = evaluateCohort(protocol, retryFailure);
assert.equal(retryRejected.accepted, false);
assert.equal(retryRejected.checks.all_cases_first_pass, false);

console.log(JSON.stringify({
  accepted: true,
  schema: protocol.schema,
  cases: protocol.cases.length,
  rejects_single_model_claim: true,
  requires_exact_controlled_pair: true,
  rejects_split_pi_version: true,
  rejects_case_error: true,
  rejects_retry_over_budget: true
}));
