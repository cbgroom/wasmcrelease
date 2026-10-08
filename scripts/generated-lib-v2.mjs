// Single test/consumer selection path: an exact successful refresh receipt.
// Never fall back to a source directory, target directory or historical package.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { verifyRoot, sha } from './lib-refresh-cache-v2.mjs';

export function selectedRun(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--run-root');
  assert.ok(index >= 0 && argv[index + 1], 'required: --run-root <exact successful refresh>');
  return resolve(argv[index + 1]);
}

export async function generatedLib(id, runRoot = selectedRun()) {
  const receiptBytes = await readFile(join(runRoot, 'refresh-receipt.json'));
  const receipt = JSON.parse(receiptBytes);
  assert.equal(receipt.schema, 'wasmc.lib-refresh-receipt/v2');
  assert.equal(receipt.accepted, true, 'incomplete refresh is not a qualification input');
  const rows = receipt.rows.filter(r => r.id === id);
  assert.equal(rows.length, 1, id + ': must occur once in selected receipt');
  const row = rows[0];
  const root = join(runRoot, 'packages', id);
  assert.equal(resolve(row.package_root), root, 'receipt package locator escaped selected run');
  const verified = await verifyRoot(root, id, row.version, row.profile, Boolean(row.resource_core_inputs));
  assert.equal(verified.manifest_sha256, row.manifest_sha256, id + ': manifest identity mismatch');
  if (row.artifact_sha256 !== null) assert.equal(verified.manifest.artifact?.sha256, row.artifact_sha256);
  return { root, manifest: verified.manifest, files: verified.files, row, receipt,
    receipt_sha256: sha(receiptBytes), run_root: runRoot,
    artifact: verified.manifest.artifact ? join(root, verified.manifest.artifact.path) : null,
    component: verified.files['component.wasm'] ? join(root, 'component.wasm') : null };
}
