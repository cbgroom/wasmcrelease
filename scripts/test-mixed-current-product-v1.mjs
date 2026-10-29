import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentProductPaths, currentProductReader } from './current-lib-release-v3.mjs';
import { sha } from './lib-refresh-cache-v2.mjs';
import { verifyMixedCurrentProductData } from './mixed-current-product-v1.mjs';

const root=process.env.WASMC_MIXED_FIXTURE;
const oldSha='e12684efb3e475ad551eddabda12bc4c196f19edb48e7ace9069fda1ef5e7871';
const candidateSha='c7ffb657f69bbecd5ee5b297aed8de366debc531477757880eda489f786e9f3d';
test('mixed fixture verifies both original closures and detects incorrect selected bytes', {skip:!root},()=>{
  const read=currentProductReader(root),paths=currentProductPaths(root);
  const catalog=JSON.parse(read('catalog/libs-current-v2.json'));
  const pin=sha(read('catalog/libs-current-v2.json'));
  const check=(r=read,p=paths,old=oldSha,candidate=candidateSha)=>verifyMixedCurrentProductData(r,p,pin,old,candidate);
  const result=check();assert.equal(result.accepted,true);assert.equal(result.reused,16);assert.equal(result.packages,43);
  assert.throws(()=>check(read,paths,'0'.repeat(64)),/catalog pin/);
  assert.throws(()=>check(read,paths,oldSha,'0'.repeat(64)),/catalog pin/);
  assert.throws(()=>check(read,[...paths,'current-libs/unselected/0.0.0/lib.json']),/complete current Root inventory/);
  for(const target of [catalog.index.path,catalog.packages[0].files[0].path,
    'admission/mixed-product-inputs-v1/old/catalog/libs-current-v2.json']){
    const altered=path=>path===target?Buffer.concat([read(path),Buffer.from('x')]):read(path);
    assert.throws(()=>check(altered),undefined,`reject altered ${target}`);
  }
});
