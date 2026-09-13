import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCase, suiteCases, structuredObservation, renderSuite } from './ci-suite.mjs';
import { aggregateReports } from './ci-summary.mjs';
const fixture=mkdtempSync(join(tmpdir(),'wasmc-ci-control-'));
try {
  assert.throws(()=>suiteCases('unknown'));
  assert.equal(suiteCases('runtime','deno','jsdelivr').length,8);
  assert.equal(structuredObservation('log\n{"accepted":true}').accepted,true);
  const run=(id,source)=>runCase({id,command:process.execPath,args:['-e',source]},fixture);
  assert.equal((await run('exit-failure','process.exit(7)')).accepted,false);
  assert.equal((await run('false-success','console.log(JSON.stringify({accepted:false}))')).accepted,false);
  assert.equal((await run('valid-success','console.log(JSON.stringify({accepted:true}))')).accepted,true);
  const timeout=await runCase({id:'timeout',command:process.execPath,args:['-e','setTimeout(()=>{},10000)'],timeoutMs:50},fixture);
  assert.equal(timeout.accepted,false);assert.equal(timeout.timed_out,true);
  const summary=renderSuite({label:'control',source_commit:'0'.repeat(40),platform:'test',arch:'test',tests:[{id:'failure',accepted:false,elapsed_ms:1}]});
  assert.ok(summary.includes('FAIL'));
  const needs=Object.fromEntries(['core-compatibility','runtime-consumer','integrity-and-javascript','security-history','rust-wasmtime-and-libs'].map(id=>[id,{result:'success'}]));
  const source='a'.repeat(40), suites=[];
  const add=(label,family,runtime,mirror,platform,version)=>suites.push({schema:'wasmc.public-ci-suite/v1',label,family,runtime,mirror,platform,runtime_version:version,source_commit:source,accepted:true,dirty:false,tests:suiteCases(family,runtime,mirror).map(t=>({id:t.id,accepted:true,exit_code:0,timed_out:false}))});
  for(const os of ['ubuntu-24.04','macos-15']) {
    const platform=os.startsWith('ubuntu')?'linux':'darwin';
    for(const node of ['18.19.1','22.0.0','26.5.1'])add(`compatibility-${os}-${node}`,'compatibility','node','github',platform,'v'+node);
    for(const runtime of ['node','bun','deno'])for(const mirror of ['github','jsdelivr'])add(`runtime-${os}-${runtime}-${mirror}`,'runtime',runtime,mirror,platform,{node:'v26.5.1',bun:'1.3.14',deno:'deno 2.9.4'}[runtime]);
  }
  for(const [label,family] of [['integrity-ubuntu','integrity'],['security-full-history','security'],['rust-release-ubuntu','rust']])add(label,family,'node','github','linux','v26.5.1');
  assert.equal(aggregateReports(suites,needs,source).accepted,true);
  assert.equal(aggregateReports(suites.slice(1),needs,source).accepted,false);
  assert.equal(aggregateReports([...suites,suites[0]],needs,source).accepted,false);
  assert.equal(aggregateReports(suites,{...needs,'security-history':{result:'skipped'}},source).accepted,false);
  for(const change of [s=>s.source_commit='b'.repeat(40),s=>s.runtime_version='v1.0.0',s=>s.tests=[],s=>s.tests[0].accepted=false,s=>s.schema='wrong']) {
    const altered=structuredClone(suites);change(altered[0]);assert.equal(aggregateReports(altered,needs,source).accepted,false);
  }
  console.log('PASS CI reporting controls: failed exit, false accepted JSON, timeout and valid success');
}finally{rmSync(fixture,{recursive:true});}
