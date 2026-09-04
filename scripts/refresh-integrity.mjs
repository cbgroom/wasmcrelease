#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { arch, platform, release as osRelease } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const slash = (value) => value.split('\\').join('/');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fileSha = async (path) => sha(await readFile(join(root, path)));

async function walk(dir = '') {
  const base = join(root, dir);
  const rows = [];
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === '.DS_Store' || entry.name === 'target' || entry.name.endsWith('.tmp')) continue;
    const rel = slash(join(dir, entry.name));
    if (entry.isDirectory()) rows.push(...await walk(rel));
    else if (entry.isFile()) rows.push(rel);
  }
  return rows;
}

const releasePath = join(root, 'release.json');
const manifestPath = join(root, 'manifest.json');
const provenancePath = join(root, 'provenance.json');
const indexPath = join(root, 'package-index.json');
const releaseJson = JSON.parse(await readFile(releasePath, 'utf8'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const index = JSON.parse(await readFile(indexPath, 'utf8'));

const runtimeFiles = (await walk('runtime')).sort();
const rootSkillFiles = (await walk('skills/wasmc-developer')).sort();
const existing = releaseJson.artifacts.map((row) => row.path);
const releasePaths = [...new Set([...existing, ...runtimeFiles, ...rootSkillFiles])].sort();

releaseJson.artifacts = await Promise.all(releasePaths.map(async (path) => {
  const bytes = await readFile(join(root, path));
  return { path, bytes: bytes.length, sha256: sha(bytes) };
}));
await writeFile(releasePath, `${JSON.stringify(releaseJson, null, 2)}\n`);

const publicDocs = ['AGENTS.md', 'LANGUAGE.md', 'HOSTING.md', 'LIB.md'];
const manifestPaths = [...new Set([...publicDocs, ...releasePaths])];
manifest.release_id = `wasmc-v${releaseJson.version}`;
manifest.version = releaseJson.version;
manifest.release_date = '2026-09-04';
manifest.channel = 'release';
manifest.released = true;
manifest.stable = false;
manifest.tag = releaseJson.tag;
manifest.source_available = false;
manifest.compiler_abi = 'wasmc-core-compiler-abi-v0';
manifest.artifacts = await Promise.all(manifestPaths.map(async (path) => {
  const bytes = await readFile(join(root, path));
  const info = await stat(join(root, path));
  return { path, bytes: bytes.length, mode: (info.mode & 0o111) ? '0755' : '0644', sha256: sha(bytes) };
}));
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const runtimeManifestPath = 'runtime/wasmc-runtime-v0/manifest.json';
const runtimeCompilerPath = 'runtime/wasmc-runtime-v0/compiler.wasm';
const runtimeBootstrapPath = 'runtime/wasmc-runtime-v0/bootstrap.mjs';
const compatibilityCompilerPath = 'dist/wasmc_compiler.wasm';
const provenance = {
  schema_version: 1,
  predicate_type: 'wasmc.public-release.provenance/v1',
  builder: { node: process.version, machine: arch(), system: platform(), release: osRelease() },
  invocation: { commands: ['node runtime/wasmc-runtime-v0/bootstrap.mjs self-test', 'node scripts/refresh-integrity.mjs', './scripts/validate-maintainer.sh'] },
  materials: [
    { uri: 'https://github.com/cbgroom/wasmcrelease.git', digest: { gitCommit: '573dda3b5fd771596814f5546923974b9fc9cbd5' }, role: 'byte-frozen-v0.0.4-compatibility-surface' },
    { uri: 'https://github.com/yxsicd/wasmc.git', digest: { gitCommit: '62e33753f8c89ebba353f974c47beafac7921997' }, role: 'v0.0.5-runtime-source-authority' },
    { uri: 'git-tree', digest: { gitTree: '43098eb721cdb4006a1917e234184b70f77ea8a4' }, role: 'v0.0.5-runtime-source-tree' },
  ],
  source: {
    compatibility_public_commit: '573dda3b5fd771596814f5546923974b9fc9cbd5',
    runtime_private_commit: '62e33753f8c89ebba353f974c47beafac7921997',
    runtime_private_tree: '43098eb721cdb4006a1917e234184b70f77ea8a4',
    dirty: false,
  },
  subjects: await Promise.all([
    compatibilityCompilerPath,
    runtimeCompilerPath,
    runtimeBootstrapPath,
    runtimeManifestPath,
    'skills/wasmc-developer/SKILL.md',
  ].map(async (name) => {
    const bytes = await readFile(join(root, name));
    return { name, bytes: bytes.length, digest: { sha256: sha(bytes) } };
  })),
  non_claims: [
    'publisher signature or publisher authenticity',
    'cross-host byte-reproducible compiler-Wasm rebuilding',
    'Bun live-runtime evidence for the v0.0.5 Runtime package',
    'automatic installation, update, rollback, or authority grant',
    'v0.0.4 compatibility facades rebuilt from the v0.0.5 runtime source commit',
  ],
};
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);

if (index.latest !== releaseJson.version) throw new Error('package-index latest must equal release version before integrity refresh');
const allFiles = (await walk()).filter((path) => path !== 'SHA256SUMS').sort();
const sums = [];
for (const path of allFiles) sums.push(`${await fileSha(path)}  ${path}`);
await writeFile(join(root, 'SHA256SUMS'), `${sums.join('\n')}\n`);
console.log(`PASS refreshed ${releaseJson.tag}: release=${releasePaths.length} manifest=${manifestPaths.length} checksums=${allFiles.length}`);
