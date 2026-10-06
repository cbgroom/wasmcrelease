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
  for (const key of spec.dependencies ?? []) {
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

function generatedLibRs(spec) {
  return [
    'wit_bindgen::generate!({',
    '    path: "wit",',
    '    world: ' + JSON.stringify(spec.world) + ',',
    '});',
    '',
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
    apis: spec.apis,
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

const producerBytes = await readFile(args.producer);
let lockBytes = null;
try {
  lockBytes = await readFile(lockAuthority);
} catch (error) {
  if (!args.updateLock) {
    fail('shared libspec/Cargo.lock is missing; first run must pass --update-lock');
  }
}
const fingerprintOf = lock => sha(
  Buffer.from(
    JSON.stringify({
      registry: sha(registryBytes),
      policy: sha(policyBytes),
      lock: lock ? sha(lock) : null,
      producer: sha(producerBytes),
      selected: selected.map(row => row.id),
      sources: sourceDigests,
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
  await writeFile(join(crateRoot, 'src', 'lib.rs'), generatedLibRs(spec));
  await copyFile(join(sourceRoot, 'delta.rs'), join(crateRoot, 'src', 'delta.rs'));
  await copyFile(join(sourceRoot, 'adapter.rs'), join(crateRoot, 'src', 'adapter.rs'));
  await copyFile(join(sourceRoot, 'lib.wit'), join(crateRoot, 'wit', 'world.wit'));
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

const producerSha256 = sha(producerBytes);
const rows = [];
for (const entry of selected) {
  const spec = specs.get(entry.id);
  const specDir = join(specsRoot, entry.id);
  await mkdir(specDir, { recursive: true });
  await copyFile(resolve(repo, entry.source, 'lib.wit'), join(specDir, 'lib.wit'));
  const buildSpec = producerSpec(spec);
  const buildSpecPath = join(specDir, 'lib.build.json');
  await writeFile(buildSpecPath, JSON.stringify(buildSpec, null, 2) + '\n');
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
      },
    },
  );
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
  rust_policy_sha256: sha(policyBytes),
  cargo_lock_sha256: sha(await readFile(lockAuthority)),
  registry_sha256: sha(registryBytes),
  selected: selected.map(row => row.id),
  source_digests: sourceDigests,
  rows,
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
  cargo_lock_sha256: receipt.cargo_lock_sha256,
  packages: rows.map(row => ({
    id: row.id,
    artifact_sha256: row.artifact_sha256,
    component_sha256: row.component_sha256,
    core_abi_sha256: row.core_abi_sha256,
  })),
}));
