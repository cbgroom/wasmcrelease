// Runner integration tests with an explicit test producer. These are cache/
// journal tests, never production Lib qualification evidence.
import assert from 'node:assert/strict';
import { chmod, cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const producerSource = `#!/usr/bin/env node
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const args=process.argv.slice(2), pub=args[args.indexOf('--publication')+1], spec=JSON.parse(fs.readFileSync(args.at(-1)));
if(process.env.REFRESH_TEST_FAIL===spec.skill.name){console.log('partial output');console.error('intentional failure');process.exit(42);}
const root=path.join(pub,spec.skill.name);
const bytes={'artifact.wasm':'test-core','component.wasm':'test-component','core-abi.json':'{}','lib.wit':'test-wit',
 'bindings/rust-core/Cargo.toml':'test','bindings/rust-core/src/lib.rs':'test','bindings/rust-component/Cargo.toml':'test','bindings/rust-component/src/lib.rs':'test'};
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const descriptor=x=>({path:x,sha256:hash(bytes[x])});
for(const [name,value] of Object.entries(bytes)){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,value);}
fs.writeFileSync(path.join(root,'lib.json'),JSON.stringify({id:spec.skill.name,version:spec.skill.version,
 artifact:descriptor('artifact.wasm'),component:descriptor('component.wasm'),core_abi:descriptor('core-abi.json'),
 bindings:{rust_core:{schema:'wasmc.lib-rust-canonical-core-sdk/v1',cargo_toml:descriptor('bindings/rust-core/Cargo.toml'),source:descriptor('bindings/rust-core/src/lib.rs')},rust_component:{schema:'wasmc.lib-rust-component-sdk/v0',cargo_toml:descriptor('bindings/rust-component/Cargo.toml'),source:descriptor('bindings/rust-component/src/lib.rs')}}}));
`;

test('whole runner: miss -> hit -> one delta; failure retains journal; tamper rejects', { timeout: 120000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'wasmc-refresh-workflow-test-'));
  try {
    await mkdir(join(root, 'scripts')); await mkdir(join(root, 'libspec'));
    for (const file of ['lib-refresh-v2.mjs', 'lib-refresh-runner-v2.mjs', 'lib-refresh-cache-v2.mjs', 'lib-refresh-native-v2.mjs', 'lib-refresh-resource-core-v2.mjs'])
      await cp(resolve('scripts', file), join(root, 'scripts', file));
    const entries = ['test-one', 'test-two'].map(id => ({ id, source: 'libspec/' + id }));
    await writeFile(join(root, 'libspec/registry.json'), JSON.stringify({ schema: 'wasmc.lib-refresh-registry/v2', libs: entries }));
    await writeFile(join(root, 'libspec/rust-policy.json'), JSON.stringify({ schema: 'wasmc.lib-refresh-rust-policy/v2',
      toolchain: '1.96.0', target: 'wasm32-unknown-unknown', edition: '2021', wit_bindgen: '"=0.62.0"', dependencies: {},
      release_profile: { opt_level: 'z', lto: true, codegen_units: 1, panic: 'abort', strip: 'symbols' } }));
    await writeFile(join(root, 'libspec/Cargo.lock'), 'version = 4\n');
    for (const e of entries) {
      await mkdir(join(root, e.source));
      const spec = { schema: 'wasmc.lib-refresh-source/v2', id: e.id, version: '1.0.0', profile: 'value',
        crate: e.id, artifact_name: e.id.replaceAll('-', '_'), world: 'test', dependencies: [],
        apis: [{ api: 'run' }], description: 'test fixture only',
        wit_dependencies: e.id === 'test-two' ? ['test-one'] : [] };
      await writeFile(join(root, e.source, 'lib.json'), JSON.stringify(spec));
      await writeFile(join(root, e.source, 'lib.wit'), 'package test:unit; world test {}');
      await writeFile(join(root, e.source, 'delta.rs'), 'pub fn run()->u32{1}');
      await writeFile(join(root, e.source, 'adapter.rs'), '// explicit fixture');
    }
    const producer = join(root, 'producer.cjs'); await writeFile(producer, producerSource); await chmod(producer, 0o755);
    const cache = join(root, 'cache'), evidence = join(root, 'evidence');
    const run = (extra = [], env = {}) => spawnSync(process.execPath,
      ['scripts/lib-refresh-v2.mjs', '--producer', producer, '--cache', cache, '--out', evidence, ...extra],
      { cwd: root, encoding: 'utf8', timeout: 30000, env: { ...process.env, ...env } });
    const success = output => { assert.equal(output.status, 0, output.stderr); return JSON.parse(output.stdout.trim()); };
    const cold = success(run(['--all'])); assert.equal(cold.timing.cache_misses, 2);
    const warm = success(run(['--all'])); assert.equal(warm.timing.cache_hits, 2); assert.equal(cold.fingerprint, warm.fingerprint);
    assert.notEqual(cold.run_root, warm.run_root, 'evidence runs must be immutable and distinct');
    const firstProgress = JSON.parse(await readFile(join(cold.run_root, 'progress.json')));
    assert.equal(firstProgress.state, 'completed');
    await writeFile(join(root, 'libspec/test-one/delta.rs'), 'pub fn run()->u32{2}');
    const delta = success(run(['--all']));
    assert.deepEqual(delta.packages.map(p => [p.id, p.action]), [['test-one', 'build'], ['test-two', 'reuse']]);
    const forced = success(run(['--rebuild', 'test-one'])); assert.equal(forced.timing.cache_misses, 1);
    const failed = run(['--rebuild', 'test-one'], { REFRESH_TEST_FAIL: 'test-one' });
    assert.notEqual(failed.status, 0); assert.match(failed.stderr, /intentional failure/);
    const logs = await Promise.all((await readdir(join(evidence, 'runs'))).map(async name => {
      const dir = join(evidence, 'runs', name);
      return { dir, progress: JSON.parse(await readFile(join(dir, 'progress.json'))) };
    }));
    const failure = logs.find(r => r.progress.state === 'failed'); assert.ok(failure);
    assert.equal(failure.progress.accepted, false);
    assert.equal(failure.progress.rows[0].state, 'failed');
    assert.match(await readFile(join(failure.dir, 'logs/test-one.stdout.log'), 'utf8'), /partial output/);
    assert.equal(JSON.parse(await readFile(join(failure.dir, 'logs/test-one.command.json'))).exit_code, 42);
    const recovered = success(run(['--all'])); assert.equal(recovered.timing.cache_hits, 2);
    const receipt = JSON.parse(await readFile(join(recovered.run_root, 'refresh-receipt.json')));
    const corrupted = join(cache, 'objects', receipt.package_keys['test-one'], 'package/bindings/rust-core/src/lib.rs');
    await writeFile(corrupted, '// corrupt');
    const tampered = run(['test-one']); assert.notEqual(tampered.status, 0); assert.match(tampered.stderr, /CACHE_INTEGRITY|digest mismatch/);
    assert.ok(await readFile(join(cold.run_root, 'refresh-receipt.json')), 'old run must remain');
  } finally { await rm(root, { recursive: true, force: true }); }
});
