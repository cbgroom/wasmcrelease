import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,writeFile,symlink,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {attachReleaseLicense,inventory,sha,verifyRoot} from './lib-refresh-cache-v2.mjs';
const run=process.argv[2];assert.ok(run&&run.startsWith('/'),'explicit current Q0 root required');
const original=JSON.parse(await readFile(join(run,'refresh-receipt.json')));
const license=await readFile('LICENSE'),licenseSha=sha(license),out=await mkdtemp(join(tmpdir(),'wasmc-refresh-license-'));
let cases=0;
for(const id of ['wasmc-std','wasmc-json','mcpgit-resident-memory','wasmc-host-clock','wasmc-system-android-display','wasmc-system-linux-socket']){
 const row=original.rows.find(r=>r.id===id);assert.ok(row);
 const root=join(out,id);await cp(row.package_root,root,{recursive:true});
 const before=await inventory(root);const oldManifest=JSON.parse(await readFile(join(root,'lib.json')));
 await assert.rejects(attachReleaseLicense(root,license,'0'.repeat(64)));assert.deepEqual(await inventory(root),before);cases++;
 await attachReleaseLicense(root,license,licenseSha);
 const verified=await verifyRoot(root,id,row.version,row.profile,Boolean(oldManifest.bindings?.rust_core&&row.profile==='resource'));
 assert.equal(verified.manifest.license.files[0].sha256,licenseSha);
 for(const name of Object.keys(before))if(name!=='lib.json'&&!/^bindings\/[^/]+\/Cargo\.toml$/.test(name))
  assert.deepEqual(verified.files[name],before[name],name+': executable/source changed');
 for(const sdk of Object.values(verified.manifest.bindings))if(sdk.cargo_toml){
  assert.match(await readFile(join(root,sdk.cargo_toml.path),'utf8'),/^license-file = "\.\.\/\.\.\/LICENSE"$/m);
  assert.equal(sdk.cargo_toml.sha256,verified.files[sdk.cargo_toml.path].sha256);
 }
 const once=await inventory(root);await attachReleaseLicense(root,license,licenseSha);assert.deepEqual(await inventory(root),once);cases+=2;
 await writeFile(join(root,'LICENSE'),'license drift');
 await assert.rejects(verifyRoot(root,id,row.version,row.profile,Boolean(oldManifest.bindings?.rust_core&&row.profile==='resource')));cases++;
 await unlink(join(root,'LICENSE'));await symlink(join(process.cwd(),'LICENSE'),join(root,'LICENSE'));
 await assert.rejects(attachReleaseLicense(root,license,licenseSha));assert.equal(sha(await readFile('LICENSE')),licenseSha);cases++;
}
console.log(JSON.stringify({accepted:true,cases,roots:6,artifact_and_sdk_source_parity:true,license_identity_rejections:true,no_linked_output_write:true}));
