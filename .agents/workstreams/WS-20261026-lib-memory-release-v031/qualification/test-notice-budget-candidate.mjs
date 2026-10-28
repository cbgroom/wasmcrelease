import assert from 'node:assert/strict';
import {cp, mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {MAX_LICENSE_SNAPSHOT_BYTES, attachReleaseLicense, inventory, sha, verifyReleaseLicense, verifyRoot} from '../../../../scripts/lib-refresh-cache-v2.mjs';
const [receiptPath,bundlePath,producer,producerSha]=process.argv.slice(2);
for(const path of [receiptPath,bundlePath,producer])assert.ok(path?.startsWith('/'));
assert.equal(sha(await readFile(producer)),producerSha);
const receipt=JSON.parse(await readFile(receiptPath)),row=receipt.rows.find(r=>r.id==='wasmc-json');assert.ok(row);
const manifest=JSON.parse(await readFile(join(bundlePath,'dependency-notices.json')));
const notices=await Promise.all(manifest.files.map(async p=>({path:p.path,sha256:p.sha256,content:await readFile(join(bundlePath,p.path.slice(9)))})));
for(const [i,n] of notices.entries()){assert.equal(n.content.length,manifest.files[i].bytes);assert.equal(sha(n.content),n.sha256);}
const license=await readFile('LICENSE'),licenseSha=sha(license),parent=await mkdtemp(join(tmpdir(),'wasmc-notice-budget-'));
try {
 const real=join(parent,'json');await cp(row.package_root,real,{recursive:true});await mkdir(join(real,'licenses'),{recursive:true});
 const before=await inventory(real);await attachReleaseLicense(real,license,licenseSha,notices);
 const checked=await verifyRoot(real,row.id,row.version,row.profile,false);
 for(const path of Object.keys(before))if(path!=='lib.json'&&!/^bindings\/[^/]+\/Cargo\.toml$/.test(path))assert.deepEqual(checked.files[path],before[path]);
 const native=spawnSync(producer,['lib','verify',real],{encoding:'utf8',timeout:120000,maxBuffer:1048576});
 assert.notEqual(native.status,0);assert.match(native.stderr,/license total byte budget exceeded/);
 const boundary=join(parent,'boundary');await mkdir(join(boundary,'licenses'),{recursive:true});await writeFile(join(boundary,'lib.json'),JSON.stringify({bindings:{}}));
 const bytes=Buffer.alloc(MAX_LICENSE_SNAPSHOT_BYTES-license.length,0x41),notice={path:'licenses/DEPENDENCY-NOTICES-001.txt',content:bytes,sha256:sha(bytes)};
 await attachReleaseLicense(boundary,license,licenseSha,[notice]);const inv=await inventory(boundary),m=JSON.parse(await readFile(join(boundary,'lib.json')));verifyReleaseLicense(m,inv);
 const saved=await inventory(boundary),over=Buffer.alloc(bytes.length+1,0x41);
 await assert.rejects(attachReleaseLicense(boundary,license,licenseSha,[{...notice,content:over,sha256:sha(over)}]),/total license snapshot budget/);
 assert.deepEqual(await inventory(boundary),saved);
 const malformed={...notice,content:Buffer.from([255]),sha256:sha(Buffer.from([255]))};await assert.rejects(attachReleaseLicense(boundary,license,licenseSha,[malformed]));assert.deepEqual(await inventory(boundary),saved);
 console.log(JSON.stringify({schema:'wasmc.notice-budget-candidate-test/v1',actual_notice_bytes:notices.reduce((n,x)=>n+x.content.length,0),actual_bundle_js_verified:true,wasm_and_source_unchanged:true,existing_wasmc_verifier_rejects_2m_limit:true,native_stderr:native.stderr.trim(),exact_16m_pass:true,plus_one_rejected_without_mutation:true,invalid_utf8_rejected_without_mutation:true,producer_sha256:producerSha,release_ready:false}));
} finally {await rm(parent,{recursive:true,force:true});}
