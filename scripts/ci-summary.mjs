import { readFileSync, readdirSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { suiteCases } from './ci-suite.mjs';
export function aggregateReports(suites,needs,source) {
  const expected={compatibility:6,runtime:12,integrity:1,security:1,rust:1};
  const errors=[];
  const cells=new Map();
  for(const os of ['ubuntu-24.04','macos-15']) {
    const platform=os.startsWith('ubuntu')?'linux':'darwin';
    for(const node of ['18.19.1','22.0.0','26.5.1'])cells.set(`compatibility-${os}-${node}`,{family:'compatibility',runtime:'node',mirror:'github',platform,version:'v'+node});
    for(const runtime of ['node','bun','deno'])for(const mirror of ['github','jsdelivr'])cells.set(`runtime-${os}-${runtime}-${mirror}`,{family:'runtime',runtime,mirror,platform,version:{node:'v26.5.1',bun:'1.3.14',deno:'deno 2.9.4'}[runtime]});
  }
  for(const [label,family] of [['integrity-ubuntu','integrity'],['security-full-history','security'],['rust-release-ubuntu','rust']])cells.set(label,{family,runtime:'node',mirror:'github',platform:'linux',version:'v26.5.1'});
  const jobIds=['core-compatibility','runtime-consumer','integrity-and-javascript','security-history','rust-wasmtime-and-libs'];
  if(Object.keys(needs).length!==5||jobIds.some(id=>needs[id]?.result!=='success'))errors.push('Required job families did not all succeed');
  if(!/^[a-f0-9]{40}$/.test(source??''))errors.push('Invalid exact source commit');
  if(new Set(suites.map(s=>s.label)).size!==suites.length)errors.push('Duplicate suite reports');
  for(const [label,cell] of cells) {
    const s=suites.find(s=>s.label===label);
    if(!s){errors.push(`Missing report: ${label}`);continue;}
    const ids=suiteCases(cell.family,cell.runtime,cell.mirror).map(t=>t.id);
    if(s.schema!=='wasmc.public-ci-suite/v1'||s.source_commit!==source||s.dirty||!s.accepted||s.family!==cell.family||s.runtime!==cell.runtime||s.mirror!==cell.mirror||s.platform!==cell.platform||!s.runtime_version?.startsWith(cell.version))errors.push(`Source/Host/status mismatch: ${label}`);
    if(!Array.isArray(s.tests)||s.tests.length!==ids.length||ids.some(id=>s.tests.filter(t=>t.id===id&&t.accepted&&t.exit_code===0&&!t.timed_out).length!==1))errors.push(`Required test mismatch: ${label}`);
  }
  if(suites.some(s=>!cells.has(s.label)))errors.push('Unexpected suite report');
  return {schema:'wasmc.public-ci-aggregate/v1',source_commit:source,accepted:errors.length===0,needs,expected,suites:[...suites].sort((a,b)=>a.label<b.label?-1:a.label>b.label?1:0),errors,non_claims:['source-line coverage','all standard-library task coverage','new LLM-generation benchmark','private compiler rebuilt or admitted','production deployment']};
}
function main() {
const needs=JSON.parse(process.env.WASMC_CI_NEEDS??'{}');
const source=process.env.GITHUB_SHA;
const root='target/ci-aggregate';mkdirSync(root,{recursive:true});
const suites=[];
const readErrors=[];
function walk(path){for(const entry of readdirSync(path,{withFileTypes:true})){const file=join(path,entry.name);if(entry.isDirectory())walk(file);else if(entry.name==='suite.json')try{const value=JSON.parse(readFileSync(file));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();suites.push(value);}catch{readErrors.push('Malformed suite receipt');}}}
try {walk('target/ci-downloads');}catch(error){readErrors.push(error.code==='ENOENT'?'No receipts downloaded':'Receipt inventory unreadable');}
const report=aggregateReports(suites,needs,source);
report.errors.push(...readErrors);report.accepted=report.errors.length===0;
writeFileSync(join(root,'results.json'),JSON.stringify(report,null,2)+'\n');
let summary=`# Public verification: ${report.accepted?'PASS':'FAIL'}\n\nExact source: \`${source}\`.\n\n| Matrix suite | Platform | Cases passed/total | Result |\n|---|---|---:|---|\n`+report.suites.map(s=>`| ${s.label} | ${s.platform}/${s.arch} | ${Array.isArray(s.tests)?s.tests.filter(t=>t.accepted).length:0}/${s.tests?.length??0} | ${s.accepted?'PASS':'FAIL'} |`).join('\n');
summary+='\n\n'+report.errors.join('\n')+'\n\nJSON and individual logs are downloadable workflow artifacts. This is behavioral test scope, not percentage source coverage. Node18 feature rejection is expected; no full Node18 managed/std execution support is inferred. Fresh-Agent is deterministic regression with retained provider receipts, not a new LLM or fresh same-candidate provider campaign.\n';
writeFileSync(join(root,'summary.md'),summary);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
if(!report.accepted)process.exitCode=1;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main();
