import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const manifest = resolve(root, 'libsrc/qualification/data-rust-foundation/Cargo.toml');
const lock = resolve(root, 'libsrc/qualification/data-rust-foundation/Cargo.lock');

const result = spawnSync('cargo', [
  '+1.96.0', 'check', '--locked', '--target', 'wasm32-unknown-unknown',
  '--manifest-path', manifest,
], { cwd: root, encoding: 'utf8', timeout: 600000, maxBuffer: 64 << 20, env: process.env });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr + '\n' + result.stdout);

const text = await readFile(lock, 'utf8');
const found = new Map();
for (const block of text.split('[[package]]')) {
  const name = block.match(/\nname = "([^"]+)"/)?.[1];
  const version = block.match(/\nversion = "([^"]+)"/)?.[1];
  if (name && version) found.set(name, version);
}
const expected = new Map([
  ['serde_json', '1.0.151'],
  ['csv-core', '0.1.13'],
  ['regex', '1.13.1'],
  ['lexical-core', '1.0.6'],
  ['hashbrown', '0.17.1'],
  ['indexmap', '2.14.2'],
  ['itertools', '0.15.0'],
  ['ordered-float', '5.5.0'],
  ['rust_decimal', '1.43.0'],
  ['ndarray', '0.17.2'],
  ['arrow-schema', '60.0.0'],
  ['arrow-array', '60.0.0'],
  ['arrow-select', '60.0.0'],
  ['arrow-ord', '60.0.0'],
  ['arrow-arith', '60.0.0'],
  ['arrow-csv', '60.0.0'],
  ['arrow-json', '60.0.0'],
  ['arrow-cast', '60.0.0'],
  ['arrow-ipc', '60.0.0'],
  ['parquet', '60.0.0'],
]);
const packages = [];
for (const [name, version] of expected) {
  assert.equal(found.get(name), version, name + ' pinned version drift');
  packages.push(name + '@' + version);
}
console.log(JSON.stringify({
  accepted: true,
  schema: 'wasmc.data-rust-foundation/v1',
  target: 'wasm32-unknown-unknown',
  rust: '1.96.0',
  packages,
  count: packages.length,
}));
