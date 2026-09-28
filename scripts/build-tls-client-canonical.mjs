import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const output = resolve(
  root,
  process.env.WASMC_TLS_CLIENT_CANONICAL_OUTPUT ??
    'target/tls-client-canonical/wasmc_tls_client_public.wasm',
);
const receiptPath = resolve(
  root,
  process.env.WASMC_TLS_CLIENT_CANONICAL_RECEIPT ??
    'target/tls-client-canonical/receipt.json',
);

const run = target => {
  const result = spawnSync('cargo', [
    '+1.96.0', 'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
    '--manifest-path', 'libsrc/wasmc-tls-client/Cargo.toml',
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 900000,
    maxBuffer: 64 << 20,
    env: { ...process.env, CARGO_TARGET_DIR: target },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`cargo failed (${result.status}):\n${result.stderr}\n${result.stdout}`);
  }
  return join(target, 'wasm32-unknown-unknown/release/wasmc_tls_client_public.wasm');
};

const work = await mkdtemp(join(tmpdir(), 'wasmc-tls-client-canonical-'));
try {
  const firstPath = run(join(work, 'first'));
  const secondPath = run(join(work, 'second'));
  const first = await readFile(firstPath);
  const second = await readFile(secondPath);
  assert.deepEqual(second, first, 'independent source builds were not byte-identical');

  await mkdir(dirname(output), { recursive: true });
  await mkdir(dirname(receiptPath), { recursive: true });
  await copyFile(firstPath, output);
  const receipt = {
    accepted: true,
    schema: 'wasmc.tls-client-canonical-build/v1',
    toolchain: 'rustc 1.96.0',
    target: 'wasm32-unknown-unknown',
    build_platform: `${process.platform}-${process.arch}`,
    independent_second_build_byte_identical: true,
    bytes: first.length,
    sha256: createHash('sha256').update(first).digest('hex'),
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt));
} finally {
  await rm(work, { recursive: true, force: true });
}
