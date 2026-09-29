#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const qualificationPath = resolve(root, 'admission/portable-libs-v018/qualification.json');
const qualification = JSON.parse(readFileSync(qualificationPath, 'utf8'));
assert.equal(qualification.schema, 'wasmc.portable-libs-v018-qualification/v1');
assert.equal(qualification.claims.qualified, true);
assert.equal(qualification.claims.admitted, false);
assert.match(qualification.source_authority, /^[0-9a-f]{40}$/);
execFileSync('git', ['merge-base', '--is-ancestor', qualification.source_authority, 'HEAD'], {
  cwd: root,
});

const cohort = [
  {
    id: 'wasmc-router-policy',
    witPackage: 'wasmc:router-policy@0.0.1',
    world: 'router-policy',
    description: 'Use reviewed import-free request routing policy decisions.',
    ecosystem: 'request routing policy',
    backend: 'wasm-tools',
    source: 'src/router-policy.wat',
    registryGate: 'behavior-equivalence-and-wit-shape',
  },
  {
    id: 'wasmc-json',
    witPackage: 'wasmc:json@0.0.1',
    world: 'json',
    description: 'Use reviewed bounded JSON validation, compaction and pointer selection.',
    ecosystem: 'bounded JSON document processing',
    backend: 'cargo',
    artifact: 'wasmc_json_public.wasm',
    registryGate: 'resource-boundary-calibration-and-multi-engine',
  },
  {
    id: 'wasmc-compression',
    witPackage: 'wasmc:compression@0.0.1',
    world: 'compression',
    description: 'Use reviewed deterministic bounded gzip compression and decompression.',
    ecosystem: 'bounded deterministic gzip',
    backend: 'cargo',
    artifact: 'wasmc_compression_public.wasm',
    registryGate: 'resource-boundary-calibration-and-multi-engine',
  },
  {
    id: 'wasmc-http1',
    witPackage: 'wasmc:http1-server@0.0.1',
    world: 'http1-server',
    description: 'Use reviewed bounded HTTP/1 request framing and response-head serialization.',
    ecosystem: 'bounded HTTP/1 wire processing',
    backend: 'cargo',
    artifact: 'wasmc_http1_public.wasm',
    registryGate: 'resource-boundary-calibration-and-broader-protocol-coverage',
  },
];

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fileRow = (path, format) => {
  const bytes = readFileSync(path);
  return { bytes: bytes.length, format, path: path.split('/').at(-1), sha256: sha256(bytes) };
};
const run = (command, args) => execFileSync(command, args, {
  cwd: root,
  stdio: 'inherit',
  timeout: 1_800_000,
});

const registryPath = resolve(root, 'libsrc/registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
mkdirSync(resolve(root, 'admission/portable-libs-v018'), { recursive: true });

for (const spec of cohort) {
  const entry = registry.candidates.find(row => row.id === spec.id);
  assert(entry, spec.id + ': missing registry entry');
  assert.equal(entry.stage, 'public-source-candidate');
  assert.equal(entry.version, '0.0.1-dev.1');
  assert.equal(entry.next_gate, spec.registryGate);

  const sourceRoot = resolve(root, entry.source_root);
  const candidatePath = resolve(sourceRoot, 'candidate.json');
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
  assert.equal(candidate.admitted, false);
  assert.deepEqual(candidate.pending_gates, ['admission-review']);
  const qualified = qualification.packages.find(row => row.id === spec.id);
  assert(qualified, spec.id + ': missing qualification row');
  assert.equal(qualified.independent_second_build_byte_identical, true);
  if (spec.id === 'wasmc-router-policy') {
    assert.equal(qualified.behavior.component_wit_executable, true);
    assert.ok(qualified.behavior.component_cases >= 4);
  } else {
    assert.equal(qualified.behavior.resource_boundary_calibration.equivalent, true);
  }
  if (spec.id === 'wasmc-http1') {
    assert.equal(qualified.behavior.broader_status_header_coverage.equivalent, true);
    assert.ok(qualified.behavior.broader_status_header_coverage.status_codes >= 1001);
  }

  let builtCore;
  const packageRoot = resolve(root, 'libs', spec.id);
  assert.equal(existsSync(packageRoot), false, spec.id + ': immutable package already exists');
  mkdirSync(resolve(packageRoot, 'references'), { recursive: true });
  if (spec.backend === 'cargo') {
    run('cargo', [
      '+1.96.0', 'build', '--release', '--locked', '--target',
      'wasm32-unknown-unknown', '--manifest-path', `${entry.source_root}/Cargo.toml`,
    ]);
    builtCore = resolve(
      sourceRoot, 'target/wasm32-unknown-unknown/release', spec.artifact,
    );
    copyFileSync(builtCore, resolve(packageRoot, 'artifact.wasm'));
    run('wasm-tools', [
      'component', 'new', resolve(packageRoot, 'artifact.wasm'),
      '-o', resolve(packageRoot, 'component.wasm'),
    ]);
  } else {
    builtCore = resolve(packageRoot, 'artifact.wasm');
    run('wasm-tools', ['parse', resolve(sourceRoot, spec.source), '-o', builtCore]);
    const embedded = resolve(packageRoot, 'artifact.embedded.wasm');
    run('wasm-tools', [
      'component', 'embed', resolve(sourceRoot, candidate.wit), builtCore,
      '-o', embedded,
    ]);
    run('wasm-tools', [
      'component', 'new', embedded, '-o', resolve(packageRoot, 'component.wasm'),
    ]);
    rmSync(embedded);
  }
  chmodSync(resolve(packageRoot, 'artifact.wasm'), 0o644);
  chmodSync(resolve(packageRoot, 'component.wasm'), 0o644);
  const artifact = readFileSync(resolve(packageRoot, 'artifact.wasm'));
  const component = readFileSync(resolve(packageRoot, 'component.wasm'));
  assert.equal(WebAssembly.validate(artifact), true, spec.id + ': invalid Core artifact');
  assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(artifact)), []);
  assert.equal(sha256(artifact), qualified.artifact.sha256, spec.id + ': Core qualification drift');
  assert.equal(sha256(component), qualified.component.sha256, spec.id + ': Component qualification drift');

  const wit = readFileSync(resolve(sourceRoot, candidate.wit), 'utf8');
  assert.ok(wit.includes(`package ${spec.witPackage};`));
  assert.match(wit, new RegExp(`\\bworld\\s+${spec.world}\\b`));
  writeFileSync(resolve(packageRoot, 'lib.wit'), wit);
  const apis = [...wit.matchAll(/^\s*([a-z][a-z0-9-]*):\s*func\b/gm)]
    .map(match => match[1])
    .sort();
  assert.ok(apis.length > 0, spec.id + ': no public functions');
  const delta = {
    schema: 'wasmc.lib-agent-delta/v0',
    apis: apis.map(api => ({
      api,
      ecosystem: spec.ecosystem,
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
name: ${spec.id}
description: "${spec.description}"
metadata:
  wasmc:
    version: "0.0.1"
---

# Lib usage

Read \`lib.wit\` and \`references/agent-delta.json\`.
Reuse WIT and ecosystem knowledge; learn only declared deltas.
Use snake_case in wasmc and kebab-case at WIT boundaries.
Call only supported APIs and preserve the documented resource bounds.
This import-free Lib grants no Host, network, filesystem, process or device authority.
`);

  const skillPath = resolve(packageRoot, 'SKILL.md');
  const deltaPath = resolve(packageRoot, 'references/agent-delta.json');
  const build = spec.backend === 'cargo' ? {
    backend: 'cargo',
    inputs: [{
      kind: 'cargo-lock',
      path: `${entry.source_root}/Cargo.lock`,
      sha256: sha256(readFileSync(resolve(sourceRoot, 'Cargo.lock'))),
    }],
    language: 'rust',
    locked: true,
    offline: false,
    profile: 'release',
    target: 'wasm32-unknown-unknown',
    toolchain: qualification.toolchain.rustc,
  } : {
    backend: 'wasm-tools',
    inputs: [{
      kind: 'wat-source',
      path: `${entry.source_root}/${spec.source}`,
      sha256: sha256(readFileSync(resolve(sourceRoot, spec.source))),
    }],
    language: 'wat',
    locked: true,
    toolchain: qualification.toolchain.wasm_tools,
  };
  const manifest = {
    agent: {
      delta: { path: 'references/agent-delta.json', sha256: sha256(readFileSync(deltaPath)) },
      skill: { path: 'SKILL.md', sha256: sha256(readFileSync(skillPath)) },
    },
    admission: {
      approved: true,
      date: '2026-09-29',
      qualification: 'admission/portable-libs-v018/qualification.json',
      source_authority: qualification.source_authority,
    },
    artifact: fileRow(resolve(packageRoot, 'artifact.wasm'), 'core-wasm'),
    build,
    compatibility: { abi_epoch: 1, wasmc_min: '0.0.1' },
    component: fileRow(resolve(packageRoot, 'component.wasm'), 'component-wasm'),
    id: spec.id,
    qualification: {
      behavior: candidate.qualification.script,
      behavior_cases: qualified.behavior.cases,
      core_imports: 0,
      deterministic_second_build: true,
      wasmi: 'scripts/test-libsrc-wasmi.mjs',
    },
    schema: 'wasmc.lib/v0',
    version: '0.0.1',
    wit: {
      package: spec.witPackage,
      path: 'lib.wit',
      sha256: sha256(readFileSync(resolve(packageRoot, 'lib.wit'))),
      world: spec.world,
    },
  };
  writeFileSync(resolve(packageRoot, 'lib.json'), JSON.stringify(manifest, null, 2) + '\n');
  assert.ok(statSync(resolve(packageRoot, 'artifact.wasm')).size > 0);

  const receipt = {
    schema: 'wasmc.lib-admission/v1',
    id: spec.id,
    version: '0.0.1',
    date: '2026-09-29',
    source_authority: qualification.source_authority,
    qualification: ['admission/portable-libs-v018/qualification.json'],
    package: {
      root: `libs/${spec.id}`,
      wit_package: spec.witPackage,
      manifest_sha256: sha256(readFileSync(resolve(packageRoot, 'lib.json'))),
      core_sha256: manifest.artifact.sha256,
      component_sha256: manifest.component.sha256,
      wit_sha256: manifest.wit.sha256,
      bytes: manifest.artifact.bytes,
      core_imports: 0,
    },
    states: {
      qualified: true,
      admitted: true,
      released: false,
      discoverable: false,
      installable: false,
    },
    next_gate: 'immutable-release-candidate-inclusion',
  };
  writeFileSync(
    resolve(root, 'admission/portable-libs-v018', `${spec.id}-admission.json`),
    JSON.stringify(receipt, null, 2) + '\n',
  );

  candidate.version = '0.0.1';
  candidate.completed_gates.push('admission-review');
  candidate.pending_gates = [];
  candidate.admitted = true;
  candidate.admission = {
    date: '2026-09-29',
    package: `libs/${spec.id}`,
    qualification: 'admission/portable-libs-v018/qualification.json',
    source_authority: qualification.source_authority,
  };
  writeFileSync(candidatePath, JSON.stringify(candidate, null, 2) + '\n');
  entry.version = '0.0.1';
  entry.stage = 'admitted';
  entry.next_gate = null;
}

writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(JSON.stringify({
  accepted: true,
  admitted: cohort.map(row => row.id),
  source_authority: qualification.source_authority,
}));
