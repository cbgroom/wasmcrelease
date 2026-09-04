#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (path) => JSON.parse(await readFile(join(root, path), 'utf8'));

async function walk(dir = '') {
  const rows = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === '.DS_Store' || entry.name === 'target' || entry.name.endsWith('.tmp')) continue;
    const rel = join(dir, entry.name).split('\\').join('/');
    if (entry.isDirectory()) rows.push(...await walk(rel));
    else if (entry.isFile()) rows.push(rel);
  }
  return rows;
}

const manifest = await json('manifest.json');
const release = await json('release.json');
const index = await json('package-index.json');
if (manifest.version !== release.version || release.version !== index.latest || release.tag !== `v${index.latest}`) throw new Error('release identities differ');
for (const row of manifest.artifacts) {
  const bytes = await readFile(join(root, row.path));
  const info = await stat(join(root, row.path));
  if (bytes.length !== row.bytes || sha(bytes) !== row.sha256) throw new Error(`manifest identity mismatch: ${row.path}`);
  const mode = (info.mode & 0o111) ? '0755' : '0644';
  if (mode !== row.mode) throw new Error(`manifest mode mismatch: ${row.path}`);
}
for (const row of release.artifacts) {
  const bytes = await readFile(join(root, row.path));
  if (bytes.length !== row.bytes || sha(bytes) !== row.sha256) throw new Error(`release identity mismatch: ${row.path}`);
}
const checksumLines = (await readFile(join(root, 'SHA256SUMS'), 'utf8')).trimEnd().split('\n');
const checksumPaths = [];
for (const line of checksumLines) {
  const split = line.indexOf('  ');
  const expected = line.slice(0, split);
  const path = line.slice(split + 2);
  checksumPaths.push(path);
  if (sha(await readFile(join(root, path))) !== expected) throw new Error(`SHA256SUMS mismatch: ${path}`);
}
const versions = new Map(index.versions.map((row) => [row.version, row]));
if (!versions.has(index.latest)) throw new Error('latest missing from versions');

if (release.compatibility?.byte_frozen) {
  const dirtyCompat = await execFileAsync('git', ['status', '--porcelain', '--', 'dist', 'package', 'libs'], { cwd: root });
  if (dirtyCompat.stdout.trim()) throw new Error(`frozen compatibility tree changed: ${dirtyCompat.stdout.trim()}`);
  for (const name of ['dist', 'package', 'libs']) {
    const expected = release.compatibility.git_trees?.[name];
    const actual = (await execFileAsync('git', ['rev-parse', `HEAD:${name}`], { cwd: root })).stdout.trim();
    if (!expected || actual !== expected) throw new Error(`frozen compatibility tree identity drifted: ${name}`);
  }
}

for (const path of (await walk()).filter((path) => path.endsWith('.md'))) {
  const text = await readFile(join(root, path), 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|#|mailto:)/.test(target)) continue;
    const local = target.split('#', 1)[0];
    if (local) await stat(resolve(dirname(join(root, path)), local));
  }
}

const py = (await walk()).filter((path) => path.endsWith('.py') || path.includes('__pycache__/'));
if (py.length) throw new Error(`active Python remains: ${py.join(', ')}`);
const checksumExpected = (await walk()).filter((path) => path !== 'SHA256SUMS').sort();
if (JSON.stringify(checksumPaths) !== JSON.stringify(checksumExpected)) {
  throw new Error('SHA256SUMS path inventory is incomplete, duplicated, or out of order');
}

const runtime = await json('runtime/wasmc-runtime-v0/manifest.json');
const receipt = await json('runtime/wasmc-runtime-v0/receipts/compiler-wasm.json');
const compiler = await readFile(join(root, 'runtime/wasmc-runtime-v0/compiler.wasm'));
const runtimeManifestBytes = await readFile(join(root, 'runtime/wasmc-runtime-v0/manifest.json'));
if (runtime.schema !== 'wasmc.runtime-package/v0' || runtime.id !== 'wasmc:runtime') throw new Error('runtime manifest identity drifted');
if (compiler.length !== runtime.compiler.file.bytes || sha(compiler) !== runtime.compiler.file.sha256) throw new Error('runtime compiler identity drifted');
if (receipt.compiler.sha256 !== runtime.compiler.file.sha256 || receipt.manifest.sha256 !== sha(runtimeManifestBytes)) throw new Error('runtime receipt drifted');
await WebAssembly.compile(compiler);
const registry = await json('runtime/registry-v0/registry.json');
const descriptor = await json('runtime/registry-v0/packages/wasmc-runtime/0.1.0-runtime-v0.json');
if (
  registry.id !== 'wasmc-registry' ||
  descriptor.id !== 'wasmc:runtime' ||
  descriptor.compiler.sha256 !== runtime.compiler.file.sha256 ||
  descriptor.manifest.sha256 !== receipt.manifest.sha256
) {
  throw new Error('runtime registry identity drifted');
}

const hostArchives = new Set();
for (const name of ['node', 'bun', 'deno']) {
  const hostReceipt = await json(`runtime/wasmc-runtime-v0/receipts/${name}-self-test.json`);
  const execution = hostReceipt.execution;
  if (
    hostReceipt.schema !== 'wasmc.runtime-js-self-test/v0' ||
    hostReceipt.accepted !== true ||
    hostReceipt.runtime !== name ||
    hostReceipt.candidate_commit !== release.runtime.product_candidate_commit ||
    hostReceipt.compiler_bytes !== compiler.length ||
    hostReceipt.compiler_sha256 !== sha(compiler) ||
    typeof hostReceipt.runtime_version !== 'string' || !hostReceipt.runtime_version ||
    hostReceipt.source_free_package?.archive_sha256 !== release.runtime.source_free_archive_sha256 ||
    hostReceipt.source_free_package?.private_source_checked_out !== false ||
    typeof hostReceipt.host?.hostname !== 'string' || !hostReceipt.host.hostname ||
    typeof hostReceipt.host?.uname !== 'string' || !hostReceipt.host.uname ||
    execution?.self_test !== true || execution?.compile !== true ||
    execution?.compile_output_bytes !== 44 || execution?.wasm_validate !== true ||
    execution?.instantiate !== true || execution?.oracle_export !== 'run' ||
    JSON.stringify(execution?.oracle_args) !== JSON.stringify([6, 18]) || execution?.oracle_result !== 42
  ) throw new Error(`strict Host receipt drifted: ${name}`);
  hostArchives.add(hostReceipt.source_free_package.archive_sha256);
}
if (hostArchives.size !== 1) throw new Error('Host receipts do not bind one source-free Runtime archive');

console.log('PASS release/manifest/checksum/runtime/Host evidence integrity and active Python=0');
