import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {parseWitRoutes,validateRouteSets} from './lib-route-closure.mjs';
const run=(query,...args)=>JSON.parse(execFileSync(process.execPath,['scripts/wasmc-lib.mjs','search',query,...args],{encoding:'utf8'}));
const catalog=JSON.parse(readFileSync('catalog/libs-current-v2.json'));
for(const query of ['base64 decode','json pointer','gzip','mcpgit','lib search']){
  const result=run(query);
  assert(result.hits.length>0,query);
  for(const hit of result.hits){
    const row=catalog.packages.find(row=>hit.identity===row.wit_package||hit.identity.startsWith(row.wit_package+'/'));
    assert(row,hit.identity);
    assert.equal(hit.skill_path,row.root+'/SKILL.md');
    assert.equal(hit.wit_path,row.root+'/lib.wit');
    assert.equal(hit.artifact_path,row.root+'/artifact.wasm');
  }
}
assert(run('json pointer').hits.some(hit=>hit.identity==='wasmc:json@0.0.1/document#select'&&hit.signature));
for(const query of ['telemetry','csv','counter','parquet'])assert.equal(run(query,'--historical').hits.length,0,query);
assert(run('counter','--catalog','v018','--historical').hits.some(hit=>hit.identity.includes('resource-counter')));
const all=[];
for(let offset=0;;offset+=7){
  const page=run('','--offset',String(offset),'--limit','7').hits;
  all.push(...page);if(page.length<7)break;
}
assert.equal(new Set(all.map(hit=>hit.identity)).size,all.length);
assert.deepEqual(all.slice(0,64),run('','--limit','64').hits);
// Full selected-WIT route closure, not only the five sampled queries. Reuse
// the frozen release set oracle without promoting this development catalog.
const packages=catalog.packages.map(row=>{
  const parsed=parseWitRoutes(readFileSync(row.root+'/lib.wit'));
  assert.equal(parsed.identity,row.wit_package);
  return {...parsed,root:row.root};
});
const activePackage=packages.find(row=>row.identity==='wasmc:lib-search@0.4.0');
const closure=entries=>validateRouteSets({releasePackages:packages,catalogPackages:packages,indexEntries:entries,activePackage});
const exact=closure(all);
assert.equal(exact.packageRoutes,packages.length);
assert.equal(exact.apiRoutes,packages.reduce((total,row)=>total+row.api_routes.length,0));
assert.deepEqual(exact.candidateExtra,[]);
for(const hit of all){
  const row=packages.find(row=>hit.identity===row.identity||hit.identity.startsWith(row.identity+'/'));
  assert(row);assert.equal(hit.skill_path,row.root+'/SKILL.md');assert.equal(hit.wit_path,row.root+'/lib.wit');assert.equal(hit.artifact_path,row.root+'/artifact.wasm');
}
const firstApi=all.find(row=>row.signature);
assert.throws(()=>closure(all.filter(row=>row!==firstApi)),error=>error.code==='route.api_set_mismatch');
assert.throws(()=>closure(all.filter(row=>row.identity!==packages[0].identity)),error=>error.code==='route.package_set_mismatch');
assert.throws(()=>closure([...all,{identity:'wasmc:json@0.0.1/document#invented',signature:'func()'}]),error=>error.code==='route.api_set_mismatch');
for(const args of [['--limit','65'],['--limit','0'],['--offset','9007199254740992']]){
  const result=spawnSync(process.execPath,['scripts/wasmc-lib.mjs','search','base64',...args],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.equal(JSON.parse(result.stderr).accepted,false);
}
console.log(JSON.stringify({accepted:true,queries:5,excluded_packages:4,paged_hits:all.length,package_routes:exact.packageRoutes,api_routes:exact.apiRoutes,missing_or_extra_route_controls:3,invalid_arguments:3,release_qualified:false}));
