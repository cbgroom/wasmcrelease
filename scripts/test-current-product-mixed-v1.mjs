// Actual mixed-product closure and corruption controls; no publication claim.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {checkedCurrentCatalog,currentProductPaths,currentProductReader,hash} from './current-lib-release-v3.mjs';
import {verifyMixedFromCatalog} from './mixed-current-product-v1.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),read=currentProductReader(root),paths=currentProductPaths(root);
const bytes=read('catalog/libs-current-v2.json'),policy=JSON.parse(read('catalog/current-mixed-license-policy-v1.json'));
const catalog=checkedCurrentCatalog(bytes,policy.catalog_sha256);assert.equal(policy.package_authority_commit,catalog.package_authority_commit);
const verify=(reader=read,pin=policy.catalog_sha256,inventory=paths)=>verifyMixedFromCatalog(bytes,pin,reader,inventory);
const closure=verify();assert.equal(closure.accepted,true);assert.equal(closure.packages,catalog.packages.length);
assert.equal(closure.public_admission,false);
assert.throws(()=>verify(read,'0'.repeat(64)));
assert.throws(()=>verify(read,policy.catalog_sha256,[...paths,'current-libs/unselected/0.0.0/lib.json']));
const targets=[catalog.index.path,catalog.packages[0].files[0].path,
  'admission/mixed-product-inputs-v1/old/catalog/libs-current-v2.json'];
for(const target of targets){const corrupt=p=>p===target?Buffer.concat([read(p),Buffer.from('x')]):read(p);assert.throws(()=>verify(corrupt));}
console.log(JSON.stringify({accepted:true,schema:'wasmc.mixed-product-ci-check/v1',catalog_sha256:hash(bytes),
  packages:closure.packages,root_files:closure.root_files,controls:5,public_admission:false}));
