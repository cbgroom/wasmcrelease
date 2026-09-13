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
let hits=0;
for(const command of commands) {
  // Execute only the documented read-only search shape, never arbitrary shell.
  const m=command.match(/^node scripts\/wasmc-lib\.mjs search "([a-z0-9 ]+)"( --historical)? --limit ([1-8])$/);
  assert.ok(m,'unsafe or unsupported teaching command');
  const args=['scripts/wasmc-lib.mjs','search',m[1],...(m[2]?['--historical']:[]),'--limit',m[3]];
  const result=JSON.parse(execFileSync(process.execPath,args,{cwd:root,timeout:10000,encoding:'utf8'}));
  assert.equal(result.schema,'wasmc.public-lib-search/v2');
  assert.equal(result.selection_authority,false);
  assert.ok(result.hits.length>0&&result.hits.length<=Number(m[3]));
  for(const hit of result.hits) {
    checkedPath(hit.skill_path);const wit=checkedPath(hit.wit_path);checkedPath(hit.artifact_path);
    if(hit.signature) {
      const name=hit.identity.split('#')[1];
      if(name.startsWith('[constructor]')) {
        assert.ok(wit.includes('resource '+name.slice(13))&&wit.includes('constructor('));
      } else assert.ok(wit.includes(name.replace(/^\[method\][^.]+\./,'')+':'));
    }
    hits++;
  }
  if(!m[2])assert.deepEqual(result.hits.map(h=>h.identity),['wasmc:std@1.4.0/base64#try-decode-standard']);
}
let negatives=0;
for(const from of ['AGENTS.md','skills/wasmc-developer/SKILL.md']) {
  assert.throws(()=>route('',from,skill));negatives++;
}
for(const p of ['../AGENTS.md','/etc/passwd','skills/../AGENTS.md','unknown.wit']) {
  assert.throws(()=>checkedPath(p));negatives++;
}
console.log(JSON.stringify({accepted:true,teaching_commands:commands.length,checked_hits:hits,negative_tests:negatives,network_access:false}));
