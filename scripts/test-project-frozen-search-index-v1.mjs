import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectFrozenIndex } from './project-frozen-search-index-v1.mjs';

function fixture() {
  const source={spec:{sha256:'s'},wit:{sha256:'w'}};
  const old={id:'example',version:'1.0.0',manifest_sha256:'old',root_inventory_sha256:'old-inventory',source,wit_sha256:'wit'};
  const next={...structuredClone(old),manifest_sha256:'new',root_inventory_sha256:'new-inventory'};
  const prior={package_id:'example',version:'1.0.0',apis:[{route:'world#f'}],description:'example',delivery:{manifest_sha256:'old',receipt_sha256:'old-receipt'}};
  const fresh={...structuredClone(prior),delivery:{manifest_sha256:'new',receipt_sha256:'new-receipt'}};
  return [{packages:[old]},{packages:[prior]},{packages:[next]},{packages:[fresh]}];
}
test('rebind conflict to original delivery without changing inputs',()=>{
  const inputs=fixture(),before=structuredClone(inputs),r=projectFrozenIndex(...inputs);
  assert.equal(r.index.packages[0].delivery.receipt_sha256,'old-receipt');
  assert.equal(r.reused[0].root_inventory_sha256,'old-inventory'); assert.deepEqual(inputs,before);
});
test('successor remains bound to candidate',()=>{
  const inputs=fixture(); inputs[2].packages[0].version='1.0.1'; inputs[3].packages[0].version='1.0.1';
  const r=projectFrozenIndex(...inputs); assert.equal(r.reused.length,0);
  assert.equal(r.index.packages[0].delivery.receipt_sha256,'new-receipt');
});
test('reject differing source, WIT, API and delivery identities',()=>{
  for (const mutate of [
    x=>x[2].packages[0].source.spec.sha256='different',
    x=>x[2].packages[0].wit_sha256='different',
    x=>x[3].packages[0].apis[0].route='world#other',
    x=>x[1].packages[0].delivery.manifest_sha256='other',
    x=>x[3].packages[0].delivery.manifest_sha256='other',
    x=>x[0].packages.push(structuredClone(x[0].packages[0])),
  ]) { const x=fixture(); mutate(x); assert.throws(()=>projectFrozenIndex(...x)); }
});
