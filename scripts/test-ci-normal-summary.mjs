import assert from 'node:assert/strict';
import {suiteCases} from './ci-suite.mjs';
import {aggregateNormalReports} from './ci-normal-summary.mjs';
const source='a'.repeat(40),suites=[],needs=Object.fromEntries(['core-compatibility','runtime-consumer','integrity-and-javascript','rust-wasmtime-and-libs'].map(id=>[id,{result:'success'}]));
const add=(label,family,runtime,mirror,platform,version)=>suites.push({schema:'wasmc.public-ci-suite/v1',label,family,runtime,mirror,platform,runtime_version:version,source_commit:source,accepted:true,dirty:false,tests:suiteCases(family,runtime,mirror).map(t=>({id:t.id,accepted:true,exit_code:0,timed_out:false}))});
for(const os of ['ubuntu-24.04','macos-15']){
 const platform=os.startsWith('ubuntu')?'linux':'darwin';
 for(const node of ['18.19.1','22.0.0','26.5.1'])add(`compatibility-${os}-${node}`,'compatibility','node','github',platform,'v'+node);
 for(const runtime of ['node','bun','deno'])for(const mirror of ['github','jsdelivr'])add(`runtime-${os}-${runtime}-${mirror}`,'runtime',runtime,mirror,platform,{node:'v26.5.1',bun:'1.3.14',deno:'deno 2.9.4'}[runtime]);
}
for(const [label,family]of [['integrity-ubuntu','candidate'],['rust-release-ubuntu','rust']])add(label,family,'node','github','linux','v26.5.1');
assert.equal(aggregateNormalReports(suites,needs,source).accepted,true);
for(let i=0;i<20;i++){
 assert.equal(aggregateNormalReports(suites.filter((_,j)=>j!==i),needs,source).accepted,false);
 const changed=structuredClone(suites);changed[i].tests[0].exit_code=7;assert.equal(aggregateNormalReports(changed,needs,source).accepted,false);
}
for(const change of [s=>s.source_commit='b'.repeat(40),s=>s.runtime_version='v1',s=>s.dirty=true,s=>s.tests=[],s=>s.accepted=false,s=>s.platform='wrong',s=>s.tests[0].timed_out=true]){const changed=structuredClone(suites);change(changed[0]);assert.equal(aggregateNormalReports(changed,needs,source).accepted,false);}
assert.equal(aggregateNormalReports([...suites,suites[0]],needs,source).accepted,false);
for(const key of Object.keys(needs))assert.equal(aggregateNormalReports(suites,{...needs,[key]:{result:'skipped'}},source).accepted,false);
console.log(JSON.stringify({accepted:true,normal_cells:20,rejection_controls:52,live_ci:false}));
