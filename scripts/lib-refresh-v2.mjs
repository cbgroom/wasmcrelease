#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repo = process.cwd();
const registryPath = resolve(repo, 'libspec/registry.json');
const policyPath = resolve(repo, 'libspec/rust-policy.json');
const lockAuthority = resolve(repo, 'libspec/Cargo.lock');

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repo,
    encoding: 'utf8',
    timeout: options.timeout ?? 300000,
    maxBuffer: 64 << 20,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(
      command +
        ' failed (' +
        result.status +
        ')\nstdout:\n' +
        result.stdout +
        '\nstderr:\n' +
        result.stderr,
    );
  }
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function parseArgs(argv) {
  const result = {
    all: false,
    updateLock: false,
    producer: process.env.WASMC_LIB_PRODUCER ?? null,
    out: process.env.WASMC_LIB_REFRESH_OUTPUT ?? null,
    ids: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') result.all = true;
    else if (arg === '--update-lock') result.updateLock = true;
    else if (arg === '--producer') result.producer = argv[++i];
    else if (arg === '--out') result.out = argv[++i];
    else if (arg.startsWith('-')) fail('unknown argument: ' + arg);
    else result.ids.push(arg);
  }
  if (result.all && result.ids.length) fail('use --all or explicit Lib ids, not both');
  return result;
}

function tomlQuote(value) {
  return JSON.stringify(value);
}

function renderCargoPackage(spec, policy) {
  const deps = ['wit-bindgen = ' + policy.wit_bindgen];
  const dependencyKeys = new Set(spec.dependencies ?? []);
  for (const sharedName of spec.shared_modules ?? []) {
    const shared = policy.shared_modules?.[sharedName];
    if (!shared) fail(spec.id + ': unknown shared module ' + sharedName);
    for (const key of shared.dependencies ?? []) dependencyKeys.add(key);
  }
  for (const key of [...dependencyKeys].sort()) {
    const row = policy.dependencies[key];
    if (!row) fail(spec.id + ': unknown dependency policy key ' + key);
    deps.push(key + ' = ' + row);
  }
  return [
    '[package]',
    'name = ' + tomlQuote(spec.crate),
    'version = ' + tomlQuote(spec.version),
    'edition = ' + tomlQuote(policy.edition),
    'publish = false',
    '',
    '[lib]',
    'crate-type = ["cdylib"]',
    '',
    '[dependencies]',
    ...deps,
    '',
  ].join('\n');
}

function renderWorkspace(entries, policy) {
  const members = entries.map(entry => '  "crates/' + entry.id + '",').join('\n');
  const p = policy.release_profile;
  return [
    '[workspace]',
    'resolver = "2"',
    'members = [',
    members,
    ']',
    '',
    '[profile.release]',
    'opt-level = ' + tomlQuote(p.opt_level),
    'lto = ' + String(p.lto),
    'codegen-units = ' + String(p.codegen_units),
    'panic = ' + tomlQuote(p.panic),
    'strip = ' + tomlQuote(p.strip),
    '',
  ].join('\n');
}

function generatedLibRs(spec, policy) {
  const shared = (spec.shared_modules ?? []).map(name => {
    const row = policy.shared_modules?.[name];
    if (!row) fail(spec.id + ': unknown shared module ' + name);
    return 'mod ' + row.module + ';';
  });
  return [
    'wit_bindgen::generate!({',
    '    path: "wit",',
    '    world: ' + JSON.stringify(spec.world) + ',',
    ...((spec.wit_dependencies ?? []).length ? ['    generate_all,'] : []),
    '});',
    '',
    ...shared,
    ...(shared.length ? [''] : []),
    'mod delta;',
    'mod adapter;',
    '',
    'use adapter::Adapter;',
    'export!(Adapter);',
    '',
  ].join('\n');
}

function producerSpec(spec) {
  return {
    apis: [...spec.apis].sort((left, right) => left.api.localeCompare(right.api, 'en')),
    rust: {
      artifact_name: spec.artifact_name,
      crate_dir: 'crates/' + spec.id,
      profile: 'wit-bindgen-component',
    },
    schema: 'wasmc.lib-build/v0',
    skill: {
      description: spec.description,
      name: spec.id,
      version: spec.version,
    },
    wit: 'lib.wit',
  };
}

const args = parseArgs(process.argv.slice(2));
if (!args.producer) {
  fail('exact producer required: pass --producer /absolute/path/to/wasmc or WASMC_LIB_PRODUCER');
}
if (!isAbsolute(args.producer)) fail('producer path must be absolute');
const producerStat = await stat(args.producer);
if (!producerStat.isFile()) fail('producer is not a file: ' + args.producer);
const generatorBytes = await readFile(new URL(import.meta.url));
const refreshStartedAt = Date.now();

const registryBytes = await readFile(registryPath);
const policyBytes = await readFile(policyPath);
const registry = JSON.parse(registryBytes);
const policy = JSON.parse(policyBytes);
assert.equal(registry.schema, 'wasmc.lib-refresh-registry/v2');
assert.equal(policy.schema, 'wasmc.lib-refresh-rust-policy/v2');

const allEntries = registry.libs;
const byId = new Map(allEntries.map(row => [row.id, row]));
const selected = args.all ? allEntries : args.ids.map(id => {
  const row = byId.get(id);
  if (!row) fail('unknown Lib id: ' + id);
  return row;
});
if (!selected.length) fail('select at least one Lib id or --all');

const specs = new Map();
const sourceDigests = {};
const sharedDigests = {};
for (const [name, shared] of Object.entries(policy.shared_modules ?? {})) {
  const bytes = await readFile(resolve(repo, shared.source));
  sharedDigests[name] = sha(bytes);
}
const expectedInventory = ['adapter.rs', 'delta.rs', 'lib.json', 'lib.wit'];
for (const entry of allEntries) {
  const sourceRoot = resolve(repo, entry.source);
  const inventory = (await readdir(sourceRoot)).sort();
  assert.deepEqual(inventory, expectedInventory, entry.id + ': V2 source inventory drift');
  const specBytes = await readFile(join(sourceRoot, 'lib.json'));
  const spec = JSON.parse(specBytes);
  assert.equal(spec.schema, 'wasmc.lib-refresh-source/v2');
  assert.equal(spec.id, entry.id);
  assert.ok(['value', 'resource', 'host', 'contract'].includes(spec.profile));
  if (spec.profile !== 'value') {
    fail(spec.id + ': profile ' + spec.profile + ' is declared but not implemented by Refresh V2 slice1');
  }
  specs.set(entry.id, spec);
  sourceDigests[entry.id] = {};
  for (const name of expectedInventory) {
    const bytes = await readFile(join(sourceRoot, name));
    sourceDigests[entry.id][name] = sha(bytes);
  }
}

const closureIds = new Set();
function addClosure(id) {
  if (closureIds.has(id)) return;
  const spec = specs.get(id);
  if (!spec) fail('dependency closure references unknown Lib id: ' + id);
  closureIds.add(id);
  for (const dependencyId of spec.wit_dependencies ?? []) addClosure(dependencyId);
}
for (const entry of selected) addClosure(entry.id);
const closureBuildEntries = [...closureIds].sort().map(id => {
  const entry = byId.get(id);
  return entry;
});
const closureEntries = closureBuildEntries.map(entry => ({
  id: entry.id,
  source: entry.source,
}));
const fingerprintSources = Object.fromEntries(
  [...closureIds].sort().map(id => [id, sourceDigests[id]]),
);
const usedSharedNames = new Set();
for (const id of closureIds) {
  for (const name of specs.get(id).shared_modules ?? []) usedSharedNames.add(name);
}
const fingerprintShared = Object.fromEntries(
  [...usedSharedNames].sort().map(name => [name, sharedDigests[name]]),
);
const usedDependencyKeys = new Set();
for (const id of closureIds) {
  for (const key of specs.get(id).dependencies ?? []) usedDependencyKeys.add(key);
  for (const sharedName of specs.get(id).shared_modules ?? []) {
    for (const key of policy.shared_modules?.[sharedName]?.dependencies ?? []) {
      usedDependencyKeys.add(key);
    }
  }
}
const fingerprintPolicy = {
  schema: policy.schema,
  toolchain: policy.toolchain,
  target: policy.target,
  edition: policy.edition,
  wit_bindgen: policy.wit_bindgen,
  release_profile: policy.release_profile,
  dependencies: Object.fromEntries(
    [...usedDependencyKeys].sort().map(key => [key, policy.dependencies[key]]),
  ),
  shared_modules: Object.fromEntries(
    [...usedSharedNames].sort().map(name => [name, policy.shared_modules[name]]),
  ),
};
const policyClosureSha256 = sha(Buffer.from(JSON.stringify(fingerprintPolicy)));

const producerBytes = await readFile(args.producer);
let lockBytes = null;
try {
  lockBytes = await readFile(lockAuthority);
} catch (error) {
  if (!args.updateLock) {
    fail('shared libspec/Cargo.lock is missing; first run must pass --update-lock');
  }
}
const generatorSha256 = sha(generatorBytes);
const closureRegistrySha256 = sha(Buffer.from(JSON.stringify(closureEntries)));
const fingerprintOf = lock => sha(
  Buffer.from(
    JSON.stringify({
      generator: generatorSha256,
      registry_closure: closureRegistrySha256,
      policy_closure: policyClosureSha256,
      lock: lock ? sha(lock) : null,
      producer: sha(producerBytes),
      selected: selected.map(row => row.id),
      sources: fingerprintSources,
      shared: fingerprintShared,
    }),
  ),
);
let fingerprint = fingerprintOf(lockBytes);
const outBase = resolve(args.out ?? join(tmpdir(), 'wasmc-lib-refresh-v2'));
let runRoot = join(outBase, fingerprint.slice(0, 24));
await rm(runRoot, { recursive: true, force: true });
let workspace = join(runRoot, 'workspace');
let publication = join(runRoot, 'packages');
let specsRoot = join(runRoot, 'specs');
await mkdir(workspace, { recursive: true });
await mkdir(publication, { recursive: true });
await mkdir(specsRoot, { recursive: true });

await writeFile(join(workspace, 'Cargo.toml'), renderWorkspace(allEntries, policy));
for (const entry of allEntries) {
  const sourceRoot = resolve(repo, entry.source);
  const spec = specs.get(entry.id);
  const crateRoot = join(workspace, 'crates', entry.id);
  await mkdir(join(crateRoot, 'src'), { recursive: true });
  await mkdir(join(crateRoot, 'wit'), { recursive: true });
  await writeFile(join(crateRoot, 'Cargo.toml'), renderCargoPackage(spec, policy));
  await writeFile(join(crateRoot, 'src', 'lib.rs'), generatedLibRs(spec, policy));
  await copyFile(join(sourceRoot, 'delta.rs'), join(crateRoot, 'src', 'delta.rs'));
  await copyFile(join(sourceRoot, 'adapter.rs'), join(crateRoot, 'src', 'adapter.rs'));
  await copyFile(join(sourceRoot, 'lib.wit'), join(crateRoot, 'wit', 'world.wit'));
  for (const sharedName of spec.shared_modules ?? []) {
    const shared = policy.shared_modules[sharedName];
    await copyFile(resolve(repo, shared.source), join(crateRoot, 'src', shared.module + '.rs'));
  }
  for (const dependencyId of spec.wit_dependencies ?? []) {
    const dependency = byId.get(dependencyId);
    if (!dependency) fail(spec.id + ': unknown WIT dependency ' + dependencyId);
    const dependencyRoot = resolve(repo, dependency.source);
    const target = join(crateRoot, 'wit', 'deps', dependencyId);
    await mkdir(target, { recursive: true });
    await copyFile(join(dependencyRoot, 'lib.wit'), join(target, 'world.wit'));
  }
}

if (args.updateLock) {
  run(
    'cargo',
    ['+' + policy.toolchain, 'generate-lockfile', '--offline'],
    { cwd: workspace, timeout: 180000 },
  );
  await copyFile(join(workspace, 'Cargo.lock'), lockAuthority);
  lockBytes = await readFile(lockAuthority);
  const finalFingerprint = fingerprintOf(lockBytes);
  if (finalFingerprint !== fingerprint) {
    const finalRoot = join(outBase, finalFingerprint.slice(0, 24));
    await rm(finalRoot, { recursive: true, force: true });
    await rename(runRoot, finalRoot);
    fingerprint = finalFingerprint;
    runRoot = finalRoot;
    workspace = join(runRoot, 'workspace');
    publication = join(runRoot, 'packages');
    specsRoot = join(runRoot, 'specs');
  }
} else {
  await copyFile(lockAuthority, join(workspace, 'Cargo.lock'));
}
for (const entry of allEntries) {
  await copyFile(lockAuthority, join(workspace, 'crates', entry.id, 'Cargo.lock'));
}
const cargoTargetDir = join(runRoot, 'cargo-target');
await mkdir(cargoTargetDir, { recursive: true });

const producerSha256 = sha(producerBytes);
const rows = [];
for (const entry of selected) {
  const spec = specs.get(entry.id);
  const specDir = join(specsRoot, entry.id);
  await mkdir(specDir, { recursive: true });
  await copyFile(resolve(repo, entry.source, 'lib.wit'), join(specDir, 'lib.wit'));
  for (const dependencyId of spec.wit_dependencies ?? []) {
    const dependency = byId.get(dependencyId);
    if (!dependency) fail(spec.id + ': unknown WIT dependency ' + dependencyId);
    const dependencyRoot = resolve(repo, dependency.source);
    const target = join(specDir, 'deps', dependencyId);
    await mkdir(target, { recursive: true });
    await copyFile(join(dependencyRoot, 'lib.wit'), join(target, 'world.wit'));
  }
  const buildSpec = producerSpec(spec);
  const buildSpecPath = join(specDir, 'lib.build.json');
  await writeFile(buildSpecPath, JSON.stringify(buildSpec, null, 2) + '\n');
  const buildStartedAt = Date.now();
  const build = run(
    args.producer,
    [
      'lib',
      'build',
      '--workspace',
      workspace,
      '--publication',
      publication,
      buildSpecPath,
    ],
    {
      cwd: repo,
      timeout: 300000,
      env: {
        RUSTUP_TOOLCHAIN: policy.toolchain,
        CARGO_NET_OFFLINE: 'true',
        CARGO_INCREMENTAL: '0',
        RUSTC_WRAPPER: '',
        RUSTC_WORKSPACE_WRAPPER: '',
        WASMC_LIB_CARGO_TARGET_DIR: cargoTargetDir,
      },
    },
  );
  const buildMs = Date.now() - buildStartedAt;
  const packageRoot = join(publication, entry.id);
  const manifest = await readJson(join(packageRoot, 'lib.json'));
  assert.equal(manifest.id, entry.id);
  assert.equal(manifest.version, spec.version);
  assert.ok(manifest.core_abi, entry.id + ': core_abi missing');
  assert.ok(manifest.component, entry.id + ': component missing');
  assert.equal(
    manifest.bindings?.rust_core?.schema,
    'wasmc.lib-rust-canonical-core-sdk/v1',
    entry.id + ': canonical rust_core binding missing',
  );
  assert.equal(
    manifest.bindings?.rust_component?.schema,
    'wasmc.lib-rust-component-sdk/v0',
    entry.id + ': rust_component binding missing',
  );
  for (const required of [
    'artifact.wasm',
    'component.wasm',
    'core-abi.json',
    'bindings/rust-core/Cargo.toml',
    'bindings/rust-core/src/lib.rs',
    'bindings/rust-component/Cargo.toml',
    'bindings/rust-component/src/lib.rs',
  ]) {
    const info = await stat(join(packageRoot, required));
    assert.ok(info.isFile(), entry.id + ': generated file missing ' + required);
  }
  rows.push({
    id: entry.id,
    version: spec.version,
    profile: spec.profile,
    package_root: packageRoot,
    manifest_sha256: sha(await readFile(join(packageRoot, 'lib.json'))),
    artifact_sha256: manifest.artifact?.sha256 ?? null,
    component_sha256: manifest.component?.sha256 ?? null,
    core_abi_sha256: manifest.core_abi?.sha256 ?? null,
    build_ms: buildMs,
    producer_stdout: build.stdout,
  });
}

const receipt = {
  accepted: true,
  schema: 'wasmc.lib-refresh-receipt/v2',
  fingerprint,
  producer: {
    path: args.producer,
    sha256: producerSha256,
  },
  generator_sha256: generatorSha256,
  registry_closure_sha256: closureRegistrySha256,
  dependency_closure: [...closureIds].sort(),
  shared_modules: [...usedSharedNames].sort(),
  rust_policy_sha256: sha(policyBytes),
  policy_closure_sha256: policyClosureSha256,
  dependency_keys: [...usedDependencyKeys].sort(),
  cargo_lock_sha256: sha(await readFile(lockAuthority)),
  registry_sha256: sha(registryBytes),
  selected: selected.map(row => row.id),
  source_digests: fingerprintSources,
  rows,
  timing: {
    total_ms: Date.now() - refreshStartedAt,
    package_build_ms: Object.fromEntries(rows.map(row => [row.id, row.build_ms])),
    shared_cargo_target: true,
  },
  qualification: {
    q0_refresh: 'pass',
    q1_behavior: 'pending focused Lib behavior/oracle tests',
    q2_ecosystem: 'pending cohort ordinary-App/SDK qualification',
    q3_release: 'pending candidate/legal/determinism/Pi/install gates',
  },
};
await writeFile(join(runRoot, 'refresh-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
await writeFile(
  join(runRoot, 'qualification-plan.json'),
  JSON.stringify(
    {
      schema: 'wasmc.lib-refresh-qualification-plan/v2',
      fingerprint,
      rows: rows.map(row => ({
        id: row.id,
        package_root: row.package_root,
        q1: 'run package-specific semantic and boundary oracle',
        q2: 'run ordinary WAsmC + Rust Core + Component on Wasmi/Wasmtime',
      })),
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({
  accepted: true,
  schema: receipt.schema,
  fingerprint,
  run_root: runRoot,
  producer_sha256: producerSha256,
  generator_sha256: generatorSha256,
  cargo_lock_sha256: receipt.cargo_lock_sha256,
  total_ms: receipt.timing.total_ms,
  package_build_ms: receipt.timing.package_build_ms,
  packages: rows.map(row => ({
    id: row.id,
    artifact_sha256: row.artifact_sha256,
    component_sha256: row.component_sha256,
    core_abi_sha256: row.core_abi_sha256,
  })),
}));
