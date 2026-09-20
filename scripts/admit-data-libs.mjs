#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceAuthority = process.argv[2];
assert.match(sourceAuthority ?? '', /^[0-9a-f]{40}$/, 'usage: admit-data-libs.mjs SOURCE_AUTHORITY');

const cohort = [
  ['wasmc-data-core', 'wasmc:data-core@0.0.1', 'data-core', 'Use reviewed Arrow-backed Data Core types and validation.'],
  ['wasmc-csv', 'wasmc:csv@0.0.1', 'csv', 'Use reviewed CSV to DataBatch ingestion.'],
  ['wasmc-data-expr', 'wasmc:data-expr@0.0.1', 'data-expr', 'Use reviewed typed Data expression programs.'],
  ['wasmc-data-compute', 'wasmc:data-compute@0.0.1', 'data-compute', 'Use reviewed Arrow-backed Data compute kernels.'],
  ['wasmc-data-relational', 'wasmc:data-relational@0.0.1', 'data-relational', 'Use reviewed bounded relational operators and aggregates.'],
  ['wasmc-data-profile', 'wasmc:data-profile@0.0.1', 'data-profile', 'Use reviewed deterministic Data profiling.'],
  ['wasmc-data-interchange', 'wasmc:data-interchange@0.0.1', 'data-interchange', 'Use reviewed Arrow IPC and uncompressed Parquet interchange.'],
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fileRow = (path, format) => {
  const bytes = readFileSync(path);
  return {
    bytes: bytes.length,
    format,
    path: path.split('/').at(-1),
    sha256: sha(bytes),
  };
};

const registryPath = resolve(root, 'libsrc/registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
for (const [id, witPackage, world, description] of cohort) {
  const entry = registry.candidates.find(row => row.id === id);
  assert(entry, id + ': missing registry entry');
  assert.equal(entry.stage, 'public-source-candidate');
  assert.equal(entry.version, '0.0.1-dev.1');
  assert.equal(entry.next_gate, 'admission-review');

  const sourceRoot = resolve(root, entry.source_root);
  const candidatePath = resolve(sourceRoot, 'candidate.json');
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
  assert.equal(candidate.admitted, false);
  assert.deepEqual(candidate.pending_gates, ['admission-review']);
  assert.equal(candidate.build.final_package_source_free, true);
  assert.equal(candidate.build.embeds_third_party_source, false);

  const packageRoot = resolve(root, 'libs', id);
  assert.equal(existsSync(packageRoot), false, id + ': immutable package already exists');
  mkdirSync(resolve(packageRoot, 'references'), { recursive: true });
  const artifactPath = resolve(root, candidate.build.artifact);
  const artifact = readFileSync(artifactPath);
  assert.equal(WebAssembly.validate(artifact), true, id + ': invalid core artifact');
  assert.equal(WebAssembly.Module.imports(new WebAssembly.Module(artifact)).length, 0, id + ': core imports');
  copyFileSync(artifactPath, resolve(packageRoot, 'artifact.wasm'));
  chmodSync(resolve(packageRoot, 'artifact.wasm'), 0o644);
  execFileSync('wasm-tools', [
    'component',
    'new',
    resolve(packageRoot, 'artifact.wasm'),
    '-o',
    resolve(packageRoot, 'component.wasm'),
  ], { stdio: 'inherit' });

  const witPath = resolve(sourceRoot, candidate.wit);
  const wit = readFileSync(witPath, 'utf8');
  assert(wit.includes('package ' + witPackage + ';'));
  assert(new RegExp('\\bworld\\s+' + world + '\\b').test(wit));
  writeFileSync(resolve(packageRoot, 'lib.wit'), wit);
  const apis = [...wit.matchAll(/^\s*([a-z][a-z0-9-]*):\s*func\b/gm)]
    .map(match => match[1])
    .sort();
  assert(apis.length > 0, id + ': no public functions found');
  const delta = {
    schema: 'wasmc.lib-agent-delta/v0',
    apis: apis.map(api => ({
      api,
      ecosystem: description.replace(/^Use reviewed |\.$/g, ''),
      origin: 0,
      support: 0,
      implementation: 1,
    })),
  };
  writeFileSync(
    resolve(packageRoot, 'references/agent-delta.json'),
    JSON.stringify(delta) + '\n',
  );
  writeFileSync(resolve(packageRoot, 'SKILL.md'), `---
name: ${id}
description: "${description}"
metadata:
  wasmc:
    version: "0.0.1"
---

# Lib usage

Read \`lib.wit\` and \`references/agent-delta.json\`.
Reuse WIT and Rust knowledge; learn only declared deltas.
Use snake_case in wasmc and kebab-case at WIT boundaries.
Call only supported APIs. Bind only exact declared Host authorities.
Never use provider handles, plans, private lanes, or artifact tiers in source.
`);

  const lockPath = resolve(sourceRoot, 'Cargo.lock');
  const skillPath = resolve(packageRoot, 'SKILL.md');
  const deltaPath = resolve(packageRoot, 'references/agent-delta.json');
  const manifest = {
    agent: {
      delta: { path: 'references/agent-delta.json', sha256: sha(readFileSync(deltaPath)) },
      skill: { path: 'SKILL.md', sha256: sha(readFileSync(skillPath)) },
    },
    admission: {
      approved: true,
      date: '2026-09-20',
      source_authority: sourceAuthority,
    },
    artifact: fileRow(resolve(packageRoot, 'artifact.wasm'), 'core-wasm'),
    build: {
      backend: 'cargo',
      inputs: [{
        kind: 'cargo-lock',
        path: entry.source_root + '/Cargo.lock',
        sha256: sha(readFileSync(lockPath)),
      }],
      language: 'rust',
      locked: true,
      offline: false,
      profile: 'release',
      target: 'wasm32-unknown-unknown',
      toolchain: 'rustc 1.96.0',
    },
    compatibility: { abi_epoch: 1, wasmc_min: '0.0.1' },
    component: fileRow(resolve(packageRoot, 'component.wasm'), 'component-wasm'),
    id,
    qualification: {
      behavior: candidate.qualification.script,
      core_imports: 0,
      wasmi: 'scripts/test-libsrc-wasmi.mjs',
    },
    schema: 'wasmc.lib/v0',
    version: '0.0.1',
    wit: {
      package: witPackage,
      path: 'lib.wit',
      sha256: sha(readFileSync(resolve(packageRoot, 'lib.wit'))),
      world,
    },
  };
  writeFileSync(resolve(packageRoot, 'lib.json'), JSON.stringify(manifest, null, 2) + '\n');
  assert(statSync(resolve(packageRoot, 'artifact.wasm')).size > 0);

  candidate.version = '0.0.1';
  candidate.completed_gates.push('admission-review');
  candidate.pending_gates = [];
  candidate.admitted = true;
  candidate.admission = {
    date: '2026-09-20',
    package: 'libs/' + id,
    source_authority: sourceAuthority,
  };
  writeFileSync(candidatePath, JSON.stringify(candidate, null, 2) + '\n');
  entry.version = '0.0.1';
  entry.stage = 'admitted';
  entry.next_gate = null;
}
writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(JSON.stringify({
  accepted: true,
  admitted: cohort.length,
  version: '0.0.1',
  source_authority: sourceAuthority,
}));
