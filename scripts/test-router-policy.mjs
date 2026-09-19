import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-router-policy');
const manifest = JSON.parse(await readFile(join(candidateRoot, 'candidate.json'), 'utf8'));
const oraclePath = resolve(root, manifest.oracle.path);
const oracleBytes = await readFile(oraclePath);
assert.equal(createHash('sha256').update(oracleBytes).digest('hex'), manifest.oracle.sha256);

const wit = await readFile(join(candidateRoot, manifest.wit), 'utf8');
assert.match(wit, /package\s+wasmc:router-policy@0\.0\.1/);
assert.match(wit, /route:\s*func\(/);
assert.match(wit, /->\s*tuple<u32,\s*u32,\s*u32>/);

const work = await mkdtemp(join(tmpdir(), 'wasmc-router-policy-'));
const candidatePath = join(work, 'candidate.wasm');
try {
  const build = spawnSync(
    process.env.WASM_TOOLS ?? 'wasm-tools',
    ['parse', resolve(candidateRoot, manifest.source[0]), '-o', candidatePath],
    { encoding: 'utf8', timeout: 120000 },
  );
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error('wasm-tools parse failed: ' + build.stderr);
  const candidateBytes = await readFile(candidatePath);

  const candidateModule = new WebAssembly.Module(candidateBytes);
  const oracleModule = new WebAssembly.Module(oracleBytes);
  assert.deepEqual(WebAssembly.Module.imports(candidateModule), []);
  assert.deepEqual(WebAssembly.Module.imports(oracleModule), []);
  assert.equal(manifest.host_import_budget, 0);

  const candidate = new WebAssembly.Instance(candidateModule, {}).exports.route;
  const oracle = new WebAssembly.Instance(oracleModule, {}).exports.route;
  assert.equal(typeof candidate, 'function');
  assert.equal(typeof oracle, 'function');

  let cases = 0;
  for (let method = 0; method <= 3; method++) {
    for (let path = 0; path <= 7; path++) {
      for (let body = 0; body <= 3; body++) {
        for (const count of [0, 1, 2, 98, 99, 100, 101, 0x7fffffff, 0xffffffff]) {
          const expected = oracle(method, path, body, count);
          const actual = candidate(method, path, body, count);
          assert.deepEqual(actual, expected, JSON.stringify({method, path, body, count}));
          cases++;
        }
      }
    }
  }

  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    cases,
    host_imports: 0,
    oracle_sha256: manifest.oracle.sha256,
    candidate_sha256: createHash('sha256').update(candidateBytes).digest('hex'),
    byte_identity_required: false,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
