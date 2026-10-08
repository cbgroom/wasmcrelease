import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const skill='skills/wasmc-lib-discovery/SKILL.md';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function route(text,from,to) {
  const links=[...text.matchAll(/\]\(([^)]+)\)/g)].map(m=>path.resolve(root,path.dirname(from),m[1]));
  assert.ok(links.includes(path.resolve(root,to)),`missing discovery route from ${from}`);
}
function checkedPath(p) {
  assert.ok(typeof p==='string'&&!p.includes('\\')&&!path.isAbsolute(p));
  assert.ok(p.split('/').every(part=>part&&part!=='.'&&part!=='..'));
  const actual=fs.realpathSync(path.join(root,p));
  assert.ok(actual.startsWith(root+path.sep));
  return read(p);
}
route(read('AGENTS.md'),'AGENTS.md',skill);
route(read('skills/wasmc-developer/SKILL.md'),'skills/wasmc-developer/SKILL.md',skill);
const text=read(skill);
for(const m of text.matchAll(/\]\(([^)]+)\)/g))checkedPath(path.relative(root,path.resolve(root,path.dirname(skill),m[1])));
const commands=text.match(/```sh\n([\s\S]*?)\n```/)[1].split('\n');
assert.equal(commands.length,2);
const catalogPin='a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad';
const catalog=JSON.parse(read('catalog/libs-current-v2.json'));
assert.equal((await import('node:crypto')).createHash('sha256').update(read('catalog/libs-current-v2.json')).digest('hex'),catalogPin);
let hits=0;
for(const command of commands) {
  const m=command.match(/^node scripts\/wasmc-lib\.mjs search "([a-z0-9 ]+)" --catalog-sha256 ([0-9a-f]{64}) --limit ([1-8])$/);
  assert.ok(m,'unsafe or unsupported teaching command');assert.equal(m[2],catalogPin);
  const result=JSON.parse(execFileSync(process.execPath,['scripts/wasmc-lib.mjs','search',m[1],'--catalog-sha256',m[2],'--limit',m[3]],{cwd:root,timeout:10000,encoding:'utf8'}));
  assert.equal(result.schema,'wasmc.public-current-lib-search/v3');
  assert.equal(result.catalog_sha256,catalogPin);assert.equal(result.selection_authority,false);
  assert.equal(result.result.tag,'ok');const selected=result.result.value;
  assert.ok(selected.length>0&&selected.length<=Number(m[3]));
  for(const hit of selected) {
    const row=catalog.packages.find(p=>p.id===hit.package_id&&p.version===hit.version);assert.ok(row);
    const manifest=JSON.parse(checkedPath(row.root+'/lib.json'));
    checkedPath(row.root+'/'+manifest.agent.skill.path);
    const wit=checkedPath(row.root+'/'+manifest.wit.path);checkedPath(hit.source_path);
    assert.equal(hit.wit_sha256,row.wit_sha256);
    if(hit.delivery.artifact_path)checkedPath(row.root+'/'+hit.delivery.artifact_path);
    if(hit.kind==='api') {
      const name=hit.wit_route.split('#')[1];
      if(name.startsWith('[constructor]'))assert.ok(wit.includes('resource '+name.slice(13))&&wit.includes('constructor('));
      else assert.ok(wit.includes(name.replace(/^\[method\][^.]+\./,'')+':'));
    }
    hits++;
  }
  if(m[1]==='base64 decode')assert.deepEqual(selected.map(h=>h.wit_route),['wasmc:std@1.4.1/base64#try-decode-standard']);
}
let negatives=0;
for(const from of ['AGENTS.md','skills/wasmc-developer/SKILL.md']) {
  assert.throws(()=>route('',from,skill));negatives++;
}
for(const p of ['../AGENTS.md','/etc/passwd','skills/../AGENTS.md','unknown.wit']) {
  assert.throws(()=>checkedPath(p));negatives++;
}
console.log(JSON.stringify({accepted:true,teaching_commands:commands.length,checked_hits:hits,negative_tests:negatives,network_access:false}));
