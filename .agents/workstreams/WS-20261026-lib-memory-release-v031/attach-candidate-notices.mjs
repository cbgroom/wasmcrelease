import assert from 'node:assert/strict';
import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {attachReleaseLicense,inventory,sha,verifyRoot} from '../../../scripts/lib-refresh-cache-v2.mjs';
const own=resolve('.agents/workstreams/WS-20261026-lib-memory-release-v031');
const evidence='/Users/youxianshi/.local/state/wasmc-maintenance/20261026-lib-memory-json-32';
const native='/Users/youxianshi/code/.worktrees/wasmc/WS-20261025-json-utf8-parts-v1/target/debug/wasmc';
const input=JSON.parse(await readFile(join(own,'producer/inputs/notices/additional-notices.json')));
const notices=await Promise.all(input.files.map(async pin=>({path:pin.path,sha256:pin.sha256,content:await readFile(pin.path.endsWith('007.txt')?join(own,'producer/inputs/notices/DEPENDENCY-NOTICES-007.txt'):pin.path)})));
const license=await readFile('LICENSE'), receipts=[];
const rows=[{id:'wasmc-json',version:'0.1.0',profile:'value',root:join(evidence,'json-portable-memory-root/wasmc-json')},{id:'wasmc-std',version:'1.5.0',profile:'resource',root:join(evidence,'std-root-publication/wasmc-std')}];
for(const pin of JSON.parse(await readFile(join(evidence,'seven-root-sealing.json')))){assert.equal(pin.status,0);assert.equal(pin.verify_status,0);rows.push({id:pin.id,version:pin.version,profile:pin.id==='wasmc-system-telemetry'?'resource':'value',root:pin.root});}
for(const row of rows){
 const before=await inventory(row.root);
 await attachReleaseLicense(row.root,license,sha(license),notices);
 const after=await inventory(row.root);
 for(const [path,pin] of Object.entries(before))if(path!=='lib.json'&&!/^bindings\/[^/]+\/Cargo.toml$/.test(path))assert.deepEqual(after[path],pin,path);
 const originalManifest=JSON.parse(await readFile(join(row.root,'lib.json')));
 await verifyRoot(row.root,row.id,row.version,row.profile,Boolean(originalManifest.bindings?.rust_core&&row.profile==='resource'));
 const verified=spawnSync(native,['lib','verify',row.root],{encoding:'utf8',timeout:120000,maxBuffer:1048576});
 await writeFile(join(evidence,`${row.id}-licensed-root-verify.json`),JSON.stringify({status:verified.status,stdout:verified.stdout,stderr:verified.stderr},null,2)+'\n');
 assert.equal(verified.status,0,verified.stderr);
 const target=join(own,'candidate-roots',row.id,row.version);await mkdir(target,{recursive:true});await cp(row.root,target,{recursive:true});
 assert.deepEqual(await inventory(target),after);
 const m=JSON.parse(await readFile(join(row.root,'lib.json')));
 receipts.push({id:row.id,version:row.version,manifest_sha256:after['lib.json'].sha256,artifact:m.artifact,license_files:m.license.files,executable_and_sdk_source_unchanged:true,complete_root_verified:true,current_catalog:false,release:false});
}
await mkdir(join(own,'qualification'),{recursive:true});
await writeFile(join(own,'qualification/licensed-candidate-roots.json'),JSON.stringify({accepted:true,notice_input_sha256:sha(await readFile(join(own,'producer/inputs/notices/additional-notices.json'))),roots:receipts},null,2)+'\n');
console.log(JSON.stringify({accepted:true,roots:receipts.map(r=>({id:r.id,version:r.version,manifest_sha256:r.manifest_sha256})),unchanged_compiled_artifacts:true}));
