import assert from 'node:assert/strict';
import { answerContract, evaluateCohort, executionEvidenceContract, readProtocol, validateProtocol, loadBoundProtocol, protocolDigest, protocolRelativePath } from './fresh-agent-learning-v1.mjs';
import { evaluateTraceText } from './wasmc-live-agent-trace-evaluation-v1.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const protocol = validateProtocol(readProtocol());
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const bound=loadBoundProtocol(read);
assert.equal(bound.sha256,protocolDigest(protocol));
assert.equal(bound.path,protocolRelativePath(protocol.release_binding.version));
const predecessor=read('agent-evaluation/fresh-agent-learning-v2.json');
assert.equal(createHash('sha256').update(predecessor).digest('hex'),'31de0e1094291d4e936f456f98f946b0c0623c024753a361abc02d5180e1c91d');
assert.equal(validateProtocol(JSON.parse(predecessor)).schema,'wasmc.fresh-agent-learning/v2');
let bindingControls=0;
for(const mutate of [
  p=>p.cases[0].prompt+=' Changed meaning.',
  p=>p.cases[0].oracle+=' Relaxed.',
  p=>p.session_preamble+=' Hint.',
  p=>p.cohort_gate.structural_efficiency.execution.max_tool_calls++,
  p=>p.cohort_gate.required_models.pop(),
  p=>p.release_binding.predecessor_sha256='0'.repeat(64),
  p=>p.cases[0].answer_contract.required_literals[0]='v0.0.22',
  p=>p.cases[4].answer_contract.allowed_sha256.push('0'.repeat(64))
]){const p=structuredClone(protocol);mutate(p);assert.throws(()=>validateProtocol(p));bindingControls++;}
for(const path of ['current/wasmc_compiler.wasm','current/wasmc.mjs','catalog/libs-current-v2.json','agent-evaluation/fresh-agent-learning-v2.json']){
  assert.throws(()=>loadBoundProtocol(p=>p===path?Buffer.concat([read(p),Buffer.from('x')]):read(p)));bindingControls++;
}
assert.throws(()=>loadBoundProtocol(p=>p===bound.path?predecessor:read(p)));bindingControls++;
const exactAnswer = answerContract({final_answer:{text:'wasmc:std@1.4.0 d565f00e91c36da68da3645ec5231dd11d1b25299a3ba5cbe3adbd9f5760d91d'}},{
  required_literals:['wasmc:std@1.4.0'],
  allowed_sha256:['d565f00e91c36da68da3645ec5231dd11d1b25299a3ba5cbe3adbd9f5760d91d'],
  allowed_identity_tokens:['wasmc:std@1.4.0']
});
assert.equal(exactAnswer.accepted,true);
assert.equal(answerContract({final_answer:{text:'open the roughly 54 KB release.json inventory'}},{forbidden_literals:['release.json inventory','roughly 54 KB']}).accepted,false);
assert.equal(answerContract({final_answer:{text:'candidate ac35f039f28e2f5715b2cea7d2ac3fa5bebf103c d565f00e91c36da68da3645ec5231dd11d1b25299a3ba5cbe3adbd9f5760d91d'}},{allowed_sha256:['d565f00e91c36da68da3645ec5231dd11d1b25299a3ba5cbe3adbd9f5760d91d']}).accepted,true);
assert.equal(answerContract({final_answer:{text:'wamsc-system-telemetry@0.0.1'}},{allowed_identity_tokens:['wasmc-system-telemetry@0.0.1']}).accepted,false);
assert.equal(answerContract({final_answer:{text:'wasc-system-telemetry@0.0.1'}},{allowed_identity_tokens:['wasmc-system-telemetry@0.0.1']}).accepted,false);
assert.equal(answerContract({final_answer:{text:'Direct WAsmC-source use'}},{allowed_identity_tokens:[]}).accepted,true);
assert.equal(answerContract({final_answer:{text:'Internal lookup key direct-wasmc-system-telemetry-resource.'}},{allowed_identity_tokens:[]}).accepted,true);
assert.equal(answerContract({final_answer:{text:'wasmc-system-telemetry-resource'}},{allowed_identity_tokens:[]}).accepted,false);
assert.equal(answerContract({final_answer:{text:'wasmc:system-telemetry@0.0.1'}},{allowed_identity_tokens:['wasmc:system-telemetry@0.0.1']}).accepted,true);
assert.equal(answerContract({final_answer:{text:'d565f00e91c36da68da68da3645ec5231dd11d1b25299a3ba5cbe3adbd9f5760d91d'}},{allowed_sha256:['d565f00e91c36da68da3645ec5231dd11d1b25299a3ba5cbe3adbd9f5760d91d']}).accepted,false);
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

function commandTrace({name = 'bash', returnedName = name, isError = false, returnedId = 'command-one', result = true} = {}) {
  const events = [{type:'message_end',message:{role:'assistant',stopReason:'toolUse',content:[
    {type:'toolCall',id:'command-one',name,arguments:{command:'node caller.mjs'}}
  ]}}];
  if (result) events.push({type:'message_end',message:{role:'toolResult',toolName:returnedName,toolCallId:returnedId,isError,content:[{type:'text',text:'imports=[]; result=[-7,true]'}]}});
  events.push({type:'message_end',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'Observed imports=[] and result=[-7,true].'}]}});
  return evaluateTraceText(events.map(JSON.stringify).join('\n'));
}
assert.equal(executionEvidenceContract(commandTrace(), 'execution').accepted, true);
for (const options of [{name:'read'},{isError:true},{returnedId:'unmatched'},{returnedName:'read'},{result:false}]) {
  assert.equal(executionEvidenceContract(commandTrace(options), 'execution').accepted, false);
}
assert.equal(executionEvidenceContract(commandTrace({name:'read'}), 'decision').accepted, true);
const finalPlanning = evaluateTraceText(JSON.stringify({type:'message_end',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'I will compile and execute it next.'}]}}));
assert.equal(executionEvidenceContract(finalPlanning, 'execution').accepted, false);

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
  rejects_retry_over_budget: true,
  minimum_execution_evidence_controls: 8,
  protocol_binding_controls: bindingControls
}));
