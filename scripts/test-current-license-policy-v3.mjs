import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectCurrentDeclaredThirdPartyNotices} from './current-license-policy-v3.mjs';
const catalog=readFileSync('catalog/libs-current-v2.json');
const policy=JSON.parse(readFileSync('catalog/current-v3-license-policy.json'));
const read=async path=>readFileSync(path);
const notices=await collectCurrentDeclaredThirdPartyNotices(catalog,policy,read);
assert.equal(notices.size,270);
const paths=[...notices.keys()];
let rejected=0;
for(const key of ['catalog_sha256','package_authority_commit','version']) {
  const changed={...policy,[key]:key==='version'?'0.0.22':'0'.repeat(key==='catalog_sha256'?64:40)};
  await assert.rejects(()=>collectCurrentDeclaredThirdPartyNotices(catalog,changed,read));rejected++;
}
for(const target of ['licenses/DEPENDENCY-NOTICES-001.txt',paths.find(p=>p.startsWith('current-libs/')),paths.find(p=>p.startsWith('standard/'))]) {
  await assert.rejects(()=>collectCurrentDeclaredThirdPartyNotices(catalog,policy,async path=>{
    const b=await read(path);if(path!==target)return b;
    const changed=Buffer.from(b);changed[0]^=1;return changed;
  }));rejected++;
}
for(const target of ['LICENSE',JSON.parse(catalog).cohort.path]) {
  await assert.rejects(()=>collectCurrentDeclaredThirdPartyNotices(catalog,policy,async path=>{
    const b=await read(path);return path===target?Buffer.concat([b,Buffer.from('\nchanged')]):b;
  }));rejected++;
}
assert.equal(rejected,8);
console.log(JSON.stringify({accepted:true,current_roots:42,declared_notice_files:notices.size,negative_controls:rejected,legal_compatibility:false,linked_dependency_completeness:false}));
