import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const protocolPath = fileURLToPath(new URL('../agent-evaluation/fresh-agent-learning-v1.json', import.meta.url));

export function readProtocol(path = protocolPath) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function validateProtocol(protocol) {
  assert.equal(protocol.schema, 'wasmc.fresh-agent-learning/v1');
  assert.match(protocol.objective, /fresh Pi Agent/);
  assert.ok(protocol.authority_scope.forbidden.includes('private wasmc source or private handoffs'));
  assert.ok(protocol.authority_scope.forbidden.includes('prior conversation or session state'));
  assert.equal(protocol.cases.length, 6);
  assert.equal(new Set(protocol.cases.map(row => row.id)).size, protocol.cases.length);
  assert.ok(protocol.cases.every(row => typeof row.prompt === 'string' && row.prompt.length > 40));
  assert.ok(protocol.cases.some(row => row.class === 'decision' && row.critical));
  assert.ok(protocol.cases.some(row => row.class === 'execution' && row.critical));
  const gate = protocol.cohort_gate;
  assert.equal(gate.agent_implementation, 'pi');
  assert.deepEqual(gate.required_models, [
    { provider: 'llm-m4dd', identity: 'deepseek-v4.1-flash' },
    { provider: 'llm-m4dd', identity: 'glm-5.3-flash' }
  ]);
  assert.equal(gate.required_combinations, 2);
  assert.equal(gate.require_same_agent_version, true);
  assert.equal(gate.require_same_release_commit, true);
  assert.equal(gate.require_every_case_per_model, true);
  assert.equal(gate.require_all_cases_first_pass, true);
  for (const profile of ['decision', 'execution']) {
    assert.equal(gate.structural_efficiency[profile].max_error_results, 0);
    assert.equal(gate.structural_efficiency[profile].max_retries, 0);
    assert.equal(gate.structural_efficiency[profile].max_exact_duplicate_calls, 0);
  }
  assert.match(gate.wall_clock_policy, /do not use provider or network latency alone/);
  assert.match(protocol.change_control.no_overfit, /one named model/);
  return protocol;
}

function withinEfficiency(observed, limits) {
  return Object.entries(limits).every(([key, limit]) => observed[key.replace(/^max_/, '')] <= limit);
}

export function evaluateCohort(protocol, receipts) {
  validateProtocol(protocol);
  const caseById = new Map(protocol.cases.map(row => [row.id, row]));
  for (const receipt of receipts) {
    assert.equal(receipt.schema, 'wasmc.fresh-agent-run/v1');
    assert.ok(caseById.has(receipt.case_id), `unknown case: ${receipt.case_id}`);
    assert.ok(receipt.agent?.implementation && receipt.agent?.version);
    assert.ok(receipt.model?.provider && receipt.model?.identity);
    assert.ok(receipt.release_commit && receipt.session_is_fresh === true);
    assert.equal(receipt.agent.implementation, protocol.cohort_gate.agent_implementation);
    assert.ok(['deterministic', 'independent-review'].includes(receipt.oracle_evaluator));
    assert.match(receipt.evidence_sha256 ?? '', /^[0-9a-f]{64}$/);
  }

  const combinationKey = receipt => [
    receipt.agent.implementation,
    receipt.agent.version,
    receipt.model.provider,
    receipt.model.identity,
    receipt.release_commit
  ].join('\u0000');
  const combinations = new Map();
  for (const receipt of receipts) {
    const key = combinationKey(receipt);
    const rows = combinations.get(key) ?? [];
    rows.push(receipt);
    combinations.set(key, rows);
  }

  const requiredCaseIds = new Set(protocol.cases.map(row => row.id));
  const combinationReports = [...combinations.entries()].map(([key, rows]) => {
    const seen = new Set(rows.map(row => row.case_id));
    const complete = rows.length === requiredCaseIds.size && requiredCaseIds.size === seen.size && [...requiredCaseIds].every(id => seen.has(id));
    const evaluated = rows.map(row => {
      const caseDefinition = caseById.get(row.case_id);
      const efficient = withinEfficiency(row.trace, protocol.cohort_gate.structural_efficiency[caseDefinition.class]);
      const firstPass = row.oracle_passed === true && row.first_final_correct === true && efficient;
      return { ...row, critical: caseDefinition.critical, efficient, first_pass: firstPass };
    });
    return {
      key,
      complete,
      passed: complete && evaluated.every(row => row.first_pass),
      cases: evaluated
    };
  });

  const allCases = combinationReports.flatMap(row => row.cases);
  const agentVersions = new Set(receipts.map(row => row.agent.version));
  const releaseCommits = new Set(receipts.map(row => row.release_commit));
  const models = new Set(receipts.map(row => `${row.model.provider}\u0000${row.model.identity}`));
  const requiredModels = new Set(protocol.cohort_gate.required_models.map(row => `${row.provider}\u0000${row.identity}`));
  const firstPassRate = allCases.length ? allCases.filter(row => row.first_pass).length / allCases.length : 0;
  const gate = protocol.cohort_gate;
  const checks = {
    exact_model_pair: models.size === requiredModels.size && [...requiredModels].every(key => models.has(key)),
    combinations: combinationReports.length === gate.required_combinations,
    same_agent_version: !gate.require_same_agent_version || agentVersions.size === 1,
    same_release_commit: !gate.require_same_release_commit || releaseCommits.size === 1,
    complete_models: !gate.require_every_case_per_model || combinationReports.every(row => row.complete),
    all_cases_first_pass: !gate.require_all_cases_first_pass || combinationReports.every(row => row.passed)
  };
  return {
    schema: 'wasmc.fresh-agent-cohort-evaluation/v1',
    accepted: Object.values(checks).every(Boolean),
    checks,
    counts: {
      agent_versions: agentVersions.size,
      model_identities: models.size,
      combinations: combinationReports.length,
      cases: allCases.length
    },
    first_pass_rate: firstPassRate,
    combinations: combinationReports
  };
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) {
  const protocol = validateProtocol(readProtocol());
  const args = process.argv.slice(2);
  let receiptsPath = null;
  let jsonOut = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--receipts') receiptsPath = args[++index];
    else if (args[index] === '--json-out') jsonOut = args[++index];
    else throw new Error(`unknown argument: ${args[index]}`);
  }
  const report = receiptsPath
    ? evaluateCohort(protocol, JSON.parse(readFileSync(resolve(receiptsPath), 'utf8')))
    : { accepted: true, schema: protocol.schema, cases: protocol.cases.length, cohort_gate: protocol.cohort_gate };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (jsonOut) {
    const outputPath = resolve(jsonOut);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, output);
  }
  process.stdout.write(output);
  if (!report.accepted) process.exitCode = 1;
}
