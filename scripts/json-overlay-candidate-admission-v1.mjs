// Private release-operator preflight. The output describes public inputs only;
// the producer/Q0 proof tree must never be included in a distributable.
import assert from 'node:assert/strict';
import {isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {currentProductPaths,currentProductReader,checkedCurrentCatalog} from './current-lib-release-v3.mjs';
import {verify as verifyPrivate} from './json-combined-product-v1.mjs';
import {collectJsonOverlayNotices} from './current-license-policy-json-overlay-v1.mjs';
import {publicOverlayPriorPaths,verifyPublicJsonOverlayFromCatalog} from './json-overlay-public-v1.mjs';

export async function qualifyJsonOverlayCandidate({privateRoot,publicRoot,catalogSha,oldSha,receiptSha,witPath,witSha,commit,version}) {
  for(const path of [privateRoot,publicRoot,witPath]) assert.ok(isAbsolute(path??''),'absolute private/public/tool path required');
  for(const pin of [catalogSha,oldSha,receiptSha,witSha]) assert.match(pin??'',/^[0-9a-f]{64}$/);
  assert.match(commit??'',/^[0-9a-f]{40}$/);assert.match(version??'',/^\d+\.\d+\.\d+$/);
  assert.equal(createHash('sha256').update(readFileSync(witPath)).digest('hex'),witSha,'independent WIT tool identity');
  const privateArgs={root:privateRoot,catalogSha,oldSha,receiptSha,witPath,witSha,commit};
  const qualified=await verifyPrivate(privateArgs);
  assert.equal(qualified.accepted,true);assert.equal(qualified.json_q0_verified,true);assert.equal(qualified.old_product_closure_verified,true);
  const read=currentProductReader(publicRoot),bytes=read('catalog/libs-current-v2.json');
  const catalog=checkedCurrentCatalog(bytes,catalogSha);assert.equal(catalog.version,version,'release version identity');
  const publicProof=verifyPublicJsonOverlayFromCatalog({catalogBytes:bytes,catalogSha,read,productPaths:currentProductPaths(publicRoot),receiptSha,authorityCommit:commit});
  assert.equal(publicProof.prior_catalog_sha256,oldSha,'independent prior catalog identity');
  assert.equal(publicProof.catalog_sha256,qualified.catalog_sha256);assert.equal(catalog.index.sha256,qualified.index_sha256);
  assert.equal(publicProof.packages,qualified.packages);assert.equal(publicProof.root_files,qualified.root_files);assert.equal(publicProof.index_entries,qualified.entries);
  const notices=await collectJsonOverlayNotices(privateArgs),inputPaths=new Set(['catalog/libs-current-v2.json',catalog.registry.path,catalog.index.path,catalog.cohort.path,...Object.values(publicOverlayPriorPaths)]);
  for(const row of catalog.packages){for(const file of row.files)inputPaths.add(file.path);for(const pin of Object.values(row.source))inputPaths.add(pin.path);}
  let publicNoticeCount=0;
  for(const [path,pin] of notices){
    if(path.startsWith('proof/'))continue;
    assert.ok(inputPaths.has(path),'notice must be a selected public input');
    const b=read(path);assert.equal(b.length,pin.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),pin.sha256);
    publicNoticeCount++;
  }
  assert.ok(publicNoticeCount>0,'selected public notices required');
  return {schema:'wasmc.json-overlay-candidate-admission/v1',accepted:true,version,catalog_sha256:catalogSha,prior_catalog_sha256:oldSha,receipt_sha256:receiptSha,authority_commit:commit,index_sha256:catalog.index.sha256,
    packages:publicProof.packages,root_files:publicProof.root_files,index_entries:publicProof.index_entries,public_notice_paths:publicNoticeCount,
    private_q0_verified:true,prior_mixed_closure_verified:true,public_projection_verified:true,public_input_paths:[...inputPaths].sort(),formal_release:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [privateRoot,publicRoot,catalogSha,oldSha,receiptSha,witPath,witSha,commit,version,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
 console.log(JSON.stringify(await qualifyJsonOverlayCandidate({privateRoot,publicRoot,catalogSha,oldSha,receiptSha,witPath,witSha,commit,version})));
}
