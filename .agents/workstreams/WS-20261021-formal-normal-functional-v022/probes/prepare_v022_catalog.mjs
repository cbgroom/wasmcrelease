import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {hash,verifyCurrentRelease,currentProductPaths} from '../../../../scripts/current-lib-release-v3.mjs';
const root=process.cwd(),read=p=>readFileSync(resolve(root,p));
const put=(p,v)=>writeFileSync(resolve(root,p),JSON.stringify(v,null,2)+'\n');
const prior=read('catalog/libs-current-v2.json');
assert.equal(hash(prior),'a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad');
const catalog=JSON.parse(prior),before=verifyCurrentRelease(prior,hash(prior),read,currentProductPaths(root));
assert.equal(catalog.version,'0.0.21');assert.equal(before.release_packages,42);
assert.equal(before.refresh_receipt_sha256,'3a84eea9d791f2600a07487d07859f0e7f75ea0b076b0ea0b837d869307ba943');
const packages=JSON.stringify(catalog.packages),authority=catalog.package_authority_commit;
// Only the containing release changes. Root identities, inventories, source,
// producer, measured build receipt and original package authority are retained.
catalog.version='0.0.22';put('catalog/libs-current-v2.json',catalog);
const next=read('catalog/libs-current-v2.json'),pin=hash(next);
assert.equal(JSON.stringify(catalog.packages),packages);assert.equal(catalog.package_authority_commit,authority);
const closure=verifyCurrentRelease(next,pin,read,currentProductPaths(root));
assert.deepEqual({...closure,catalog_sha256:before.catalog_sha256},before);
put('admission/current-product-v3.json',closure);
const policy=JSON.parse(read('catalog/current-v3-license-policy.json'));
assert.equal(policy.catalog_sha256,hash(prior));assert.equal(policy.version,'0.0.21');
policy.version=catalog.version;policy.catalog_sha256=pin;put('catalog/current-v3-license-policy.json',policy);
put('.agents/workstreams/WS-20261021-formal-normal-functional-v022/evidence/current42-reuse-v022.json',{
 schema:'wasmc.unchanged-current-cohort-reuse/v1',version:catalog.version,
 prior_catalog_sha256:hash(prior),catalog_sha256:pin,package_authority_commit:authority,
 original_refresh_receipt_sha256:closure.refresh_receipt_sha256,
 original_producer_sha256:closure.producer_sha256,complete_Roots:42,api_routes:236,index_entries:278,
 original_cohort_sha256:catalog.cohort.sha256,unchanged_Root_rows:true,new_Lib_builds:0,
 exact_compiled_Core_Search_lookup_and_pagination:true,formal_release:false,
 separate_successors:['Map/Core4.11 product admission','JSON0.0.2 product admission']
});
console.log(JSON.stringify({accepted:true,catalog_sha256:pin,version:catalog.version,unchanged_Roots:42,new_Lib_builds:0,...closure}));
