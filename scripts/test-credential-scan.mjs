import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,unlinkSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync,spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const scanner=fileURLToPath(new URL('./scan-reachable-credentials.mjs',import.meta.url));
const root=fileURLToPath(new URL('../',import.meta.url));
const test=mkdtempSync(join(tmpdir(),'wasmc-scan-negative-'));
const git=args=>execFileSync('git',args,{cwd:test,stdio:'pipe'});
const scan=(dir,raw=false)=>spawnSync(process.execPath,[scanner,dir,...(raw?['--raw-only']:[])],{encoding:'utf8'});
try {
 git(['init','-q']);git(['config','user.name','Scanner fixture']);git(['config','user.email','scanner@example.invalid']);
 writeFileSync(join(test,'data'),'clean\n');git(['add','data']);git(['commit','-qm','clean']);
 assert.equal(scan(test).status,0);
 const value='gh'+'p_'+'A'.repeat(36);
 writeFileSync(join(test,'deleted'),value);git(['add','deleted']);git(['commit','-qm','negative']);
 unlinkSync(join(test,'deleted'));git(['add','-u']);git(['commit','-qm','deleted']);
 const negative=scan(test);assert.equal(negative.status,1);
 assert.ok(!negative.stdout.includes(value));assert.ok(!negative.stderr.includes(value));
 const report=JSON.parse(negative.stdout);assert.equal(report.findings.length,1);assert.equal(report.skipped_blobs,0);
 const original=scan(root,true);assert.equal(original.status,1);
 const raw=JSON.parse(original.stdout);assert.equal(raw.raw_findings.length,3);assert.equal(raw.classified_false_positives.length,0);
 const approved=scan(root);assert.equal(approved.status,0);
 const admitted=JSON.parse(approved.stdout);assert.equal(admitted.raw_findings.length,3);assert.equal(admitted.classified_false_positives.length,3);assert.equal(admitted.findings.length,0);
 const testKey=admitted.classified_false_positives.find(x=>x.detector==='private_key_pem');
 assert.equal(testKey.classification,'verified-repository-local-self-signed-test-fixture');
 assert.equal(testKey.scope,'localhost-and-127.0.0.1-only');assert.equal(testKey.production_authority,false);
 // Same frozen carrier under a changed blob identity must NOT gain an exemption.
 const carrier=execFileSync('git',['cat-file','blob','111e78b2bed5a9658cecb3660e547aee698b273b'],{cwd:root,maxBuffer:8388608});
 writeFileSync(join(test,'unknown.mjs'),Buffer.concat([carrier,Buffer.from('\n// distinct fixture blob\n')]));git(['add','unknown.mjs']);git(['commit','-qm','unknown carrier']);
 const unknown=JSON.parse(scan(test).stdout);assert.ok(unknown.findings.some(x=>x.detector==='aws_access_key_id'));assert.equal(unknown.classified_false_positives.length,0);
 // The localhost fixture exemption is object-exact: the same key in any changed blob remains rejected.
 const testKeyCarrier=execFileSync('git',['cat-file','blob','0b20b1e6ebbcaf67e8d5ce74cdb11984e66e8bbe'],{cwd:root,maxBuffer:8388608});
 writeFileSync(join(test,'unknown-key.pem'),Buffer.concat([testKeyCarrier,Buffer.from('\n# changed fixture blob\n')]));git(['add','unknown-key.pem']);git(['commit','-qm','unknown test key carrier']);
 const unknownKey=JSON.parse(scan(test).stdout);assert.ok(unknownKey.findings.some(x=>x.detector==='private_key_pem'));assert.equal(unknownKey.classified_false_positives.length,0);
 console.log('PASS: exact approved carrier proof, raw-only rejection, deleted credential and unknown-carrier rejection; no matched values disclosed');
} finally {rmSync(test,{recursive:true});}
