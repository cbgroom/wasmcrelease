import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
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
for(const args of [['--limit','65'],['--limit','0'],['--offset','9007199254740992']]){
  const result=spawnSync(process.execPath,['scripts/wasmc-lib.mjs','search','base64',...args],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.equal(JSON.parse(result.stderr).accepted,false);
}
console.log(JSON.stringify({accepted:true,queries:5,excluded_packages:4,paged_hits:all.length,invalid_arguments:3}));
