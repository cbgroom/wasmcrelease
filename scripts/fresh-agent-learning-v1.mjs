import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { requiresPrivateHelperQualification } from './current-release-version.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const predecessorPath = 'agent-evaluation/fresh-agent-learning-v2.json';
const predecessorSha256 = '31de0e1094291d4e936f456f98f946b0c0623c024753a361abc02d5180e1c91d';
export const protocolRelativePath = version => requiresPrivateHelperQualification(version)
  ? 'agent-evaluation/fresh-agent-learning-v3.json' : predecessorPath;
const currentVersion = JSON.parse(readFileSync(new URL('../current/compiler-release.json', import.meta.url))).version;
export const protocolPath = fileURLToPath(new URL('../' + protocolRelativePath(currentVersion), import.meta.url));
export const protocolDigest = protocol => hash(JSON.stringify(protocol, null, 2) + '\n');

export function loadBoundProtocol(read) {
  const compiler = JSON.parse(read('current/compiler-release.json'));
  const path = protocolRelativePath(compiler.version), bytes = read(path);
  const protocol = validateProtocol(JSON.parse(bytes));
  assert.equal(protocol.schema, requiresPrivateHelperQualification(compiler.version)
    ? 'wasmc.fresh-agent-learning/v3' : 'wasmc.fresh-agent-learning/v2', 'selected protocol schema mismatch');
  if (protocol.schema === 'wasmc.fresh-agent-learning/v3') {
    const binding = protocol.release_binding;
    assert.equal(hash(read(predecessorPath)), predecessorSha256, 'checkout predecessor protocol drift');
    assert.equal(binding.version, compiler.version);
    assert.equal(binding.compiler_sha256, compiler.compiler.sha256);
    assert.equal(binding.compiler_sha256, hash(read('current/wasmc_compiler.wasm')));
    assert.equal(binding.facade_sha256, hash(read('current/wasmc.mjs')));
    assert.equal(binding.catalog_sha256, hash(read('catalog/libs-current-v2.json')));
    assert.equal(hash(bytes), protocolDigest(protocol), 'canonical protocol bytes required');
  }
  return {path, sha256:hash(bytes), protocol};
}

export function readProtocol(path = protocolPath) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function validateProtocol(protocol) {
  assert.ok(['wasmc.fresh-agent-learning/v2','wasmc.fresh-agent-learning/v3'].includes(protocol.schema));
  if (protocol.schema === 'wasmc.fresh-agent-learning/v3') {
    const binding = protocol.release_binding;
    assert.deepEqual(Object.keys(binding).sort(), ['catalog_sha256','compiler_sha256','facade_sha256','predecessor_protocol','predecessor_sha256','version']);
    assert.equal(protocolRelativePath(binding.version), 'agent-evaluation/fresh-agent-learning-v3.json');
    for (const key of ['catalog_sha256','compiler_sha256','facade_sha256']) assert.match(binding[key], /^[0-9a-f]{64}$/);
    assert.equal(binding.predecessor_protocol, predecessorPath); assert.equal(binding.predecessor_sha256, predecessorSha256);
    const priorBytes = readFileSync(new URL('../' + predecessorPath, import.meta.url));
    assert.equal(hash(priorBytes), predecessorSha256, 'frozen predecessor protocol drift');
    const expected = JSON.parse(priorBytes);
    expected.schema = protocol.schema; expected.release_binding = structuredClone(binding);
    const identities = new Map([
      ['v0.0.22', 'v' + binding.version],
      ['620a6b5f7b9a4565f14857975e37a03196f8f7e4279a2f4da388882638f2a658',binding.compiler_sha256],
      ['cdeb9f96d86a8718b8918ea39c1ee3eca486cfa5ae5a101e2da10f69053be447',binding.facade_sha256],
      ['76f9a0ca465c7d6169738be04ac725dceac2cdde14bbfc5215c37c2e97c86f43',binding.catalog_sha256]
    ]);
    for (const row of expected.cases) for (const key of ['required_literals','allowed_sha256']) {
      if (row.answer_contract?.[key]) row.answer_contract[key] = row.answer_contract[key].map(value => identities.get(value) ?? value);
    }
    assert.deepEqual(protocol, expected, 'v3 changes only release identities; frozen prompts, oracles and budgets required');
  }
  assert.match(protocol.objective, /fresh Pi Agent/);
  assert.match(protocol.session_preamble, /First read AGENTS\.md/);
  assert.match(protocol.session_preamble, /required_additional_reads/);
  assert.ok(protocol.authority_scope.forbidden.includes('private wasmc source or private handoffs'));
  assert.ok(protocol.authority_scope.forbidden.includes('prior conversation or session state'));
  assert.equal(protocol.cases.length, 6);
  assert.equal(new Set(protocol.cases.map(row => row.id)).size, protocol.cases.length);
  assert.ok(protocol.cases.every(row => typeof row.prompt === 'string' && row.prompt.length > 40));
  assert.ok(protocol.cases.some(row => row.class === 'decision' && row.critical));
  assert.ok(protocol.cases.some(row => row.class === 'execution' && row.critical));
  for (const row of protocol.cases.filter(row => row.answer_contract)) {
    assert.ok(Array.isArray(row.answer_contract.required_literals));
    assert.ok(row.answer_contract.required_literals.every(value => typeof value === 'string' && value.length > 0));
    if (row.answer_contract.allowed_sha256) assert.ok(row.answer_contract.allowed_sha256.every(value => /^[0-9a-f]{64}$/.test(value)));
    if (row.answer_contract.allowed_identity_tokens) assert.ok(row.answer_contract.allowed_identity_tokens.every(value => typeof value === 'string' && value.length > 0));
  }
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

export function answerContract(report, contract = {}) {
  const answer = report.final_answer?.text ?? '';
  const failures = [];
  for (const literal of contract.required_literals ?? []) {
    if (!answer.includes(literal)) failures.push({ metric: 'required_literal', expected: literal });
  }
  for (const literal of contract.forbidden_literals ?? []) {
    if (answer.includes(literal)) failures.push({ metric: 'forbidden_literal', observed: literal });
  }
  const digests = [...answer.matchAll(/\b[0-9a-f]{40,}\b/gi)].map(row => row[0].toLowerCase());
  if (contract.allowed_sha256) {
    const allowed = new Set(contract.allowed_sha256);
    for (const digest of digests) {
      if (digest.length === 40) continue; // Exact Git SHA-1 identities are not SHA-256 claims.
      if (digest.length !== 64) failures.push({ metric: 'invalid_sha256_length', observed: digest });
      else if (!allowed.has(digest)) failures.push({ metric: 'unknown_sha256', observed: digest });
    }
  }
  // Machine identities are lowercase. Do not classify prose such as "WAsmC-source" as a package token.
  const identities = [...answer.matchAll(/(?<![a-z0-9:-])(?:wasmc|wamsc|wasc)(?::|-)[a-z0-9][a-z0-9.-]*(?:@\d+\.\d+\.\d+)?\b/g)].map(row => row[0]);
  if (contract.allowed_identity_tokens) {
    const allowed = new Set(contract.allowed_identity_tokens);
    for (const identity of identities) if (!allowed.has(identity)) failures.push({ metric: 'unknown_identity', observed: identity });
  }
  return { accepted: failures.length === 0, observed: { digests, identities }, failures };
}

export function executionEvidenceContract(report, caseClass) {
  const completedCommands = (report.tool_outcomes ?? []).filter(row =>
    row.name === 'bash' && row.matched_call === true && row.is_error === false
  ).length;
  return {
    accepted: caseClass !== 'execution' || completedCommands > 0,
    completed_commands: completedCommands,
    scope: 'Minimum completed command evidence; independent review must still verify compilation, import inspection and behavior required by the task.'
  };
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
