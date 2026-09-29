import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const cohort = [
  'wasmc-router-policy',
  'wasmc-json',
  'wasmc-compression',
  'wasmc-http1',
];

for (const id of cohort) {
  const receiptPath = `admission/portable-libs-v018/${id}-admission.json`;
  const receipt = JSON.parse(readFileSync(join(root, receiptPath)));
  assert.equal(receipt.schema, 'wasmc.lib-admission/v1');
  assert.equal(receipt.id, id);
  assert.equal(receipt.version, '0.0.1');
  assert.deepEqual(receipt.states, {
    qualified: true,
    admitted: true,
    released: false,
    discoverable: false,
    installable: false,
  });
  const packageRoot = join(root, receipt.package.root);
  assert.deepEqual(readdirSync(packageRoot, { recursive: true })
    .filter(path => path !== 'references')
    .sort(), [
    'SKILL.md',
    'artifact.wasm',
    'component.wasm',
    'lib.json',
    'lib.wit',
    'references/agent-delta.json',
  ]);
  const manifestBytes = readFileSync(join(packageRoot, 'lib.json'));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.id, id);
  assert.equal(manifest.version, receipt.version);
  assert.equal(manifest.admission.approved, true);
  assert.equal(manifest.admission.source_authority, receipt.source_authority);
  assert.equal(sha256(manifestBytes), receipt.package.manifest_sha256);
  for (const [field, file] of [
    ['core_sha256', 'artifact.wasm'],
    ['component_sha256', 'component.wasm'],
    ['wit_sha256', 'lib.wit'],
  ]) assert.equal(sha256(readFileSync(join(packageRoot, file))), receipt.package[field]);
  const core = new WebAssembly.Module(readFileSync(join(packageRoot, 'artifact.wasm')));
  assert.deepEqual(WebAssembly.Module.imports(core), []);
}

console.log(JSON.stringify({
  accepted: true,
  schema: 'wasmc.lib-admission-v018/v1',
  packages: cohort,
  core_imports: 0,
}));
