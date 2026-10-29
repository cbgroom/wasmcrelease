import assert from 'node:assert/strict';

// Keep existing delivery identities; the new receipt binds only the changed root.
// This projection is discovery evidence, not authorization for a combined release.
export function projectJsonIndex(old, fresh, newReceipt) {
  assert.equal(old.schema, 'wasmc.current-lib-search-index/v2');
  assert.equal(fresh.schema, old.schema);
  assert.equal(old.registry_sha256, fresh.registry_sha256);
  const map = rows => { const m = new Map(); for (const p of rows) {
    assert.ok(!m.has(p.package_id), 'duplicate package'); m.set(p.package_id, p);
  } return m; };
  const previous = map(old.packages), next = map(fresh.packages);
  assert.equal(previous.size, next.size);
  const index = structuredClone(fresh); let reused = 0, changed = 0;
  for (const p of index.packages) {
    const prior = previous.get(p.package_id); assert.ok(prior, 'new package');
    if (p.package_id === 'wasmc-json') {
      assert.equal(prior.version, '0.2.1'); assert.equal(p.version, '0.2.2');
      assert.ok(prior.delivery && p.delivery); assert.equal(p.delivery.receipt_sha256, newReceipt);
      assert.deepEqual(prior.apis, p.apis, 'JSON API changed'); changed++; continue;
    }
    assert.equal(p.delivery, null, 'unexpected fresh binding'); assert.ok(prior.delivery, 'old delivery missing');
    assert.deepEqual({ ...prior, delivery:null }, { ...p, delivery:null }, p.package_id + ': index source drift');
    p.delivery = structuredClone(prior.delivery); reused++;
  }
  assert.equal(changed, 1); return { index, reused };
}
