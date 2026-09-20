import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-tls-core');
const manifest = JSON.parse(await readFile(join(candidateRoot, 'candidate.json'), 'utf8'));
assert.equal(manifest.schema, 'wasmc.libsrc-candidate/v1');
assert.equal(manifest.id, 'wasmc-tls-core');
assert.equal(manifest.host_import_budget, 1);
assert.deepEqual(manifest.allowed_host_imports, ['wasmc:tls-core/entropy@0.0.1#fill']);

const oraclePath = resolve(root, manifest.oracle.path);
const oracleBytes = await readFile(oraclePath);
assert.equal(
  createHash('sha256').update(oracleBytes).digest('hex'),
  manifest.oracle.sha256,
  'TLS oracle digest drift',
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    timeout: options.timeout ?? 300000,
    maxBuffer: 64 << 20,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      command + ' failed (' + result.status + '):\n' + result.stderr + '\n' + result.stdout,
    );
  }
  return result.stdout.trim();
}

run('cargo', [
  '+1.96.0',
  'build',
  '--release',
  '--locked',
  '--target',
  'wasm32-unknown-unknown',
  '--manifest-path',
  'libsrc/wasmc-tls-core/Cargo.toml',
]);

const candidatePath = resolve(
  root,
  'libsrc/wasmc-tls-core/target/wasm32-unknown-unknown/release/wasmc_tls_core_public.wasm',
);
const candidateBytes = await readFile(candidatePath);
const componentWit = run('wasm-tools', ['component', 'wit', candidatePath]);

assert.match(componentWit, /import wasmc:tls-core\/entropy@0\.0\.1;/);
assert.match(componentWit, /export wasmc:tls-core\/tls@0\.0\.1;/);
assert.doesNotMatch(componentWit, /import .*clock/i);
assert.doesNotMatch(componentWit, /import .*network/i);
assert.doesNotMatch(componentWit, /import .*socket/i);
const rootWorld = componentWit.match(/world root \{([\s\S]*?)\n\}/)?.[1];
assert.ok(rootWorld, 'missing instantiated root world');
assert.equal(
  [...rootWorld.matchAll(/^\s*import\s+/gm)].length,
  1,
  'TLS candidate must expose exactly one semantic Host import',
);

const raw = run('wasm-tools', ['print', candidatePath]);
assert.match(raw, /\(import "wasmc:tls-core\/entropy@0\.0\.1" "fill"/);
assert.doesNotMatch(raw, /\(import "[^"]*clock/i);

const work = await mkdtemp(join(tmpdir(), 'wasmc-tls-graduation-'));
try {
  const componentPath = join(work, 'candidate.component.wasm');
  run('wasm-tools', ['component', 'new', candidatePath, '-o', componentPath]);

  run('cargo', [
    '+1.96.0',
    'build',
    '--release',
    '--locked',
    '--manifest-path',
    'libsrc/wasmc-tls-core/tests/host/Cargo.toml',
  ]);

  const testBinary = resolve(
    root,
    'libsrc/wasmc-tls-core/tests/host/target/release/wasmc-tls-core-host-test',
  );
  const output = run(testBinary, [], {
    timeout: 30000,
    env: {
      WASMC_TLS_COMPONENT: componentPath,
      WASMC_TLS_CERT: resolve(root, 'host/tests/https/fixtures/server-cert.der'),
      WASMC_TLS_KEY: resolve(root, 'host/tests/https/fixtures/server-key.pkcs8.der'),
    },
  });
  const lines = output.split(/\r?\n/).filter(Boolean);
  const receipt = JSON.parse(lines.at(-1));
  assert.equal(receipt.accepted, true);
  assert.ok(receipt.handshake_rounds >= 1 && receipt.handshake_rounds <= 64);
  assert.ok(receipt.client_ciphertext > 0);
  assert.ok(receipt.server_ciphertext > 0);
  assert.ok(receipt.entropy_calls > 0);
  assert.equal(receipt.server_read, 'ping');
  assert.equal(receipt.client_read, 'pong');
  assert.ok(receipt.close_notify_bytes > 0);
  assert.deepEqual(receipt.host_imports, ['entropy.fill']);

  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    candidate_bytes: candidateBytes.length,
    oracle_bytes: oracleBytes.length,
    size_ratio_vs_oracle: Number((candidateBytes.length / oracleBytes.length).toFixed(3)),
    semantic_host_imports: ['wasmc:tls-core/entropy@0.0.1#fill'],
    clock_host_import: false,
    network_host_import: false,
    handshake: receipt,
    size_optimization: 'pending',
    admitted: false,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
