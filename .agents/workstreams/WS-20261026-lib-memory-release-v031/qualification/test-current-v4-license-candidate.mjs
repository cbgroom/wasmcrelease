import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {collectCurrentDeclaredThirdPartyNoticesV4} from '../../../../scripts/current-license-policy-v4.mjs';
import {currentProductReader,currentProductPaths,hash} from '../../../../scripts/current-lib-release-v3.mjs';
import {isExactDeclaredNotice} from '../../../../scripts/declared-thirdparty-notices.mjs';
const [input,pin]=process.argv.slice(2),root=resolve(input??'');assert.match(pin??'',/^[a-f0-9]{64}$/);
const bytes=readFileSync(join(root,'catalog/libs-current-v2.json'));assert.equal(hash(bytes),pin);
const catalog=JSON.parse(bytes);assert.equal(catalog.package_authority_commit,'0'.repeat(40));
const policy={schema:'wasmc.current-license-policy/v2',version:catalog.version,catalog_sha256:pin,
  package_authority_commit:catalog.package_authority_commit,current_packages:catalog.packages.length,standard_root_mirrors:[]};
const read=currentProductReader(root),paths=currentProductPaths(root),collect=(p=policy,fn=read,ps=paths)=>collectCurrentDeclaredThirdPartyNoticesV4(bytes,p,async path=>fn(path),ps);
const declared=await collect();assert.equal(declared.size,13*(43+1));
for(const [path] of declared)assert.equal(isExactDeclaredNotice(path,read(path),declared),true,path);
for(const target of ['licenses/DEPENDENCY-NOTICES-013.txt',catalog.packages[0].root+'/licenses/DEPENDENCY-NOTICES-001.txt','LICENSE',catalog.cohort.path]){
  await assert.rejects(collect(policy,path=>{const b=read(path);if(path!==target)return b;const value=Buffer.from(b);value[0]^=1;return value;}));
}
await assert.rejects(collect({...policy,catalog_sha256:'0'.repeat(64)}));
await assert.rejects(collect({...policy,package_authority_commit:'1'.repeat(40)}));
await assert.rejects(collect(policy,read,[...paths,'current-libs/undeclared/file.txt']));
const standard=catalog.packages.find(row=>row.id==='wasmc-std');
const mirror={id:standard.id,version:standard.version,root:'standard/'+standard.id+'/'+standard.version};
const mirrorRead=path=>path.startsWith(mirror.root+'/')?read(standard.root+path.slice(mirror.root.length)):read(path);
const mirrored=await collect({...policy,standard_root_mirrors:[mirror]},mirrorRead);
assert.equal(mirrored.size,13*(43+2));
assert.equal(isExactDeclaredNotice(mirror.root+'/licenses/DEPENDENCY-NOTICES-001.txt',mirrorRead(mirror.root+'/licenses/DEPENDENCY-NOTICES-001.txt'),mirrored),true);
await assert.rejects(collect({...policy,standard_root_mirrors:[mirror]},path=>{const b=mirrorRead(path);if(path!==mirror.root+'/licenses/DEPENDENCY-NOTICES-001.txt')return b;const altered=Buffer.from(b);altered[0]^=1;return altered;}));
await assert.rejects(collect({...policy,standard_root_mirrors:[{id:'wasmc-json',version:'0.2.1',root:'standard/wasmc-json/0.2.1'}]}));
console.log(JSON.stringify({accepted:true,declared_exact_notice_paths:declared.size,negative_cases:9,exact_standard_mirror:true,full_v4_closure_verified:true,
  no_standard_mirrors_in_fixture:true,fixture_zero_commit:true,legal_notice_complete:false,formal_release:false}));
