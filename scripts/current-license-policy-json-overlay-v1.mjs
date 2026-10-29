import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {checkedCurrentCatalog,currentProductPaths,currentProductReader} from './current-lib-release-v3.mjs';
import {collectMixedDeclaredNotices} from './current-license-policy-mixed-v1.mjs';
import {verify} from './json-combined-product-v1.mjs';
import {sha} from './lib-refresh-cache-v2.mjs';

// A selected Root keeps its own original notice set. This verifies declared
// bytes and provenance; it is not a conclusion about license compatibility.
export async function collectJsonOverlayNotices({root,catalogSha,oldSha,receiptSha,witPath,witSha,commit}) {
 const closure=await verify({root,catalogSha,oldSha,receiptSha,witPath,witSha,commit});assert.equal(closure.accepted,true);
 const read=currentProductReader(root),catalogBytes=read('catalog/libs-current-v2.json'),catalog=checkedCurrentCatalog(catalogBytes,catalogSha);
 const oldRoot=join(root,'proof/old-product'),oldRead=currentProductReader(oldRoot),oldBytes=oldRead('catalog/libs-current-v2.json');
 assert.equal(sha(oldBytes),oldSha);const oldPolicy=JSON.parse(oldRead('catalog/current-mixed-license-policy-v1.json'));
 const old=await collectMixedDeclaredNotices(oldBytes,oldPolicy,async p=>oldRead(p),currentProductPaths(oldRoot));
 const result=new Map();for(const [path,pin] of old)result.set('proof/old-product/'+path,pin);
 const capsule=join(root,'proof/json-q0'),receipt=JSON.parse(await readFile(join(capsule,'receipt.json')));
 const noticesPin=receipt.release_notices_input,noticesBytes=await readFile(join(capsule,'external',noticesPin.sha256));assert.equal(sha(noticesBytes),noticesPin.sha256);
 const notices=JSON.parse(noticesBytes);assert.equal(notices.schema,'wasmc.release-notices-input/v1');
 const byPath=new Map(notices.files.map(x=>[x.path,x]));assert.equal(byPath.size,notices.files.length);
 const selected=catalog.packages.find(x=>x.id==='wasmc-json');assert.ok(selected);
 for(const row of catalog.packages){
  const manifest=JSON.parse(read(row.root+'/lib.json'));assert.equal(sha(read(row.root+'/lib.json')),row.manifest_sha256);
  const list=manifest.license.files.filter(x=>x.path!=='LICENSE');
  if(row.id===selected.id)assert.deepEqual(list,notices.files);
  for(const p of list){
   const path=row.root+'/'+p.path,b=read(path);assert.equal(b.length,p.bytes);assert.equal(sha(b),p.sha256);
   assert.ok(!b.includes(0));new TextDecoder('utf-8',{fatal:true}).decode(b);
   if(row.id===selected.id){const expected=byPath.get(p.path);assert.deepEqual(p,expected);const captured=read('proof/json-q0/external/'+p.sha256);assert.deepEqual(captured,b);
    result.set('proof/json-q0/external/'+p.sha256,{bytes:p.bytes,sha256:p.sha256,receipt_sha256:receiptSha});
    const snapshot=read('proof/json-q0/root/'+p.path);assert.deepEqual(snapshot,b);
    result.set('proof/json-q0/root/'+p.path,{bytes:p.bytes,sha256:p.sha256,receipt_sha256:receiptSha});
   }else{const original=old.get(path);assert.ok(original,'original Root notice missing: '+path);assert.equal(original.bytes,p.bytes);assert.equal(original.sha256,p.sha256);}
   result.set(path,{bytes:p.bytes,sha256:p.sha256,manifest_sha256:row.manifest_sha256,catalog_sha256:catalogSha});
  }
 }
 return result;
}
