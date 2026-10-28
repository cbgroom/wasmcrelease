#!/usr/bin/env node
// Recover exact candidate refresh inputs without replacing historical libspec.
import assert from 'node:assert/strict';
import {existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {isAbsolute, join, resolve, sep} from 'node:path';
import {createHash} from 'node:crypto';

const [snapshotArg,snapshotPin,receiptArg,receiptPin,outArg]=process.argv.slice(2);
assert.equal(process.argv.length,7,'snapshot snapshot-sha256 Q0-receipt receipt-sha256 absent-output');
assert.ok([snapshotArg,receiptArg,outArg].every(x=>isAbsolute(x??'')));
assert.ok([snapshotPin,receiptPin].every(x=>/^[a-f0-9]{64}$/.test(x??'')));
const snapshot=resolve(snapshotArg),out=resolve(outArg),repo=resolve(import.meta.dirname,'..');
assert.equal(realpathSync(snapshot),snapshot,'snapshot must be canonical'); assert.ok(!existsSync(out),'output exists');
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifestBytes=readFileSync(join(snapshot,'snapshot.json')); assert.equal(sha(manifestBytes),snapshotPin,'snapshot pin');
const receiptBytes=readFileSync(receiptArg);assert.equal(sha(receiptBytes),receiptPin,'Q0 receipt pin');
const manifest=JSON.parse(manifestBytes),receipt=JSON.parse(receiptBytes);
assert.equal(manifest.schema,'wasmc.current-refresh-source-snapshot/v1');assert.equal(receipt.schema,'wasmc.lib-refresh-receipt/v2');
assert.equal(receipt.accepted,true);assert.equal(manifest.q0_receipt_sha256,receiptPin);assert.equal(manifest.q0_fingerprint,receipt.fingerprint);
const source=Object.fromEntries(Object.entries(receipt.source_digests).filter(([p])=>p.startsWith('libspec/')));
assert.deepEqual(manifest.source_digests,source);assert.deepEqual(manifest.generator_digests,receipt.generator_digests);
assert.equal(Object.keys(source).length,183);assert.equal(receipt.selected.length,43);
const files=new Map();
function copyPinned(base,name,pin) {
 assert.ok(!name.startsWith('/')&&!name.split('/').some(x=>!x||x==='.'||x==='..'),'unsafe input path');
 const path=join(base,name);assert.ok(lstatSync(path).isFile());assert.equal(realpathSync(path),path,'symlink input');
 assert.ok(path.startsWith(base+sep));const bytes=readFileSync(path);assert.equal(sha(bytes),pin,'input drift: '+name);files.set(name,bytes);
}
for(const [name,pin] of Object.entries(source))copyPinned(snapshot,name,pin);
for(const [name,pin] of Object.entries(receipt.generator_digests)) {
 assert.ok(!name.includes('/'));copyPinned(repo,'scripts/'+name,pin);
}
assert.equal(sha(readFileSync(join(snapshot,'snapshot.json'))),snapshotPin,'snapshot changed');
assert.equal(sha(readFileSync(receiptArg)),receiptPin,'receipt changed');
mkdirSync(out);for(const [name,bytes] of files){const path=join(out,name);mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,bytes,{flag:'wx'});}
console.log(JSON.stringify({schema:'wasmc.current-refresh-stage/v1',accepted:true,source_files:Object.keys(source).length,
 generator_files:Object.keys(receipt.generator_digests).length,snapshot_sha256:snapshotPin,receipt_sha256:receiptPin,
 fingerprint:receipt.fingerprint,output:out,scope:'exact candidate source inputs only; producer, external inputs, builds and release separately qualified'}));
