// Local maintainer tooling is an explicit input, not a runtime fallback or a
// public CI dependency on private compiler source.
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { generatedLib, selectedRun } from './generated-lib-v2.mjs';
import { atomicJson, command, sha } from './lib-refresh-cache-v2.mjs';
import { checkQ2Evidence } from './lib-q2-evidence-v2.mjs';

const args=process.argv.slice(2);
function option(name) {
  const i=args.indexOf(name);assert.ok(i>=0&&args[i+1], 'required '+name);return args[i+1];
}
const run=selectedRun(args), id=option('--id');
assert.match(id,/^[a-z0-9-]+$/);
const caseSet=args.includes('--case-set')?option('--case-set'):id;
assert.match(caseSet,/^[a-z0-9-]+$/);
const tooling=JSON.parse(await readFile(option('--tooling')));
assert.equal(tooling.schema,'wasmc.local-q2-tooling/v2');
assert.equal(tooling.test_source_sha256,
  sha(await readFile('tests/lib-refresh/q2/native-value-runner.rs')),
  'tooling does not correspond to the current authored Q2 harness');
for(const key of ['runner','provider','merge_tool']) {
  const value=tooling[key];assert.ok(value&&isAbsolute(value.path),'absolute '+key+' required');
  assert.match(value.sha256,/^[a-f0-9]{64}$/);
  assert.equal(sha(await readFile(value.path)),value.sha256,key+' digest mismatch');
}
const selected=await generatedLib(id,run);
assert.equal(selected.row.profile,'value','this harness qualifies value Core calls only');
const source=resolve('tests/lib-refresh/q2/'+caseSet+'.wasmc');
const cases=resolve('tests/lib-refresh/q2/'+caseSet+'.cases.json');
const rounds=args.includes('--rounds')?Number(option('--rounds')):1;
assert.ok(Number.isSafeInteger(rounds)&&rounds>=1&&rounds<=128,'rounds must be 1..128');
const caseRows=JSON.parse(await readFile(cases));
const attempt=await mkdtemp(join(run,'ordinary-q2-'+id+'-'));
const plan={root:{path:selected.root,manifest_sha256:selected.row.manifest_sha256},
  source,cases,rounds,provider:tooling.provider,merge_tool:tooling.merge_tool};
await atomicJson(join(attempt,'input.json'),plan);
const receipt={schema:'wasmc.generated-ordinary-q2-attempt/v2',accepted:false,id,
  case_set:caseSet,
  refresh_receipt_sha256:selected.receipt_sha256,manifest_sha256:selected.row.manifest_sha256,
  tooling,source_sha256:sha(await readFile(source)),cases_sha256:sha(await readFile(cases)),
  ordinary_wasmc_source:true,public_admission:false};
try {
  const output=await command(tooling.runner.path,[join(attempt,'input.json'),join(attempt,'execution')],
    {cwd:process.cwd(),timeout:240000,logs:join(attempt,'run')});
  receipt.result=JSON.parse(output.stdout.trim().split('\n').at(-1));
  checkQ2Evidence(receipt.result,caseRows,{root:receipt.manifest_sha256,
    source:receipt.source_sha256,wasmi:tooling.engines.wasmi,wasmtime:tooling.engines.wasmtime},rounds);
  receipt.checker_sha256=sha(await readFile('scripts/lib-q2-evidence-v2.mjs'));
  receipt.accepted=true;
} catch(error) {receipt.error=error.stack;process.exitCode=1;}
await atomicJson(join(attempt,'receipt.json'),receipt);
console.log(JSON.stringify({...receipt,attempt}));
