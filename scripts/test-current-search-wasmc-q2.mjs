// Real ordinary App tests generated from the current index, not a frozen fixture.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { generatedLib, selectedRun } from './generated-lib-v2.mjs';
import { indexEntries } from './lib-current-index-v2.mjs';
import { sha, atomicJson, command, acquireWriter } from './lib-refresh-cache-v2.mjs';
import { checkQ2Evidence, checkQ2Resume } from './lib-q2-evidence-v2.mjs';

const args=process.argv.slice(2),run=selectedRun(args);
function arg(name){const i=args.indexOf(name);assert.ok(i>=0&&args[i+1],name+' required');return args[i+1];}
const text=await readFile(resolve(arg('--index')),'utf8'),wire=JSON.parse(text);
const index={...wire,entries:indexEntries(wire)};
const tooling=JSON.parse(await readFile(resolve(arg('--tooling'))));
assert.equal(tooling.schema,'wasmc.local-q2-tooling/v2');
assert.equal(tooling.test_source_sha256,sha(await readFile('tests/lib-refresh/q2/native-value-runner.rs')));
for(const key of ['runner','provider','merge_tool']){
  assert.ok(isAbsolute(tooling[key].path));assert.equal(sha(await readFile(tooling[key].path)),tooling[key].sha256);
}
const selected=await generatedLib('wasmc-lib-search',run);
const wit=await readFile(join(selected.root,'lib.wit'),'utf8');
// Translate WIT declaration spelling only. There is no generated implementation
// in the App: all three operations call the external selected Lib.
const declarations=wit.slice(wit.indexOf('interface catalog {')+'interface catalog {'.length,wit.indexOf('  snapshot:'))
  .replace(/[a-z][a-z0-9]*(?:-[a-z0-9]+)+/g,s=>s.replaceAll('-','_'));
const literal=JSON.stringify(text),functions=[],cases=[];
const add=(name,type,body,expected)=>{
  functions.push(`${name}:func()->${type}{${body}}`);
  cases.push({export:name,arguments:[],expected});
};
function delivery(v){return v===null?null:{some:{'manifest-sha256':v.manifest_sha256,'receipt-sha256':v.receipt_sha256,
  'artifact-kind':v.artifact_kind,'artifact-path':v.artifact_path===null?null:{some:v.artifact_path},
  'artifact-sha256':v.artifact_sha256===null?null:{some:v.artifact_sha256},
  'component-sha256':v.component_sha256===null?null:{some:v.component_sha256}}};}
function hit(v){return Object.fromEntries(Object.entries(v).map(([k,x])=>[k.replaceAll('_','-'),k==='delivery'?delivery(x):x]));}
const packages=index.entries.filter(e=>e.kind==='package');
add('snapshot','result<snapshot_info,search_error>',`return catalog::snapshot(${literal});`,{ok:{
  'entry-count':index.entries.length,'package-count':packages.length,'api-count':index.entries.length-packages.length,
  'bound-package-count':packages.filter(e=>e.delivery).length,'registry-sha256':index.registry_sha256,'index-sha256':sha(Buffer.from(text))}});
const existing=index.entries.find(e=>e.package_id==='wasmc-json'&&e.kind==='package');assert.ok(existing);
add('lookup','result<option<hit>,search_error>',`return catalog::lookup(${literal},${JSON.stringify(existing.identity)});`,{ok:{some:hit(existing)}});
add('missing','result<option<hit>,search_error>',`return catalog::lookup(${literal},"missing@0.0.0");`,{ok:null});
const matches=index.entries.filter(e=>[e.identity,e.wit_route,e.description,e.profile,e.target].join(' ').toLowerCase().includes('json')).slice(0,2);
add('search','result<list<hit>,search_error>',`let q:query={text:"json",package_id:none,profile:none,bound_only:false};return catalog::search(${literal},q,0,2);`,{ok:matches.map(hit)});
add('bound','result<list<hit>,search_error>',`let q:query={text:"",package_id:none,profile:none,bound_only:true};return catalog::search(${literal},q,0,1);`,{ok:index.entries.filter(e=>e.delivery).slice(0,1).map(hit)});
add('reject','result<snapshot_info,search_error>','return catalog::snapshot("{}");',{err:'invalid-index'});
add('limit','result<list<hit>,search_error>','let q:query={text:"",package_id:none,profile:none,bound_only:false};return catalog::search("{}",q,0,0);',{err:'invalid-limit'});
const resumePosition=args.indexOf('--resume-attempt');
const attempt=resumePosition<0 ? await mkdtemp(join(run,'current-search-app-q2-')) : resolve(args[resumePosition+1]);
assert.ok(attempt.startsWith(resolve(run)+'/current-search-app-q2-') && !attempt.slice(resolve(run).length+1).includes('/'));
const releaseWriter=await acquireWriter(attempt);
const report={schema:'wasmc.current-lib-search-ordinary-q2/v2',accepted:false,
  cases_sha256:sha(Buffer.from(JSON.stringify(cases))),index_sha256:sha(Buffer.from(text)),tooling,
  root_manifest_sha256:selected.row.manifest_sha256,public_admission:false,results:[],
  scope:'Independent Apps per case; unchanged complete Root and full current index; fresh bounded Stores'};
try{
  let previous;
  if(resumePosition>=0){
    previous=JSON.parse(await readFile(join(attempt,'progress.json')));
    checkQ2Resume(previous,report);
    assert.ok(previous.results.length<=cases.length);
    await atomicJson(join(attempt,'resume-input-'+Date.now()+'.json'),previous);
  }
  for(let i=0;i<cases.length;i++) {
    const name=cases[i].export;
    const source=`package local:current_search_${name}_q2;interface api{${declarations}\n${functions[i]}\n}world app{export api;}\n`;
    const sourcePath=join(attempt,name+'.wasmc'),casesPath=join(attempt,name+'-cases.json'),planPath=join(attempt,name+'-input.json');
    const pins={root:selected.row.manifest_sha256,source:sha(Buffer.from(source)),
      wasmi:tooling.engines.wasmi,wasmtime:tooling.engines.wasmtime};
    if(previous && i<previous.results.length){
      assert.equal(await readFile(sourcePath,'utf8'),source);
      assert.deepEqual(JSON.parse(await readFile(casesPath)),[cases[i]]);
      const savedPlan=JSON.parse(await readFile(planPath));
      assert.deepEqual(savedPlan.provider,tooling.provider);
      assert.deepEqual(savedPlan.merge_tool,tooling.merge_tool);
      assert.equal(savedPlan.rounds,4);
      checkQ2Evidence(previous.results[i],[cases[i]],pins,4);
      report.results.push(previous.results[i]);
      (report.reused_verified_cases??=[]).push(name);
      continue;
    }
    try{await writeFile(sourcePath,source,{flag:'wx'});}catch(e){
      if(e.code!=='EEXIST')throw e;assert.equal(await readFile(sourcePath,'utf8'),source);
    }
    await atomicJson(casesPath,[cases[i]]);
    const plan={root:{path:selected.root,manifest_sha256:selected.row.manifest_sha256},source:sourcePath,
      cases:casesPath,provider:tooling.provider,merge_tool:tooling.merge_tool,rounds:4};
    await atomicJson(planPath,plan);
    console.error(JSON.stringify({case:name,state:'building-and-executing',attempt}));
    const execution=name+'-execution'+(resumePosition>=0?'-resume-'+Date.now():'');
    const output=await command(tooling.runner.path,[planPath,join(attempt,execution)],
      {cwd:process.cwd(),timeout:240000,logs:join(attempt,execution+'-run')});
    const result=JSON.parse(output.stdout.trim().split('\n').at(-1));
    checkQ2Evidence(result,[cases[i]],pins,4);
    report.results.push(result);await atomicJson(join(attempt,'progress.json'),report);
  }
  assert.equal(report.results.length,cases.length);
  report.calls_per_engine=report.results.reduce((n,r)=>n+r.calls_per_engine,0);
  report.accepted=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
await atomicJson(join(attempt,'receipt.json'),report);console.log(JSON.stringify({...report,attempt}));
await releaseWriter();
