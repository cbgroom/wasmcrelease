#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2] ? resolve(root, process.argv[2]) : null;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root,
  encoding: options.encoding ?? 'utf8',
  env: { ...process.env, ...(options.env ?? {}) },
  maxBuffer: 64 << 20,
  timeout: options.timeout ?? 1_800_000,
});
const jsonRun = (command, args, options) => {
  const lines = run(command, args, options).trim().split('\n');
  return JSON.parse(lines.at(-1));
};

const cohort = [
  {
    id: 'wasmc-router-policy',
    test: 'scripts/test-router-policy.mjs',
    source: 'libsrc/wasmc-router-policy/src/router-policy.wat',
    wit: 'libsrc/wasmc-router-policy/lib.wit',
  },
  {
    id: 'wasmc-json',
    test: 'scripts/test-json-libsrc.mjs',
    manifest: 'libsrc/wasmc-json/Cargo.toml',
    artifact: 'wasmc_json_public.wasm',
  },
  {
    id: 'wasmc-compression',
    test: 'scripts/test-compression-libsrc.mjs',
    manifest: 'libsrc/wasmc-compression/Cargo.toml',
    artifact: 'wasmc_compression_public.wasm',
  },
  {
    id: 'wasmc-http1',
    test: 'scripts/test-http1-libsrc.mjs',
    manifest: 'libsrc/wasmc-http1/Cargo.toml',
    artifact: 'wasmc_http1_public.wasm',
  },
];

const work = mkdtempSync(join(tmpdir(), 'wasmc-portable-v018-'));
try {
  const packages = [];
  for (const row of cohort) {
    const behavior = jsonRun('node', [row.test]);
    assert.equal(behavior.accepted, true, row.id + ': behavior qualification failed');
    assert.equal(behavior.host_imports, 0, row.id + ': unexpected Host imports');

    const builds = [];
    for (const buildName of ['first', 'second']) {
      const buildRoot = join(work, buildName, row.id);
      let corePath;
      let componentPath;
      if (row.source) {
        corePath = join(buildRoot, 'artifact.wasm');
        componentPath = join(buildRoot, 'component.wasm');
        mkdirSync(buildRoot, { recursive: true });
        run('wasm-tools', ['parse', row.source, '-o', corePath]);
        const embedded = join(buildRoot, 'embedded.wasm');
        run('wasm-tools', ['component', 'embed', row.wit, corePath, '-o', embedded]);
        run('wasm-tools', ['component', 'new', embedded, '-o', componentPath]);
      } else {
        const target = join(buildRoot, 'target');
        run('cargo', [
          '+1.96.0', 'build', '--release', '--locked', '--target',
          'wasm32-unknown-unknown', '--manifest-path', row.manifest,
        ], { env: { CARGO_TARGET_DIR: target } });
        corePath = join(target, 'wasm32-unknown-unknown', 'release', row.artifact);
        componentPath = join(buildRoot, 'component.wasm');
        run('wasm-tools', ['component', 'new', corePath, '-o', componentPath]);
      }
      const core = readFileSync(corePath);
      const component = readFileSync(componentPath);
      const module = new WebAssembly.Module(core);
      assert.deepEqual(WebAssembly.Module.imports(module), [], row.id + ': imports');
      builds.push({
        core: { bytes: core.length, sha256: sha256(core) },
        component: { bytes: component.length, sha256: sha256(component) },
      });
    }
    assert.deepEqual(builds[1], builds[0], row.id + ': independent build drift');
    packages.push({
      id: row.id,
      behavior,
      artifact: builds[0].core,
      component: builds[0].component,
      independent_second_build_byte_identical: true,
    });
  }

  const wasmi = jsonRun('node', ['scripts/test-libsrc-wasmi.mjs']);
  assert.equal(wasmi.accepted, true);
  assert.equal(wasmi.engine, 'wasmi-2.0.0');
  for (const row of cohort) assert.ok(wasmi.candidates.includes(row.id));

  const receipt = {
    schema: 'wasmc.portable-libs-v018-qualification/v1',
    date: '2026-09-29',
    source_authority: run('git', ['rev-parse', 'HEAD']).trim(),
    toolchain: {
      rustc: run('rustc', ['+1.96.0', '--version']).trim(),
      cargo: run('cargo', ['+1.96.0', '--version']).trim(),
      wasm_tools: run('wasm-tools', ['--version']).trim(),
      wasmtime: run('wasmtime', ['--version']).trim(),
      node: run('node', ['--version']).trim(),
      wasmi: '2.0.0',
    },
    packages,
    wasmi: {
      accepted: true,
      engine: wasmi.engine,
      representative_execution: wasmi.representative_execution,
      pure_host_imports: wasmi.pure_host_imports,
    },
    claims: {
      qualified: true,
      admitted: false,
      released: false,
      discoverable: false,
      installable: false,
    },
  };
  const text = JSON.stringify(receipt, null, 2) + '\n';
  if (output) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, text, { flag: 'wx' });
  }
  process.stdout.write(text);
} finally {
  rmSync(work, { recursive: true, force: true });
}
