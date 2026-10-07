#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inventory as fileInventory } from './lib-refresh-cache-v2.mjs';

const root = process.cwd();
const registry = JSON.parse(await readFile(resolve(root, 'libspec/registry.json'), 'utf8'));
const policy = JSON.parse(await readFile(resolve(root, 'libspec/rust-policy.json'), 'utf8'));
assert.equal(registry.schema, 'wasmc.lib-refresh-registry/v2');
assert.equal(policy.schema, 'wasmc.lib-refresh-rust-policy/v2');
assert.ok((await stat(resolve(root, 'libspec/Cargo.lock'))).isFile());

const ids = registry.libs.map(row => row.id);
assert.equal(new Set(ids).size, ids.length, 'duplicate Refresh V2 Lib id');
const inventory = ['adapter.rs', 'delta.rs', 'lib.json', 'lib.wit'];
const forbiddenDelta = [
  'wit_bindgen',
  'export!(',
  'core_abi',
  'wasmtime',
  'wasmi',
  'Store<',
  'Linker<',
];
const allowedProfiles = new Set(['value', 'resource', 'host', 'native']);

for (const row of registry.libs) {
  assert.equal(row.source, 'libspec/' + row.id, row.id + ': source must use canonical libspec/<id>');
  const dir = resolve(root, row.source);
  const spec = JSON.parse(await readFile(join(dir, 'lib.json'), 'utf8'));
  assert.equal(spec.schema, 'wasmc.lib-refresh-source/v2');
  assert.equal(spec.id, row.id);
  assert.ok(allowedProfiles.has(spec.profile), row.id + ': invalid profile');
  if (spec.profile === 'host') {
    assert.ok(Array.isArray(spec.host_imports) && spec.host_imports.length > 0,
      row.id + ': host profile requires explicit imports');
    assert.equal(new Set(spec.host_imports).size, spec.host_imports.length,
      row.id + ': duplicate Host import');
  }
  if (spec.profile === 'native') {
    assert.ok(['c-boundary', 'node-boundary', 'swift-embedded'].includes(spec.native?.kind));
    assert.ok(spec.native.files.length && spec.native.files.includes(spec.native.entry));
    assert.ok(spec.native.files.every(p => p.startsWith('platform/')));
    assert.deepEqual(Object.keys(await fileInventory(dir)).sort(),
      ['lib.json', 'lib.wit', ...spec.native.files].sort(), row.id + ': native inventory drift');
    continue;
  }
  assert.deepEqual((await readdir(dir)).sort(), inventory, row.id + ': authored Rust inventory must stay exactly four files');
  assert.ok(Array.isArray(spec.apis) && spec.apis.length > 0, row.id + ': API evidence rows missing');
  for (const dependency of spec.dependencies ?? []) {
    assert.ok(policy.dependencies[dependency], row.id + ': dependency is outside shared policy: ' + dependency);
  }
  for (const sharedName of spec.shared_modules ?? []) {
    const shared = policy.shared_modules?.[sharedName];
    assert.ok(shared, row.id + ': shared module is outside shared policy: ' + sharedName);
    for (const dependency of shared.dependencies ?? []) {
      assert.ok(policy.dependencies[dependency], row.id + ': shared dependency is outside policy: ' + dependency);
    }
  }
  for (const dependencyId of spec.wit_dependencies ?? []) {
    assert.ok(ids.includes(dependencyId), row.id + ': unknown WIT dependency: ' + dependencyId);
  }
  const delta = await readFile(join(dir, 'delta.rs'), 'utf8');
  for (const token of forbiddenDelta) {
    assert.ok(!delta.includes(token), row.id + ': delta contains generated/runtime concern ' + token);
  }
  const adapter = await readFile(join(dir, 'adapter.rs'), 'utf8');
  const adapterLines = adapter.split('\n').length;
  assert.ok(adapterLines <= 120, row.id + ': adapter is no longer thin (' + adapterLines + ' lines)');
  assert.ok(adapter.includes('crate::delta'), row.id + ': adapter must delegate into delta');
}
for (const [name, shared] of Object.entries(policy.shared_modules ?? {})) {
  const source = await readFile(resolve(root, shared.source), 'utf8');
  for (const token of forbiddenDelta) {
    assert.ok(!source.includes(token), 'shared module ' + name + ' contains generated/runtime concern ' + token);
  }
}

console.log(JSON.stringify({
  accepted: true,
  schema: 'wasmc.lib-refresh-source-validation/v2',
  libs: ids.length,
  inventory,
  shared_lock: true,
  authoring_authority: 'libspec',
  legacy_fallback: false,
}));
