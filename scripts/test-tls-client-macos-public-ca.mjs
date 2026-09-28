import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
assert.equal(process.platform, 'darwin', 'macOS system root qualification requires macOS');

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: options.encoding ?? 'utf8',
    timeout: options.timeout ?? 900000,
    maxBuffer: 64 << 20,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + ' failed (' + result.status + '):\n' + result.stderr + '\n' + result.stdout);
  }
  return result.stdout;
};

const work = await mkdtemp(join(tmpdir(), 'wasmc-tls-public-ca-'));
try {
  const bundlePath = join(work, 'macos-system-roots.pem');
  const bundle = run('security', [
    'find-certificate',
    '-a',
    '-p',
    '/System/Library/Keychains/SystemRootCertificates.keychain',
  ]);
  await writeFile(bundlePath, bundle);
  const output = run(process.execPath, [resolve(root, 'scripts/test-tls-client-libsrc.mjs')], {
    timeout: 900000,
    env: {
      WASMC_TLS_PUBLIC_CA_BUNDLE: bundlePath,
      WASMC_TLS_PUBLIC_HOST: 'example.com',
      WASMC_TLS_PUBLIC_PORT: '443',
      WASMC_TLS_PUBLIC_UNIX_TIME: Math.floor(Date.now() / 1000).toString(),
    },
  });
  const receipt = JSON.parse(output.trim().split(/\r?\n/).filter(Boolean).at(-1));
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.handshake.public_ca_https, true);
  assert.ok(receipt.handshake.public_ca_roots > 64);
  assert.ok(receipt.handshake.public_ca_roots <= 256);
  assert.ok(receipt.handshake.public_ca_response_bytes > 0);
  console.log(JSON.stringify({
    accepted: true,
    schema: 'wasmc.tls-client-macos-public-ca-qualification/v1',
    engine: 'wasmtime-47.0.4',
    endpoint: 'https://example.com/',
    system_root_certificates: receipt.handshake.public_ca_roots,
    response_plaintext_bytes: receipt.handshake.public_ca_response_bytes,
    semantic_host_imports: receipt.semantic_host_imports,
    fixed_host_api_changes: 0,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
