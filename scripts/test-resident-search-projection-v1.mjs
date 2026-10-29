import assert from 'node:assert/strict';
import { projectResidentIndex } from './project-resident-search-index-v1.mjs';
const receipt='a'.repeat(64), base={schema:'wasmc.current-lib-search-index/v2',registry_sha256:'registry',source_fingerprint:'before',packages:[
  {package_id:'mcpgit-resident-memory',version:'0.2.0',apis:[{route:'read'}],delivery:{receipt_sha256:'old'}},
  {package_id:'other',version:'1.0.0',apis:[{route:'call'}],delivery:{receipt_sha256:'prior'}}]};
const fresh=structuredClone(base);fresh.source_fingerprint='after';fresh.packages[0].version='0.2.1';fresh.packages[0].delivery.receipt_sha256=receipt;fresh.packages[1].delivery=null;
const got=projectResidentIndex(base,fresh,receipt);assert.equal(got.reused,1);assert.equal(got.index.packages[1].delivery.receipt_sha256,'prior');
for(const [name,mutate] of [
  ['other API drift',x=>x.packages[1].apis[0].route='changed'],
  ['unexpected binding',x=>x.packages[1].delivery={}],
  ['new receipt mismatch',x=>x.packages[0].delivery.receipt_sha256='wrong'],
  ['duplicate package',x=>x.packages.push(structuredClone(x.packages[1]))],
  ['resident API drift',x=>x.packages[0].apis[0].route='changed'],
  ['registry drift',x=>x.registry_sha256='different'],
]) { const bad=structuredClone(fresh);mutate(bad);assert.throws(()=>projectResidentIndex(base,bad,receipt),undefined,name); }
console.log('PASS: projection and six rejection controls');
