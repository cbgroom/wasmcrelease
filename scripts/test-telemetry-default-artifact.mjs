// Read-only gate for a private producer's independently pinned default build.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [artifact, expectedSha256] = process.argv.slice(2);
assert.ok(artifact && process.argv.length === 4, 'artifact and expected SHA256 required');
assert.match(expectedSha256, /^[0-9a-f]{64}$/, 'independent expected digest required');
const file = resolve(artifact), before = lstatSync(file);
assert.ok(before.isFile() && !before.isSymbolicLink(), 'regular artifact required');
assert.ok(before.size > 0 && before.size <= 2 * 1024 * 1024, 'bounded artifact');
const bytes = readFileSync(file), after = lstatSync(file);
assert.equal(before.ino, after.ino); assert.equal(before.size, after.size);
assert.equal(before.mtimeMs, after.mtimeMs); assert.equal(bytes.length, before.size);
const actual = createHash('sha256').update(bytes).digest('hex');
assert.equal(actual, expectedSha256, 'artifact differs from independent receipt');
const module = new WebAssembly.Module(bytes);
const intrinsics = [
  { module: '[export]wasmc:system-telemetry/monitor@0.0.1', name: '[resource-drop]sampler', kind: 'function' },
  { module: '[export]wasmc:system-telemetry/monitor@0.0.1', name: '[resource-new]sampler', kind: 'function' },
];
const ordered = rows => rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
assert.deepEqual(ordered(WebAssembly.Module.imports(module)), ordered(intrinsics), 'only exact canonical resource intrinsic set');
const exports = new Map(WebAssembly.Module.exports(module).map(row => [row.name, row.kind]));
for (const name of ['[constructor]sampler', '[method]sampler.refresh-mask', '[method]sampler.sample', 'encode-frame']) {
  assert.equal(exports.get('wasmc:system-telemetry/monitor@0.0.1#' + name), 'function', 'missing declared WIT export');
}
const run = spawnSync('wasm-tools', ['component', 'wit', file], { encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
assert.ifError(run.error); assert.equal(run.status, 0, run.stderr);
assert.match(run.stdout, /export wasmc:system-telemetry\/monitor@0\.0\.1;/);
console.log(JSON.stringify({ accepted: true, artifact_sha256: actual, bytes: bytes.length,
  canonical_resource_intrinsics: intrinsics, os_host_authorities: [], scope: 'default-build WIT/import/export integrity only', release_qualified: false }));
