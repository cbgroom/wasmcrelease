import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,writeFile,symlink,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
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
const native=process.argv[3],nativeSha=process.argv[4];assert.equal(Boolean(native),Boolean(nativeSha));
let nativeCases=0,noticeCases=0;
if(native){
 assert.ok(native.startsWith('/'));assert.match(nativeSha,/^[0-9a-f]{64}$/);assert.equal(sha(await readFile(native)),nativeSha);
 const noticeInput=JSON.parse(await readFile('licenses/dependency-notices-v3.json'));
 const notices=await Promise.all(noticeInput.files.map(async pin=>({path:pin.path,sha256:pin.sha256,content:await readFile(pin.path)})));
 for(const id of ['wasmc-json','wasmc-std','mcpgit-resident-memory']){
  const row=original.rows.find(r=>r.id===id),root=join(out,'native-'+id);await cp(row.package_root,root,{recursive:true});
  await attachReleaseLicense(root,license,licenseSha,notices);
  const good=spawnSync(native,['lib','verify',root],{encoding:'utf8',timeout:120000,maxBuffer:1048576});
  assert.equal(good.status,0,good.stderr);nativeCases++;
  const rootManifest=JSON.parse(await readFile(join(root,'lib.json'))),resourceCore=Boolean(rootManifest.bindings?.rust_core&&row.profile==='resource');
  const verified=await verifyRoot(root,id,row.version,row.profile,resourceCore);
  assert.equal(verified.manifest.license.files.length,notices.length+1);noticeCases++;
  const sdk=Object.values(verified.manifest.bindings).find(v=>v.cargo_toml);assert.ok(sdk);
  const path=sdk.cargo_toml.path,cargo=await readFile(join(root,path),'utf8');
  assert.match(cargo,/publish = false\nlicense-file = "\.\.\/\.\.\/LICENSE"\n/);
  const wrong=cargo.replace('license-file = "../../LICENSE"\n','').replace('[package]\n','[package]\nlicense-file = "../../LICENSE"\n');
  await writeFile(join(root,path),wrong);
  const manifest=verified.manifest;
  const update=v=>{if(!v||typeof v!=='object')return;if(v.path===path&&typeof v.sha256==='string'){v.sha256=sha(Buffer.from(wrong));if('bytes'in v)v.bytes=Buffer.byteLength(wrong);}for(const x of Object.values(v))update(x);};
  update(manifest);await writeFile(join(root,'lib.json'),JSON.stringify(manifest,null,2)+'\n');
  const bad=spawnSync(native,['lib','verify',root],{encoding:'utf8',timeout:120000,maxBuffer:1048576});
  assert.notEqual(bad.status,0);assert.match(bad.stderr,/Cargo.toml does not regenerate exactly/);nativeCases++;
  await writeFile(join(root,path),cargo);const restore=v=>{if(!v||typeof v!=='object')return;if(v.path===path&&typeof v.sha256==='string'){v.sha256=sha(Buffer.from(cargo));if('bytes'in v)v.bytes=Buffer.byteLength(cargo);}for(const x of Object.values(v))restore(x);};
  restore(manifest);await writeFile(join(root,'lib.json'),JSON.stringify(manifest,null,2)+'\n');
  const notice=notices[0];await writeFile(join(root,notice.path),'tampered original notice');
  await assert.rejects(verifyRoot(root,id,row.version,row.profile,resourceCore));noticeCases++;
 }
 assert.equal(sha(await readFile(native)),nativeSha,'independent compiler input unchanged');
}
console.log(JSON.stringify({accepted:true,cases:cases+nativeCases+noticeCases,roots:6,native_canonical_sdk_cases:nativeCases,dependency_notice_cases:noticeCases,artifact_and_sdk_source_parity:true,license_identity_rejections:true,no_linked_output_write:true}));
