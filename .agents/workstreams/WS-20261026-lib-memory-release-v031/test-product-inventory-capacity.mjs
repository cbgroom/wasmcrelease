import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { currentProductPaths } from '../../../scripts/current-lib-release-v3.mjs';

// Actual filesystem enumeration: the count is deliberately one above the old
// product inventory ceiling, with names split across ordinary package folders.
const root = mkdtempSync(join(tmpdir(), 'wasmc-product-inventory-'));
try {
  for (let group = 0; group < 11; group++) {
    const dir = join(root, 'current-libs', `package-${String(group).padStart(2, '0')}`);
    mkdirSync(dir, { recursive: true });
    const count = group === 10 ? 1 : 1000;
    for (let i = 0; i < count; i++) writeFileSync(join(dir, `file-${String(i).padStart(4, '0')}`), 'x', {flag:'wx'});
  }
  const paths = currentProductPaths(root);
  assert.equal(paths.length, 10001);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(paths, [...paths].sort());
  assert.equal(paths[0], 'current-libs/package-00/file-0000');
  assert.equal(paths.at(-1), 'current-libs/package-10/file-0000');
  console.log(JSON.stringify({accepted:true, files:paths.length, fixture:'actual temporary files', scope:'product enumeration only, not release qualification'}));
} finally {
  rmSync(root, {recursive:true, force:true});
}
