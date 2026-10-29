import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {currentProductReader,currentProductPaths} from './current-lib-release-v3.mjs';
import {verifyPublicJsonOverlay,verifyPublicJsonOverlayFromCatalog,publicOverlayPriorPaths} from './json-overlay-public-v1.mjs';
const root=process.env.WASMC_JSON_OVERLAY_PUBLIC_FIXTURE;
assert.ok(root,'explicit independently pinned overlay fixture required');
const priorRoot=process.env.WASMC_JSON_OVERLAY_PRIOR_ROOT;assert.ok(priorRoot,'explicit independently pinned prior fixture required');
for(const directory of [root,priorRoot])for(const name of ['proof','.git','.agents'])assert.ok(!existsSync(join(directory,name)),'public fixture must not contain '+name);
const catalogSha=process.env.WASMC_JSON_OVERLAY_CATALOG_SHA256,priorCatalogSha=process.env.WASMC_JSON_OVERLAY_PRIOR_SHA256,receiptSha=process.env.WASMC_JSON_OVERLAY_RECEIPT_SHA256,authorityCommit=process.env.WASMC_JSON_OVERLAY_AUTHORITY_COMMIT;
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=currentProductReader(root),priorRead=currentProductReader(priorRoot),catalogBytes=read('catalog/libs-current-v2.json'),priorCatalogBytes=priorRead('catalog/libs-current-v2.json');
const prior=JSON.parse(priorCatalogBytes),priorIndexBytes=priorRead(prior.index.path),productPaths=currentProductPaths(root);
const args={catalogBytes,catalogSha,priorCatalogBytes,priorCatalogSha,priorIndexBytes,read,productPaths,receiptSha,authorityCommit};
const result=verifyPublicJsonOverlay(args);assert.equal(result.private_provenance_verified,false);assert.equal(result.release,false);
const portable={catalogBytes,catalogSha,read,productPaths,receiptSha,authorityCommit};assert.deepEqual(verifyPublicJsonOverlayFromCatalog(portable),result);
assert.throws(()=>verifyPublicJsonOverlayFromCatalog({...portable,read:p=>p===publicOverlayPriorPaths.catalog?Buffer.from('{}'):read(p)}));
assert.throws(()=>verifyPublicJsonOverlayFromCatalog({...portable,read:p=>p===publicOverlayPriorPaths.index?Buffer.from('{}'):read(p)}));
const catalog=JSON.parse(catalogBytes),first=catalog.packages[0].files[0].path;
const corrupt=(path)=>p=>p===path?Buffer.from('independent substitution'):read(p);
for(const [label,change] of [
 ['wrong catalog identity',{catalogSha:'0'.repeat(64)}],
 ['wrong prior catalog identity',{priorCatalogSha:'0'.repeat(64)}],
 ['wrong prior index bytes',{priorIndexBytes:Buffer.from('{}')}],
 ['wrong private receipt commitment',{receiptSha:'0'.repeat(64)}],
 ['wrong artifact authority',{authorityCommit:'0'.repeat(40)}],
 ['corrupt public root',{read:corrupt(first)}],
 ['corrupt current index',{read:corrupt(catalog.index.path)}],
 ['extra public root file',{productPaths:[...productPaths,'current-libs/extra/unexpected']}],
])assert.throws(()=>verifyPublicJsonOverlay({...args,...change}),undefined,label);
// A caller may independently pin a malicious candidate; the pinned prior graph
// must still prevent self-rehashed package or index substitutions.
const serialize=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const forgedRow=structuredClone(catalog);forgedRow.packages[0].target='forged-target';
const forgedRowBytes=serialize(forgedRow), forgedRowRead=p=>p==='catalog/libs-current-v2.json'?forgedRowBytes:read(p);
assert.throws(()=>verifyPublicJsonOverlay({...args,catalogBytes:forgedRowBytes,catalogSha:hash(forgedRowBytes),read:forgedRowRead}));
const forgedIndex=JSON.parse(read(catalog.index.path));forgedIndex.packages[1]=structuredClone(forgedIndex.packages[0]);
const forgedIndexBytes=Buffer.from(JSON.stringify(forgedIndex)+'\n'),forgedCatalog=structuredClone(catalog);
forgedCatalog.index.bytes=forgedIndexBytes.length;forgedCatalog.index.sha256=hash(forgedIndexBytes);
const forgedCatalogBytes=serialize(forgedCatalog),forgedIndexRead=p=>p==='catalog/libs-current-v2.json'?forgedCatalogBytes:p===catalog.index.path?forgedIndexBytes:read(p);
assert.throws(()=>verifyPublicJsonOverlay({...args,catalogBytes:forgedCatalogBytes,catalogSha:hash(forgedCatalogBytes),read:forgedIndexRead}));
console.log(JSON.stringify({...result,negative_controls:12,actual_catalog_sha256:hash(catalogBytes),scope:'public bytes and pinned projection only; no private producer provenance or release admission'}));
