import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const retiredAuthoringDirectory = 'libsrc';
export function assertRetiredAuthoringAbsent(root) {
 try { lstatSync(join(root,retiredAuthoringDirectory)); }
 catch(error) { if(error.code==='ENOENT')return; throw error; }
 throw Error('historical authoring tree or symlink must not exist');
}
export function validateCurrentOnlySources(root=process.cwd()) {
assertRetiredAuthoringAbsent(root);
const registry=JSON.parse(readFileSync(join(root,'libspec/registry.json')));
const retirement=JSON.parse(readFileSync(join(root,'.agents/workstreams/WS-20261006-lib-refresh-v2/legacy-retirement.json')));
const ids=registry.libs.map(r=>r.id).sort();
for(const id of retirement.original_candidates)assert.ok(ids.includes(id),'retired candidate lost: '+id);
const current=readdirSync(join(root,'libspec'),{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name!=='shared').map(e=>e.name).sort();
assert.deepEqual(ids,current,'orphan implementation or missing source directory');
const removed=new Set(retirement.retired_commands);
for(const file of removed)assert.equal(existsSync(join(root,file)),false,'retired entry returned: '+file);
const forbidden=[/libsrc\//, /libspec\/[^/\s"']+\/(?:Cargo\.(?:toml|lock)|target\/|candidate\.json)/,
  /["']libsrc["']/];
const failures=[];
function scan(dir) {
 for(const entry of readdirSync(join(root,dir),{withFileTypes:true})){
  if(['target','node_modules','.git'].includes(entry.name))continue;
  const p=join(dir,entry.name);
  if(entry.isDirectory()){scan(p);continue;}
  if(!/\.(mjs|js|sh|json|yml|yaml|rs)$/.test(p)||p.endsWith('validate-current-only-libs.mjs'))continue;
  const text=readFileSync(join(root,p),'utf8');
  if(forbidden.some(re=>re.test(text)))failures.push(p);
  for(const old of removed)if(text.includes(old))failures.push(p+' -> '+old);
 }
}
for(const dir of ['scripts','.github/workflows','host/platform'])scan(dir);
assert.deepEqual(failures,[],'active historical build/test routing remains');
return {accepted:true,schema:'wasmc.current-only-source-audit/v2',candidates:ids.length,
  retired_files:retirement.retired_file_count,retired_entrypoints:removed.size,legacy_tree:false,legacy_fallback:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(validateCurrentOnlySources()));
