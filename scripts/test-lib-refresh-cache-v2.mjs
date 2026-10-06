import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { acquireWriter, atomicJson, command, inside, inventory, sha, verifyCache, verifyRoot, writeChanged } from './lib-refresh-cache-v2.mjs';

async function sandbox(body) {
  const path = await mkdtemp(join(tmpdir(), 'wasmc-refresh-unit-'));
  try { await body(path); } finally { await rm(path, { recursive: true, force: true }); }
}

test('writeChanged preserves unchanged source mtimes', () => sandbox(async root => {
  const path = join(root, 'src/lib.rs');
  assert.equal(await writeChanged(path, 'same'), true);
  const before = await stat(path, { bigint: true });
  assert.equal(await writeChanged(path, Buffer.from('same')), false);
  assert.equal((await stat(path, { bigint: true })).mtimeNs, before.mtimeNs);
  assert.equal(await writeChanged(path, 'changed'), true);
  assert.equal(await readFile(path, 'utf8'), 'changed');
}));

test('writer is exclusive and releases only its own lock', () => sandbox(async root => {
  const release = await acquireWriter(root);
  await assert.rejects(acquireWriter(root), /CACHE_BUSY/);
  await release();
  const again = await acquireWriter(root); await again();
}));

test('paths and symlinked package files fail closed', () => sandbox(async root => {
  assert.throws(() => inside(root, '../elsewhere'), /escapes/);
  assert.throws(() => inside(root, '/tmp/absolute'), /relative/);
  await writeFile(join(root, 'real'), 'x');
  await symlink('real', join(root, 'alias'));
  await assert.rejects(inventory(root), /symlink forbidden/);
}));

async function fixture(root) {
  const packageRoot = join(root, 'package');
  const files = {
    'artifact.wasm': 'core-fixture', 'component.wasm': 'component-fixture',
    'core-abi.json': '{}', 'lib.wit': 'package test:unit;',
    'bindings/rust-core/Cargo.toml': '[package]', 'bindings/rust-core/src/lib.rs': '// core',
    'bindings/rust-component/Cargo.toml': '[package]', 'bindings/rust-component/src/lib.rs': '// component',
  };
  for (const [name, bytes] of Object.entries(files)) await writeChanged(join(packageRoot, name), bytes);
  const descriptor = path => ({ path, sha256: sha(Buffer.from(files[path])) });
  const manifest = { id: 'unit', version: '1.0.0', artifact: descriptor('artifact.wasm'),
    component: descriptor('component.wasm'), core_abi: descriptor('core-abi.json'),
    bindings: {
      rust_core: { schema: 'wasmc.lib-rust-canonical-core-sdk/v1', cargo_toml: descriptor('bindings/rust-core/Cargo.toml'), source: descriptor('bindings/rust-core/src/lib.rs') },
      rust_component: { schema: 'wasmc.lib-rust-component-sdk/v0', cargo_toml: descriptor('bindings/rust-component/Cargo.toml'), source: descriptor('bindings/rust-component/src/lib.rs') },
    } };
  await atomicJson(join(packageRoot, 'lib.json'), manifest);
  const verified = await verifyRoot(packageRoot, 'unit', '1.0.0');
  await atomicJson(join(root, 'seal.json'), { schema: 'wasmc.lib-refresh-cache-entry/v2', key: 'key', id: 'unit', files: verified.files });
  return { packageRoot, spec: { id: 'unit', version: '1.0.0' } };
}

test('sealed cache verifies all files and rejects a wrong input key', () => sandbox(async root => {
  const { spec } = await fixture(root);
  assert.ok((await verifyCache(root, 'key', spec)).files['artifact.wasm']);
  await assert.rejects(verifyCache(root, 'other', spec));
}));

test('tampered SDK source is rejected, not silently rebuilt', () => sandbox(async root => {
  const { packageRoot, spec } = await fixture(root);
  await writeFile(join(packageRoot, 'bindings/rust-core/src/lib.rs'), '// tampered');
  await assert.rejects(verifyCache(root, 'key', spec), /digest mismatch/);
}));

test('extra package files are rejected against sealed inventory', () => sandbox(async root => {
  const { packageRoot, spec } = await fixture(root);
  await writeFile(join(packageRoot, 'unreviewed'), 'x');
  await assert.rejects(verifyCache(root, 'key', spec), /CACHE_INTEGRITY/);
}));

test('manifest references cannot point to absent files', () => sandbox(async root => {
  const { packageRoot } = await fixture(root);
  const path = join(packageRoot, 'lib.json');
  const manifest = JSON.parse(await readFile(path));
  manifest.agent = { extra: { path: 'missing.md', sha256: '0'.repeat(64) } };
  await atomicJson(path, manifest);
  await assert.rejects(verifyRoot(packageRoot, 'unit', '1.0.0'), /missing manifest file/);
}));

test('timeout terminates a child that ignores SIGTERM and saves the reason', () => sandbox(async root => {
  const logs = join(root, 'logs/timeout');
  await assert.rejects(command(process.execPath,
    ['-e', 'process.on("SIGTERM",()=>{}); console.log("started"); setInterval(()=>{},50)'],
    { cwd: root, logs, timeout: 150 }), /COMMAND_FAILED/);
  const status = JSON.parse(await readFile(logs + '.command.json'));
  assert.equal(status.timed_out, true); assert.equal(status.signal, 'SIGKILL');
}));

test('failed command retains stdout, stderr and terminal status', () => sandbox(async root => {
  const logs = join(root, 'logs/build');
  await assert.rejects(command(process.execPath,
    ['-e', 'console.log("partial"); console.error("intentional"); process.exit(7)'],
    { cwd: root, logs }), /COMMAND_FAILED/);
  assert.match(await readFile(logs + '.stdout.log', 'utf8'), /partial/);
  assert.match(await readFile(logs + '.stderr.log', 'utf8'), /intentional/);
  assert.equal(JSON.parse(await readFile(logs + '.command.json')).exit_code, 7);
}));

test('atomic progress replacement never treats partial work as success', () => sandbox(async root => {
  const file = join(root, 'progress.json');
  await atomicJson(file, { accepted: false, state: 'building' });
  await atomicJson(file, { accepted: false, state: 'failed', error: 'expected' });
  const progress = JSON.parse(await readFile(file));
  assert.equal(progress.accepted, false); assert.equal(progress.state, 'failed');
}));
