import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rename } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { acquireWriter, atomicJson, command, digest, exists, inside, inventory as fileInventory, json, sha, verifyCache, verifyRoot, writeChanged } from './lib-refresh-cache-v2.mjs';
import { buildNative } from './lib-refresh-native-v2.mjs';

function argumentsOf(argv) {
  const args = { ids: [], all: false, updateLock: false, rebuild: false,
    producer: process.env.WASMC_LIB_PRODUCER, cache: process.env.WASMC_LIB_REFRESH_CACHE,
    out: process.env.WASMC_LIB_REFRESH_OUTPUT };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--all') args.all = true;
    else if (value === '--update-lock') args.updateLock = true;
    else if (value === '--rebuild') args.rebuild = true;
    else if (['--producer', '--cache', '--out'].includes(value)) {
      assert.ok(argv[i + 1] && !argv[i + 1].startsWith('--'), 'missing value for ' + value);
      args[value.slice(2)] = argv[++i];
    } else { assert.ok(!value.startsWith('-'), 'unknown argument ' + value); args.ids.push(value); }
  }
  assert.ok(!(args.all && args.ids.length), 'use --all or explicit ids');
  assert.ok(args.producer && isAbsolute(args.producer), 'exact absolute --producer is required');
  assert.equal(new Set(args.ids).size, args.ids.length, 'duplicate selected id');
  return args;
}

export async function refresh(argv, render) {
  const args = argumentsOf(argv);
  const repo = process.cwd();
  const out = resolve(args.out ?? join(tmpdir(), 'wasmc-lib-refresh-v2'));
  const cache = resolve(args.cache ?? join(homedir(), '.cache', 'wasmc-lib-refresh-v2'));
  assert.notEqual(cache, out, 'persistent cache and evidence root must differ');
  const releaseLock = await acquireWriter(cache);
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  await mkdir(join(out, 'runs'), { recursive: true });
  const runRoot = await mkdtemp(join(out, 'runs', 'refresh-'));
  const started = Date.now();
  const progress = { schema: 'wasmc.lib-refresh-progress/v2', accepted: false, state: 'preflight',
    pid: process.pid, started_at: new Date().toISOString(), run_root: runRoot, rows: [] };
  const journal = async state => {
    progress.state = state;
    progress.updated_at = new Date().toISOString();
    await atomicJson(join(runRoot, 'progress.json'), progress);
  };
  try {
    await journal('preflight');
    const source = new Map();
    const load = async path => { const bytes = await readFile(path); source.set(path, bytes); return bytes; };
    const registry = JSON.parse(await load(join(repo, 'libspec/registry.json')));
    const policyBytes = await load(join(repo, 'libspec/rust-policy.json'));
    const policy = JSON.parse(policyBytes);
    assert.equal(registry.schema, 'wasmc.lib-refresh-registry/v2');
    assert.equal(policy.schema, 'wasmc.lib-refresh-rust-policy/v2');
    const all = [...registry.libs].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    assert.equal(new Set(all.map(e => e.id)).size, all.length, 'duplicate registry id');
    const byId = new Map(all.map(e => [e.id, e]));
    const selected = (args.all ? all.map(e => e.id) : args.ids).sort();
    assert.ok(selected.length, 'select a Lib or --all');
    for (const id of selected) assert.ok(byId.has(id), 'unknown Lib ' + id);
    const inventory = ['adapter.rs', 'delta.rs', 'lib.json', 'lib.wit'];
    const specs = new Map(), payloads = new Map(), shared = new Map();
    for (const entry of all) {
      assert.match(entry.id, /^[a-z0-9][a-z0-9-]*$/);
      assert.equal(entry.source, 'libspec/' + entry.id);
      const directory = inside(repo, entry.source);
      const specBytes = await load(join(directory, 'lib.json'));
      const spec = JSON.parse(specBytes);
      const names = spec.profile === 'native' ? ['lib.json', 'lib.wit', ...spec.native.files].sort() : inventory;
      assert.deepEqual(Object.keys(await fileInventory(directory)).sort(), names,
        entry.id + ': authored implementation inventory drift');
      const bytes = { 'lib.json': specBytes };
      for (const file of names.filter(f => f !== 'lib.json')) bytes[file] = await load(inside(directory, file));
      assert.equal(spec.id, entry.id); assert.equal(spec.schema, 'wasmc.lib-refresh-source/v2');
      assert.ok(['value', 'resource', 'host', 'native'].includes(spec.profile), 'unsupported profile: ' + spec.profile);
      if (spec.profile !== 'native') assert.match(spec.crate, /^[A-Za-z0-9_-]+$/);
      assert.equal(new Set(spec.apis.map(a => a.api)).size, spec.apis.length, 'duplicate API evidence');
      specs.set(entry.id, spec); payloads.set(entry.id, bytes);
    }
    for (const [name, info] of Object.entries(policy.shared_modules ?? {})) {
      assert.match(info.module, /^[A-Za-z_][A-Za-z0-9_]*$/);
      shared.set(name, await load(inside(repo, info.source)));
    }
    const closure = id => {
      const visited = new Set(), active = new Set();
      const visit = key => {
        assert.ok(!active.has(key), 'cyclic WIT dependency ' + key);
        if (visited.has(key)) return;
        assert.ok(specs.has(key), 'unknown WIT dependency ' + key);
        active.add(key);
        for (const child of specs.get(key).wit_dependencies ?? []) visit(child);
        active.delete(key); visited.add(key);
      };
      visit(id); return [...visited].sort();
    };
    for (const id of specs.keys()) closure(id);
    const env = { ...process.env, RUSTUP_TOOLCHAIN: policy.toolchain, CARGO_NET_OFFLINE: 'true',
      CARGO_BUILD_JOBS: '2', CARGO_INCREMENTAL: '0', RUSTC_WRAPPER: '', RUSTC_WORKSPACE_WRAPPER: '',
      RUSTFLAGS: '', CARGO_ENCODED_RUSTFLAGS: '' };
    const producerSha = sha(await readFile(args.producer));
    const generator = {};
    for (const file of ['lib-refresh-v2.mjs', 'lib-refresh-runner-v2.mjs', 'lib-refresh-cache-v2.mjs', 'lib-refresh-native-v2.mjs'])
      generator[file] = sha(await load(join(repo, 'scripts', file)));
    const rustc = await command('rustc', ['+' + policy.toolchain, '-vV'], { cwd: repo, env });
    const cargo = await command('cargo', ['+' + policy.toolchain, '--version'], { cwd: repo, env });
    const toolchain = { rustc: rustc.stdout, cargo: cargo.stdout, target: policy.target };
    const rustEntries = all.filter(e => specs.get(e.id).profile !== 'native');
    const manifests = Object.fromEntries(rustEntries.map(e => [e.id, render.package(specs.get(e.id), policy)]));
    const workspaceManifest = render.workspace(rustEntries, policy);
    let nativeCompiler = null;
    if (selected.some(id => specs.get(id).native?.kind === 'c-boundary' && specs.get(id).native.target === process.platform))
      nativeCompiler = (await command('cc', ['--version'], { cwd: repo, env, timeout: 15000 })).stdout;
    const nativeToolchain = { platform: process.platform, arch: process.arch, node: process.version, cc: nativeCompiler };
    // Generator bytes fence output reuse, not the Cargo workspace location.
    // Re-emitted source content and Cargo flags invalidate compilation normally.
    const workspaceIdentity = digest({ repo: resolve(repo), producerSha, toolchain, policy, manifests, workspaceManifest });
    const workspace = join(cache, 'workspaces', workspaceIdentity, 'workspace');
    const cargoTarget = join(cache, 'targets', workspaceIdentity);
    const sync = async (path, bytes) => writeChanged(path, bytes);
    await sync(join(workspace, 'Cargo.toml'), workspaceManifest);
    for (const entry of rustEntries) {
      const spec = specs.get(entry.id), bytes = payloads.get(entry.id);
      const root = join(workspace, 'crates', entry.id);
      await sync(join(root, 'Cargo.toml'), manifests[entry.id]);
      await sync(join(root, 'src/lib.rs'), render.lib(spec, policy));
      for (const file of ['delta.rs', 'adapter.rs']) await sync(join(root, 'src', file), bytes[file]);
      await sync(join(root, 'wit/world.wit'), bytes['lib.wit']);
      for (const name of spec.shared_modules ?? []) {
        assert.ok(shared.has(name), 'unknown shared module ' + name);
        await sync(join(root, 'src', policy.shared_modules[name].module + '.rs'), shared.get(name));
      }
      for (const id of closure(entry.id).filter(id => id !== entry.id))
        await sync(join(root, 'wit/deps', id, 'world.wit'), payloads.get(id)['lib.wit']);
    }
    const lockAuthority = join(repo, 'libspec/Cargo.lock');
    if (args.updateLock) {
      await journal('updating_lock');
      if (await exists(lockAuthority)) await sync(join(workspace, 'Cargo.lock'), await readFile(lockAuthority));
      await command('cargo', ['+' + policy.toolchain, 'generate-lockfile', '--offline'],
        { cwd: workspace, env, logs: join(runRoot, 'logs/lock'), signal: controller.signal });
      await sync(lockAuthority, await readFile(join(workspace, 'Cargo.lock')));
    }
    const lockBytes = await load(lockAuthority);
    await sync(join(workspace, 'Cargo.lock'), lockBytes);
    for (const entry of rustEntries) await sync(join(workspace, 'crates', entry.id, 'Cargo.lock'), lockBytes);
    const common = { generator, producer_sha256: producerSha, toolchain, policy_sha256: sha(policyBytes),
      cargo_lock_sha256: sha(lockBytes), workspace_manifests_sha256: digest(manifests) };
    const keys = Object.fromEntries(selected.map(id => {
      const dependencies = closure(id);
      const modules = [...new Set(specs.get(id).shared_modules ?? [])].sort();
      return [id, digest({ common, id, native_toolchain: specs.get(id).profile === 'native' ? nativeToolchain : null,
        source: Object.fromEntries(Object.entries(payloads.get(id)).map(([f, b]) => [f, sha(b)])),
        // WIT dependencies supply types only; no sibling Rust code is linked.
        wit_dependencies: Object.fromEntries(dependencies.filter(d => d !== id).map(d => [d, sha(payloads.get(d)['lib.wit'])])),
        shared: Object.fromEntries(modules.map(m => [m, sha(shared.get(m))])) })];
    }));
    const fingerprint = digest({ common, selected, keys });
    Object.assign(progress, { fingerprint, selected, cache_root: cache, workspace, cargo_target: cargoTarget });
    await journal('running');
    const publication = join(runRoot, 'packages');
    await mkdir(publication, { recursive: true });
    await mkdir(join(cache, 'objects'), { recursive: true });
    for (const id of selected) {
      if (controller.signal.aborted) throw new Error('refresh interrupted');
      assert.equal(sha(await readFile(args.producer)), producerSha, 'producer changed during refresh');
      const spec = specs.get(id), key = keys[id];
      const entryPath = join(cache, 'objects', key), packageRoot = join(publication, id);
      const row = { id, version: spec.version, key, profile: spec.profile, state: 'checking_cache', package_root: packageRoot };
      progress.rows.push(row); await journal('running');
      const packageStarted = Date.now();
      let cached = null;
      if (await exists(entryPath)) cached = await verifyCache(entryPath, key, spec);
      if (cached && !args.rebuild) {
        await cp(join(entryPath, 'package'), packageRoot, { recursive: true, errorOnExist: true, force: false });
        row.action = 'reuse';
      } else {
        row.state = 'building'; row.action = 'build'; await journal('running');
        console.error(JSON.stringify({ id, state: 'building' }));
        if (spec.profile === 'native') {
          row.native_status = await buildNative(spec, payloads.get(id), packageRoot,
            { repo, env, logs: join(runRoot, 'logs', id), producerSha, nativeToolchain });
        } else {
        const specDir = join(runRoot, 'specs', id);
        await sync(join(specDir, 'lib.wit'), payloads.get(id)['lib.wit']);
        for (const dep of closure(id).filter(d => d !== id))
          await sync(join(specDir, 'deps', dep, 'world.wit'), payloads.get(dep)['lib.wit']);
        await atomicJson(join(specDir, 'lib.build.json'), render.spec(spec));
        const result = await command(args.producer,
          ['lib', 'build', '--workspace', workspace, '--publication', publication, join(specDir, 'lib.build.json')],
          { cwd: repo, env: { ...env, WASMC_LIB_CARGO_TARGET_DIR: cargoTarget },
            logs: join(runRoot, 'logs', id), timeout: 300000, signal: controller.signal });
        row.producer_ms = result.duration_ms;
        }
      }
      const verified = await verifyRoot(packageRoot, id, spec.version, spec.profile);
      if (spec.profile === 'host') {
        assert.ok(Array.isArray(spec.host_imports) && spec.host_imports.length > 0,
          id + ': explicit Host import contract required');
        const module = new WebAssembly.Module(await readFile(join(packageRoot, 'artifact.wasm')));
        const imports = WebAssembly.Module.imports(module);
        assert.ok(imports.every(value => value.kind === 'function'), id + ': undeclared non-function Host import');
        assert.deepEqual(imports.map(value => value.module + '#' + value.name).sort(),
          [...spec.host_imports].sort(), id + ': actual Host authority differs from declared imports');
      }
      if (cached) assert.deepEqual(verified.files, cached.files, id + ': same input generated different root bytes');
      else {
        const temporary = await mkdtemp(join(cache, 'objects', '.pending-'));
        await cp(packageRoot, join(temporary, 'package'), { recursive: true });
        await atomicJson(join(temporary, 'seal.json'), { schema: 'wasmc.lib-refresh-cache-entry/v2', id, key,
          files: verified.files, generator, producer_sha256: producerSha });
        await rename(temporary, entryPath);
      }
      Object.assign(row, { state: 'verified', build_ms: Date.now() - packageStarted,
        supported_views: Object.keys(verified.manifest.bindings),
        ordinary_wasmc_qualification: 'not_run',
        native_status: verified.manifest.native?.status ?? null,
        manifest_sha256: verified.manifest_sha256, artifact_sha256: verified.manifest.artifact?.sha256 ?? null,
        component_sha256: verified.files['component.wasm']?.sha256 ?? null, core_abi_sha256: verified.files['core-abi.json']?.sha256 ?? null });
      await atomicJson(join(runRoot, 'receipts', id + '.json'), row);
      await journal('running');
      console.error(JSON.stringify({ id, state: 'verified', action: row.action, elapsed_ms: row.build_ms }));
    }
    for (const [path, expected] of source) assert.ok((await readFile(path)).equals(expected), 'SOURCE_DRIFT: ' + path);
    const receipt = { schema: 'wasmc.lib-refresh-receipt/v2', accepted: true, fingerprint,
      run_root: runRoot, producer: { path: args.producer, sha256: producerSha }, generator_digests: generator,
      toolchain, cargo_lock_sha256: sha(lockBytes), selected, package_keys: keys, rows: progress.rows,
      source_digests: Object.fromEntries([...source].map(([path, bytes]) => [path.slice(repo.length + 1), sha(bytes)])),
      timing: { total_ms: Date.now() - started, package_build_ms: Object.fromEntries(progress.rows.map(r => [r.id, r.build_ms])),
        cache_hits: progress.rows.filter(r => r.action === 'reuse').length, cache_misses: progress.rows.filter(r => r.action === 'build').length,
        persistent_workspace: true, persistent_cargo_target: true },
      qualification: { q0_refresh: 'pass', q0_scope: 'Rust artifacts or explicit native source/binary package; inspect each row profile', q1_behavior: 'pending generated-artifact behavior tests',
        q2_ecosystem: 'pending ordinary App and multi-engine qualification', q3_release: 'pending' } };
    await atomicJson(join(runRoot, 'refresh-receipt.json'), receipt);
    progress.accepted = true; await journal('completed');
    console.log(JSON.stringify({ accepted: true, fingerprint, run_root: runRoot,
      timing: receipt.timing, packages: progress.rows.map(r => ({ id: r.id, action: r.action, artifact_sha256: r.artifact_sha256 })) }));
    return receipt;
  } catch (error) {
    progress.error = { message: error.message, command: error.result ?? null };
    const active = progress.rows.find(r => !['verified', 'failed'].includes(r.state));
    if (active) { active.state = 'failed'; active.error = error.message; }
    await journal(controller.signal.aborted ? 'interrupted' : 'failed');
    console.error(JSON.stringify({ accepted: false, run_root: runRoot, state: progress.state, message: error.message }));
    throw error;
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    await releaseLock();
  }
}
