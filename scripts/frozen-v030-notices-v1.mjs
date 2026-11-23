import assert from 'node:assert/strict';
import {hash} from './current-lib-release-v3.mjs';

// Immutable v0.0.30 notice identities from its independently verified catalog.
// Only exact historical files that actually exist in the selected product are
// classified. Current Roots and current notices use the current v4 policy.
const inventoryPath='catalog/frozen-v030-notices-v1.json';
const inventorySha='1aac7ddafa47bd0a5497202ce95d1fa8cfba759cdb15a1a570f479d2f422ea58';
export async function collectFrozenV030Notices(read,actualPaths) {
  assert.ok(Array.isArray(actualPaths));const actual=new Set(actualPaths);
  const raw=await read(inventoryPath);assert.equal(hash(raw),inventorySha,'frozen v0.0.30 notice inventory drift');
  const inv=JSON.parse(raw);assert.equal(inv.schema,'wasmc.frozen-notice-inventory/v1');
  assert.equal(inv.source_tag,'v0.0.30');assert.equal(inv.source_commit,'f58350daa497edba62b12e938e60e809c970fd1c');
  assert.equal(inv.catalog_sha256,'e12684efb3e475ad551eddabda12bc4c196f19edb48e7ace9069fda1ef5e7871');
  assert.ok(Array.isArray(inv.files)&&inv.files.length===324);
  const result=new Map(),seen=new Set();
  for(const row of inv.files){
    assert.deepEqual(Object.keys(row).sort(),['bytes','path','sha256']);
    assert.match(row.path,/^(?:admission|standard)\/[A-Za-z0-9_./-]+\/licenses\/DEPENDENCY-NOTICES-[0-9]{3}\.txt$/);
    assert.ok(row.path.split('/').every(part=>part&&part!=='.'&&part!=='..'));
    assert.match(row.sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(row.bytes)&&row.bytes>0);
    assert.ok(!seen.has(row.path),'duplicate frozen notice identity');seen.add(row.path);
    if(!actual.has(row.path))continue;
    const bytes=await read(row.path);assert.equal(bytes.length,row.bytes);assert.equal(hash(bytes),row.sha256,'frozen notice drift');
    result.set(row.path,{bytes:row.bytes,sha256:row.sha256,immutable_catalog_sha256:inv.catalog_sha256});
  }
  return result;
}
