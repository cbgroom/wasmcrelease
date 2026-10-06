import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { generatedLib, selectedRun } from './generated-lib-v2.mjs';
import { atomicJson, command, sha } from './lib-refresh-cache-v2.mjs';

const runRoot=selectedRun(), repo=process.cwd();
const attempt=await mkdtemp(join(runRoot,'q1-attempt-'));
const receipt=JSON.parse(await readFile(join(runRoot,'refresh-receipt.json')));
assert.equal(receipt.accepted,true);
const ids=new Set(receipt.rows.map(r=>r.id)), component=process.argv.includes('--component');
const result={schema:'wasmc.current-cohort-qualification/v2',accepted:false,fingerprint:receipt.fingerprint,
  run_root:runRoot,attempt,selected:[...ids].sort(),tests:[],physical_device_test:false,
  ordinary_wasmc_caller_test:false,public_admission:false};
await atomicJson(join(runRoot,'q1-progress.json'),result);
async function run(script,args=[]) {
  const output=await command(process.execPath,['scripts/'+script,...args],{cwd:repo,timeout:1200000,logs:join(attempt,script)});
  const report=JSON.parse(output.stdout.trim().split('\n').at(-1));assert.equal(report.accepted,true,script);
  result.tests.push({script,accepted:true,output:report,script_sha256:sha(await readFile(join(repo,'scripts',script)))});
  await atomicJson(join(runRoot,'q1-progress.json'),result);
}
const args=['--run-root',runRoot];
try {
  for(const id of ids)await generatedLib(id,runRoot);
  for(const id of ['wasmc-json','wasmc-compression','wasmc-http1','wasmc-csv','wasmc-data-core','wasmc-data-compute','wasmc-data-expr','wasmc-data-profile','wasmc-data-relational','wasmc-data-interchange'])
    assert.ok(ids.has(id),'current cohort qualification needs the complete Data/value baseline');
  await run('test-lib-refresh-v2.mjs',args);
  await run('test-lib-refresh-data-v2.mjs',args);
  if(['wasmc-router-policy','wasmc-app-authorization-policy','wasmc-http1-client'].every(id=>ids.has(id))) await run('test-lib-refresh-extra-v2.mjs',args);
  if(['wasmc-system-file-prototype','wasmc-system-process-prototype','wasmc-system-network-prototype'].every(id=>ids.has(id))) {
    await run('test-lib-defined-boundary-runtime.mjs',args);
    await run('test-system-process-shell.mjs',args);
  }
  if(ids.has('wasmc-system-telemetry'))await run('test-telemetry-source.mjs');
  if(component) {
    if(ids.has('wasmc-system-telemetry'))await run('test-generated-telemetry.mjs',args);
    await run('test-generated-wasmi.mjs',args);
    if(ids.has('wasmc-tls-core')&&ids.has('wasmc-tls-client'))await run('test-generated-tls.mjs',args);
    for(const name of ['json','compression','http1','csv','data-core','data-compute','data-expr','data-profile','data-relational','data-interchange'])
      await run('test-generated-'+name+'.mjs',args);
    result.component_test=true;
  }
  result.native_scope=receipt.rows.filter(r=>r.profile==='native').map(r=>({id:r.id,build_status:r.native_status,
    hardware_requalified:false}));
  result.accepted=true;
} catch(e) {result.error=e.stack;process.exitCode=1;}
await atomicJson(join(runRoot,'q1-progress.json'),result);
await atomicJson(join(attempt,'receipt.json'),result);
await atomicJson(join(runRoot,'q1-receipt.json'),result);
console.log(JSON.stringify(result));
