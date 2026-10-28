import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {hash,verifyCurrentRelease,verifyCurrentReleaseV4,searchCurrentReleaseV4,resolveCurrentPackage,currentProductReader,currentProductPaths} from '../../../../scripts/current-lib-release-v3.mjs';
const [input,pin]=process.argv.slice(2),root=resolve(input??'');assert.match(pin??'',/^[a-f0-9]{64}$/);
const bytes=readFileSync(join(root,'catalog/libs-current-v2.json'));assert.equal(hash(bytes),pin);
const catalog=JSON.parse(bytes),read=currentProductReader(root),paths=currentProductPaths(root);
assert.equal(catalog.package_authority_commit,'0'.repeat(40),'fixture must never impersonate a published commit');
const good=verifyCurrentReleaseV4(bytes,pin,read,paths);assert.equal(good.schema,'wasmc.current-release-closure/v4');assert.equal(good.release_packages,43);
const selected=searchCurrentReleaseV4(bytes,pin,read,{text:'json',package_id:null,profile:null,bound_only:true},0,8,paths);
assert.equal(selected.result.tag,'ok');assert.ok(selected.result.value.some(x=>x.identity==='wasmc-json@0.2.1'));
const row=catalog.packages.find(x=>x.id==='wasmc-json');const lock=resolveCurrentPackage(bytes,pin,{id:row.id,version:row.version,manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256},read);assert.equal(lock.id,'wasmc-json');
assert.throws(()=>verifyCurrentRelease(bytes,pin,read,paths),'v3 must reject the v4 cohort contract');
const target='licenses/DEPENDENCY-NOTICES-013.txt';assert.throws(()=>verifyCurrentReleaseV4(bytes,pin,path=>{
 const b=read(path);if(path!==target)return b;const altered=Buffer.from(b);altered[0]^=1;return altered;
},paths),'altered notice must reject');
assert.throws(()=>verifyCurrentReleaseV4(bytes,'0'.repeat(64),read,paths),'incorrect catalog pin must reject');
console.log(JSON.stringify({accepted:true,closure:good,v3_rejects_v4_cohort:true,v4_notice_tamper_rejected:true,v4_catalog_pin_rejected:true,fixture_zero_commit:true,search_json_and_exact_resolve:true,formal_release:false}));
