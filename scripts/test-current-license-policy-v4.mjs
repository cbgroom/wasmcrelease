import assert from 'node:assert/strict';
import {collectCurrentDeclaredThirdPartyNoticesV4} from './current-license-policy-v4.mjs';
import {currentProductReader,currentProductPaths,hash} from './current-lib-release-v3.mjs';
import {isExactDeclaredNotice} from './declared-thirdparty-notices.mjs';
const root=process.cwd(),read=currentProductReader(root),paths=currentProductPaths(root),bytes=read('catalog/libs-current-v2.json');
const catalog=JSON.parse(bytes),policy=JSON.parse(read('catalog/current-v4-license-policy.json'));assert.equal(hash(bytes),policy.catalog_sha256);
const collect=(p=policy,fn=read,inventory=paths)=>collectCurrentDeclaredThirdPartyNoticesV4(bytes,p,async path=>fn(path),inventory);
const declared=await collect(),cohort=JSON.parse(read(catalog.cohort.path)),n=cohort.release_notices.files.length;
assert.equal(declared.size,n*(catalog.packages.length+1+policy.standard_root_mirrors.length));
for(const [path] of declared)assert.equal(isExactDeclaredNotice(path,read(path),declared),true,path);
const global=cohort.release_notices.files[0].path,local=catalog.packages[0].root+'/'+global;
for(const target of [global,local,'LICENSE',catalog.cohort.path])await assert.rejects(collect(policy,path=>{
 const data=read(path);if(path!==target)return data;const altered=Buffer.from(data);altered[0]^=1;return altered;
}));
await assert.rejects(collect({...policy,catalog_sha256:'0'.repeat(64)}));
await assert.rejects(collect({...policy,package_authority_commit:'1'.repeat(40)}));
await assert.rejects(collect(policy,read,[...paths,'current-libs/undeclared/file.txt']));
console.log(JSON.stringify({accepted:true,schema:'wasmc.current-license-v4-controls/v1',catalog_sha256:policy.catalog_sha256,
 exact_notice_paths:declared.size,negative_controls:7,scope:'current cohort exact notices; standalone and frozen historical notices are independently verified'}));
