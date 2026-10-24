import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {suiteCases} from './ci-suite.mjs';
export function aggregateNormalReports(suites,needs,source){
 const errors=[],cells=[];
 const add=(label,family,runtime,mirror,platform,version)=>cells.push({label,family,runtime,mirror,platform,version});
 for(const os of ['ubuntu-24.04','macos-15']){
  const platform=os.startsWith('ubuntu')?'linux':'darwin';
  for(const node of ['18.19.1','22.0.0','26.5.1'])add(`compatibility-${os}-${node}`,'compatibility','node','github',platform,'v'+node);
  for(const runtime of ['node','bun','deno'])for(const mirror of ['github','jsdelivr'])add(`runtime-${os}-${runtime}-${mirror}`,'runtime',runtime,mirror,platform,{node:'v26.5.1',bun:'1.3.14',deno:'deno 2.9.4'}[runtime]);
 }
 for(const [label,family]of [['integrity-ubuntu','candidate'],['rust-release-ubuntu','rust']])add(label,family,'node','github','linux','v26.5.1');
 const jobs=['core-compatibility','runtime-consumer','integrity-and-javascript','rust-wasmtime-and-libs'];
 if(Object.keys(needs).length!==4||jobs.some(id=>needs[id]?.result!=='success'))errors.push('All four normal job families must succeed');
 if(!/^[a-f0-9]{40}$/.test(source??''))errors.push('Exact source required');
 if(suites.length!==20||new Set(suites.map(s=>s.label)).size!==20)errors.push('Exactly20 unique normal receipts required');
 for(const c of cells){const s=suites.find(s=>s.label===c.label),ids=suiteCases(c.family,c.runtime,c.mirror).map(t=>t.id);
  if(!s||s.schema!=='wasmc.public-ci-suite/v1'||s.source_commit!==source||s.dirty||s.accepted!==true||s.family!==c.family||s.runtime!==c.runtime||s.mirror!==c.mirror||s.platform!==c.platform||!s.runtime_version?.startsWith(c.version)||!Array.isArray(s.tests)||s.tests.length!==ids.length||ids.some(id=>s.tests.filter(t=>t.id===id&&t.accepted===true&&t.exit_code===0&&!t.timed_out).length!==1))errors.push('Missing, failed or mismatched normal receipt: '+c.label);
 }
 return {schema:'wasmc.normal-public-ci-aggregate/v1',source_commit:source,scope:'normal functional consumers only',expected:{compatibility:6,runtime:12,candidate:1,rust:1},accepted:errors.length===0,needs,suites,errors};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const suites=[];function walk(p){for(const e of readdirSync(p,{withFileTypes:true})){const f=join(p,e.name);if(e.isDirectory())walk(f);else if(e.name==='suite.json')suites.push(JSON.parse(readFileSync(f)));}}
 walk('target/ci-downloads');const r=aggregateNormalReports(suites,JSON.parse(process.env.WASMC_CI_NEEDS??'{}'),process.env.GITHUB_SHA);mkdirSync('target/ci-aggregate',{recursive:true});writeFileSync('target/ci-aggregate/results.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({accepted:r.accepted,scope:r.scope,receipts:r.suites.length,errors:r.errors}));if(!r.accepted)process.exitCode=1;
}
