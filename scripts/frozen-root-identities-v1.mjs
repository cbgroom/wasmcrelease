import assert from 'node:assert/strict';

// A published identity is immutable across releases. A changed Root needs a
// new package version or the exact prior Root; the candidate must not silently
// replace bytes behind a version consumers may already have installed.
export function assertFrozenRootIdentities(base, rows) {
  assert.equal(base.schema, 'wasmc.public-lib-catalog/v2');
  assert.ok(Array.isArray(base.packages) && Array.isArray(rows));
  const key = row => {
    assert.equal(typeof row.id, 'string');
    assert.match(row.id, /^[a-z0-9][a-z0-9-]*$/);
    assert.match(row.version, /^\d+\.\d+\.\d+$/);
    for (const name of ['manifest_sha256', 'root_inventory_sha256'])
      assert.match(row[name], /^[0-9a-f]{64}$/);
    return `${row.id}@${row.version}`;
  };
  const frozen = new Map();
  for (const row of base.packages) {
    const identity = key(row);
    assert.ok(!frozen.has(identity), `duplicate published identity ${identity}`);
    frozen.set(identity, row);
  }
  const seen = new Set(), conflicts = [];
  for (const row of rows) {
    const identity = key(row);
    assert.ok(!seen.has(identity), `duplicate candidate identity ${identity}`);
    seen.add(identity);
    const previous = frozen.get(identity);
    if (previous && (previous.manifest_sha256 !== row.manifest_sha256 ||
        previous.root_inventory_sha256 !== row.root_inventory_sha256)) conflicts.push(identity);
  }
  assert.deepEqual(conflicts.sort(), [], `published Root identity changed: ${conflicts.sort().join(', ')}`);
}
