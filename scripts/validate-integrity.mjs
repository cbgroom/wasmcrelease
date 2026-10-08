#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readdir, readFile, stat, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (path) => JSON.parse(await readFile(join(root, path), 'utf8'));
const executableArtifacts = new Set(['dist/wasmc.mjs', 'package/cli.mjs', 'current/wasmc.mjs', 'current/cli.mjs', 'scripts/validate-maintainer.sh', 'scripts/validate-source-free-runtime.sh']);
const expectedMode = (path) => executableArtifacts.has(path) ? '0755' : '0644';

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
let previousArtifact='';
for (const row of manifest.artifacts) {
  if(!/^[A-Za-z0-9._/-]+$/.test(row.path)||row.path.split('/').includes('..')||row.path<=previousArtifact)throw Error('manifest path inventory rejected');
  previousArtifact=row.path;
  if(!(await lstat(join(root,row.path))).isFile())throw Error('nonregular manifest artifact: '+row.path);
  const bytes = await readFile(join(root, row.path));
  const info = await stat(join(root, row.path));
  if (bytes.length !== row.bytes || sha(bytes) !== row.sha256) throw new Error(`manifest identity mismatch: ${row.path}`);
  const mode = (info.mode & 0o111) ? '0755' : '0644';
  if (mode !== row.mode) throw new Error(`manifest mode mismatch: ${row.path}`);
  if (mode !== expectedMode(row.path)) throw new Error(`artifact mode violates release policy: ${row.path}`);
}
if (release.schema === 'wasmc-public-release/v1') {
  for (const row of release.artifacts) {
    const bytes = await readFile(join(root, row.path));
    if (bytes.length !== row.bytes || sha(bytes) !== row.sha256) throw new Error(`release identity mismatch: ${row.path}`);
  }
} else if (release.schema === 'wasmc-public-release/v2') {
  if (
    release.artifacts !== undefined ||
    release.artifact_inventory?.path !== 'manifest.json' ||
    release.artifact_inventory?.integrity !== 'SHA256SUMS' ||
    !Number.isSafeInteger(release.artifact_inventory?.artifacts) ||
    release.artifact_inventory.artifacts < 1
  ) throw new Error('compact release artifact inventory rejected');
  const releaseInventory = release.version==='0.0.21'?manifest.artifacts:manifest.artifacts.filter((row) => !['AGENTS.md', 'LANGUAGE.md', 'LIB.md'].includes(row.path));
  if (release.artifact_inventory.artifacts !== releaseInventory.length) throw new Error('compact release artifact count mismatch');
} else {
  throw new Error('unsupported release schema');
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
  const dirtyCompat = await execFileAsync('git', ['status', '--porcelain', '--', 'dist', 'package'], { cwd: root });
  if (dirtyCompat.stdout.trim()) throw new Error(`frozen compatibility tree changed: ${dirtyCompat.stdout.trim()}`);
  for (const name of ['dist', 'package']) {
    const expected = release.compatibility.git_trees?.[name];
    const actual = (await execFileAsync('git', ['rev-parse', `HEAD:${name}`], { cwd: root })).stdout.trim();
    if (!expected || actual !== expected) throw new Error(`frozen compatibility tree identity drifted: ${name}`);
  }
  const frozenLibTrees = new Map([
    ['wasmc-host-clock', '1765a253b0c4c7f87687c47929d8410803a40660'],
    ['wasmc-owned-algorithms', '524dd5879655dedc3e9b36b5d18f48f823d83929'],
    ['wasmc-resource-counter', '728d0c80ee6258fc76535d1b132dd33410752e62'],
  ]);
  for (const [name, expected] of frozenLibTrees) {
    const path = `libs/${name}`;
    const dirty = await execFileAsync('git', ['status', '--porcelain', '--', path], { cwd: root });
    if (dirty.stdout.trim()) throw new Error(`frozen historical Lib changed: ${dirty.stdout.trim()}`);
    const actual = (await execFileAsync('git', ['rev-parse', `HEAD:${path}`], { cwd: root })).stdout.trim();
    if (actual !== expected) throw new Error(`frozen historical Lib identity drifted: ${path}`);
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

// The current whole release is one exact v3 candidate; historical staging
// fallback cannot authorize replacement compiler or Root bytes.
if(release.version==='0.0.21') {
  const {validateCandidate}=await import('./release-candidate.mjs');
  const candidate=await json(release.staged_product_manifest);
  assert.equal(candidate.schema,'wasmc.release-product-candidate/v3');
  assert.equal(candidate.version,release.version);
  assert.equal(release.stage,'prod');
  assert.equal(release.staged_product_manifest,`channels/candidates/${release.version}.json`);
  assert.equal(release.compatibility?.byte_frozen??false,false);
  assert.equal(candidate.compiler_source_authority,release.source_commit);
  assert.equal(candidate.lib_source_authority,release.lib_source_authority);
  for(const k of ['source_commit','source_tree','lib_source_authority','product_candidate_commit','evidence_commit'])assert.match(release[k]??'',/^[0-9a-f]{40}$/);
  const bytes=new Map();for(const r of candidate.product_files)bytes.set(r.path,await readFile(join(root,r.path)));
  validateCandidate(candidate,p=>bytes.get(p));
  const rows=new Map(manifest.artifacts.map(r=>[r.path,r]));
  for(const path of candidate.stage_metadata_paths)assert.ok(rows.has(path),'lifecycle projection missing from final manifest: '+path);
  for(const r of candidate.product_files){const actual=rows.get(r.path);assert.ok(actual,'candidate file absent from manifest: '+r.path);assert.equal(actual.bytes,r.bytes);assert.equal(actual.sha256,r.sha256);}
  for(const stage of ['dev','main','prod']) {
    const pointer=await json(`channels/${stage}.json`);
    assert.equal(pointer.schema,'wasmc.release-stage/v1');assert.equal(pointer.stage,stage);
    assert.equal(pointer.version,release.version);assert.equal(pointer.product_candidate_commit,release.product_candidate_commit);
    assert.equal(pointer.product_set_sha256,candidate.product_set_sha256);
    if(stage==='prod'){assert.equal(pointer.tag,release.tag);assert.equal(pointer.qualification?.accepted,true);assert.equal(pointer.qualification.tested_product_set_sha256,candidate.product_set_sha256);}
  }
  const provenance=await json('provenance.json');
  assert.equal(provenance.predicate_type,'wasmc.public-release.provenance/v3');
  assert.deepEqual(provenance.source,{integrated_private_commit:release.source_commit,integrated_private_tree:release.source_tree,lib_source_authority:release.lib_source_authority,product_candidate_commit:release.product_candidate_commit,evidence_commit:release.evidence_commit,dirty:false});
  assert.equal(provenance.staged_product_manifest,release.staged_product_manifest);
  assert.equal(provenance.product_set_sha256,candidate.product_set_sha256);
  assert.equal(provenance.compiler_sha256,candidate.current_release_closure.compiler_sha256);
  assert.equal(provenance.current_catalog_sha256,candidate.current_catalog.sha256);
  assert.deepEqual(provenance.subjects,manifest.artifacts.map(r=>({name:r.path,bytes:r.bytes,digest:{sha256:r.sha256}})));
  await execFileAsync(process.execPath,[join(root,'scripts/current-compiler-integrity.mjs'),'--require-qualification']);
  await execFileAsync(process.execPath,[join(root,'scripts/validate-license-policy.mjs')]);
  const q=await json('current/qualification.json');
  assert.equal(q.compiler_private_source_present,false);assert.equal(q.version,release.version);
  assert.equal(q.runs.length,9);assert.equal(q.rejection_controls.exit_code,0);assert.equal(q.rejection_controls.result.actual_rejections,6);
  for(const engine of ['node','bun','deno']){
    const runs=q.runs.filter(r=>r.engine===engine);assert.equal(runs.length,3);
    for(const r of runs){assert.equal(r.exit_code,0);assert.equal(r.result.accepted,true);assert.ok(r.version);}
    const compiler=runs.find(r=>r.args.at(-1)==='scripts/test-current-compiler.mjs');
    assert.equal(compiler?.result.compiler_sha256,q.compiler_sha256);assert.equal(compiler.result.frozen_outputs,35);assert.equal(compiler.result.execution_oracles,7);assert.equal(compiler.result.cli_outputs,25);
    const std=runs.find(r=>r.args.at(-1)==='examples/current/standard.mjs');
    assert.equal(std?.result.standard_lib,'wasmc:std@1.4.1');assert.equal(std.result.functions,73);assert.equal(std.result.consumer_calls,7680);
    const managed=runs.find(r=>r.args.at(-1)==='scripts/test-current-lib-api-v021.mjs');
    assert.equal(managed?.result.provider,'4.9.0');assert.equal(managed.result.compileLib_oracles,3);assert.equal(managed.result.instantiateLib_oracles,3);assert.equal(managed.result.calls,768);assert.equal(managed.result.old_provider_fallback,false);
  }
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

const releaseRuntimeMatches =
  release.runtime.compiler_bytes === compiler.length &&
  release.runtime.compiler_sha256 === sha(compiler);
let expectedHostCommit = releaseRuntimeMatches ? release.runtime.product_candidate_commit : null;
let expectedHostArchive = releaseRuntimeMatches ? release.runtime.source_free_archive_sha256 : null;
if(release.version==='0.0.21'&&!releaseRuntimeMatches)throw Error('current whole release Runtime compiler authority differs');
if (!releaseRuntimeMatches) {
  const dev = await json('channels/dev.json');
  const candidatePath = `channels/candidates/${dev.version}.json`;
  const candidate = await json(candidatePath);
  if (
    dev.schema !== 'wasmc.release-stage/v1' ||
    dev.stage !== 'dev' ||
    dev.product_candidate_commit.length !== 40 ||
    dev.product_set_sha256 !== candidate.product_set_sha256 ||
    candidate.version !== dev.version
  ) throw new Error('staged Runtime candidate authority drifted');
  const candidateFiles = new Map(candidate.product_files.map((row) => [row.path, row]));
  for (const path of [
    'runtime/wasmc-runtime-v0/compiler.wasm',
    'runtime/wasmc-runtime-v0/manifest.json',
    'runtime/wasmc-runtime-v0/receipts/compiler-wasm.json',
    'runtime/wasmc-runtime-v0/receipts/node-self-test.json',
    'runtime/wasmc-runtime-v0/receipts/bun-self-test.json',
    'runtime/wasmc-runtime-v0/receipts/deno-self-test.json'
  ]) {
    const row = candidateFiles.get(path);
    const bytes = await readFile(join(root, path));
    if (!row || row.bytes !== bytes.length || row.sha256 !== sha(bytes)) {
      throw new Error(`staged Runtime candidate file drifted: ${path}`);
    }
  }
}

const hostArchives = new Set();
const hostCommits = new Set();
for (const name of ['node', 'bun', 'deno']) {
  const hostReceipt = await json(`runtime/wasmc-runtime-v0/receipts/${name}-self-test.json`);
  const execution = hostReceipt.execution;
  if (
    hostReceipt.schema !== 'wasmc.runtime-js-self-test/v0' ||
    hostReceipt.accepted !== true ||
    hostReceipt.runtime !== name ||
    (expectedHostCommit !== null && hostReceipt.candidate_commit !== expectedHostCommit) ||
    hostReceipt.compiler_bytes !== compiler.length ||
    hostReceipt.compiler_sha256 !== sha(compiler) ||
    typeof hostReceipt.runtime_version !== 'string' || !hostReceipt.runtime_version ||
    (expectedHostArchive !== null && hostReceipt.source_free_package?.archive_sha256 !== expectedHostArchive) ||
    hostReceipt.source_free_package?.private_source_checked_out !== false ||
    typeof hostReceipt.host?.hostname !== 'string' || !hostReceipt.host.hostname ||
    typeof hostReceipt.host?.uname !== 'string' || !hostReceipt.host.uname ||
    execution?.self_test !== true || execution?.compile !== true ||
    execution?.compile_output_bytes !== 44 || execution?.wasm_validate !== true ||
    execution?.instantiate !== true || execution?.oracle_export !== 'run' ||
    JSON.stringify(execution?.oracle_args) !== JSON.stringify([6, 18]) || execution?.oracle_result !== 42
  ) throw new Error(`strict Host receipt drifted: ${name}`);
  hostCommits.add(hostReceipt.candidate_commit);
  hostArchives.add(hostReceipt.source_free_package.archive_sha256);
}
if (hostCommits.size !== 1) throw new Error('Host receipts do not bind one exact candidate commit');
if (hostArchives.size !== 1) throw new Error('Host receipts do not bind one source-free Runtime archive');

console.log(`PASS release/manifest/checksum/runtime/Host evidence integrity (${releaseRuntimeMatches ? 'prod' : 'staged-candidate'} authority) and active Python=0`);
