import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(join(root, path));
const json = path => JSON.parse(read(path));

function verify(receiptPath, expectedFiles) {
  const receipt = json(receiptPath);
  assert.equal(receipt.schema, 'wasmc.lib-admission/v1');
  assert.deepEqual(receipt.states, {
    qualified: true,
    admitted: true,
    released: false,
    discoverable: false,
    installable: false,
  });
  const packageRoot = receipt.package.root;
  const manifestBytes = read(`${packageRoot}/lib.json`);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.id, receipt.id);
  assert.equal(manifest.version, receipt.version);
  assert.equal(manifest.admission.approved, true);
  assert.equal(manifest.admission.source_authority, receipt.source_authority);
  assert.equal(manifest.wit.package, receipt.package.wit_package);
  assert.equal(sha256(manifestBytes), receipt.package.manifest_sha256);
  assert.deepEqual(readdirSync(join(root, packageRoot), { recursive: true })
    .filter(path => !path.endsWith('references') && !path.endsWith('bindings') && !path.endsWith('rust') && !path.endsWith('src'))
    .sort(), expectedFiles);
  for (const [field, path] of [
    ['core_sha256', manifest.artifact.path],
    ['component_sha256', manifest.component.path],
    ['wit_sha256', manifest.wit.path],
  ]) assert.equal(sha256(read(`${packageRoot}/${path}`)), receipt.package[field]);
  const core = new WebAssembly.Module(read(`${packageRoot}/${manifest.artifact.path}`));
  return { receipt, manifest, imports: WebAssembly.Module.imports(core) };
}

const relational = verify('admission/data-foundation-v11/relational-v002-admission.json', [
  'SKILL.md', 'artifact.wasm', 'component.wasm', 'lib.json', 'lib.wit',
  'references/agent-delta.json',
]);
assert.deepEqual(relational.imports, []);
assert.equal(relational.receipt.package.core_imports, 0);

const resident = verify('admission/mcpgit-resident-memory-v1/formal-admission.json', [
  'SKILL.md', 'artifact.wasm', 'bindings/rust/Cargo.toml',
  'bindings/rust/src/lib.rs', 'component.wasm', 'core-abi.json', 'lib.json',
  'lib.wit', 'references/agent-delta.json',
]);
assert.equal(resident.imports.length, 4);
assert.equal(resident.receipt.package.canonical_resource_intrinsics, 4);
assert.equal(resident.receipt.package.host_authorities, 0);
assert.ok(resident.imports.every(row => row.module.startsWith('[export]mcpgit:resident-memory/')));

console.log(JSON.stringify({
  accepted: true,
  schema: 'wasmc.lib-admission-v017/v1',
  packages: [relational.manifest.wit.package, resident.manifest.wit.package],
  core_imports: { relational: 0, resident_resource_intrinsics: 4 },
  host_authorities: 0,
}));
