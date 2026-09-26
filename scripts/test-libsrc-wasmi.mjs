import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const relationalWit = readFileSync(
  resolve(root, 'libsrc/wasmc-data-relational/wit/world.wit'),
  'utf8',
);
const relationalVersion = relationalWit.match(
  /^package\s+wasmc:data-relational@(\d+\.\d+\.\d+);/m,
)?.[1];
if (!relationalVersion) throw new Error('relational WIT package version missing');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    timeout: options.timeout ?? 600000,
    maxBuffer: 128 << 20,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + ' failed (' + result.status + '):\n' + result.stderr + '\n' + result.stdout);
  }
  return result.stdout.trim();
}

for (const name of [
  'wasmc-json',
  'wasmc-compression',
  'wasmc-http1',
  'wasmc-data-core',
  'wasmc-csv',
  'wasmc-data-expr',
  'wasmc-data-compute',
  'wasmc-data-relational',
  'wasmc-data-profile',
  'wasmc-data-interchange',
]) {
  run('cargo', [
    '+1.96.0',
    'build',
    '--release',
    '--locked',
    '--target',
    'wasm32-unknown-unknown',
    '--manifest-path',
    'libsrc/' + name + '/Cargo.toml',
  ]);
}

const work = await mkdtemp(join(tmpdir(), 'wasmc-libsrc-wasmi-'));
try {
  const router = join(work, 'router-policy.wasm');
  run('wasm-tools', [
    'parse',
    resolve(root, 'libsrc/wasmc-router-policy/src/router-policy.wat'),
    '-o',
    router,
  ]);

  const binary = process.platform === 'win32'
    ? resolve(root, 'libsrc/qualification/wasmi-core/target/release/wasmc-libsrc-wasmi-qualification.exe')
    : resolve(root, 'libsrc/qualification/wasmi-core/target/release/wasmc-libsrc-wasmi-qualification');

  run('cargo', [
    '+1.96.0',
    'build',
    '--release',
    '--locked',
    '--manifest-path',
    'libsrc/qualification/wasmi-core/Cargo.toml',
  ]);

  const output = run(binary, [], {
    env: {
      WASMC_LIBSRC_ROUTER: router,
      WASMC_LIBSRC_JSON: resolve(root, 'libsrc/wasmc-json/target/wasm32-unknown-unknown/release/wasmc_json_public.wasm'),
      WASMC_LIBSRC_COMPRESSION: resolve(root, 'libsrc/wasmc-compression/target/wasm32-unknown-unknown/release/wasmc_compression_public.wasm'),
      WASMC_LIBSRC_HTTP1: resolve(root, 'libsrc/wasmc-http1/target/wasm32-unknown-unknown/release/wasmc_http1_public.wasm'),
      WASMC_LIBSRC_DATA_CORE: resolve(root, 'libsrc/wasmc-data-core/target/wasm32-unknown-unknown/release/wasmc_data_core_public.wasm'),
      WASMC_LIBSRC_CSV: resolve(root, 'libsrc/wasmc-csv/target/wasm32-unknown-unknown/release/wasmc_csv_public.wasm'),
      WASMC_LIBSRC_DATA_EXPR: resolve(root, 'libsrc/wasmc-data-expr/target/wasm32-unknown-unknown/release/wasmc_data_expr_public.wasm'),
      WASMC_LIBSRC_DATA_COMPUTE: resolve(root, 'libsrc/wasmc-data-compute/target/wasm32-unknown-unknown/release/wasmc_data_compute_public.wasm'),
      WASMC_LIBSRC_DATA_RELATIONAL: resolve(root, 'libsrc/wasmc-data-relational/target/wasm32-unknown-unknown/release/wasmc_data_relational_public.wasm'),
      WASMC_LIBSRC_DATA_RELATIONAL_VERSION: relationalVersion,
      WASMC_LIBSRC_DATA_PROFILE: resolve(root, 'libsrc/wasmc-data-profile/target/wasm32-unknown-unknown/release/wasmc_data_profile_public.wasm'),
      WASMC_LIBSRC_DATA_INTERCHANGE: resolve(root, 'libsrc/wasmc-data-interchange/target/wasm32-unknown-unknown/release/wasmc_data_interchange_public.wasm'),
    },
  });
  const receipt = JSON.parse(output.split(/\r?\n/).filter(Boolean).at(-1));
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.engine, 'wasmi-2.0.0');
  assert.equal(receipt.representative_execution, true);
  assert.equal(receipt.structural_data_qualification, true);
  assert.equal(receipt.host_imports, 0);
  assert.equal(receipt.relational_version, relationalVersion);
  assert.deepEqual(receipt.candidates, [
    'wasmc-router-policy',
    'wasmc-json',
    'wasmc-compression',
    'wasmc-http1',
    'wasmc-data-core',
    'wasmc-csv',
    'wasmc-data-expr',
    'wasmc-data-compute',
    'wasmc-data-relational',
    'wasmc-data-profile',
    'wasmc-data-interchange',
  ]);
  console.log(JSON.stringify({
    accepted: true,
    schema: 'wasmc.libsrc-wasmi-qualification/v1',
    ...receipt,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
