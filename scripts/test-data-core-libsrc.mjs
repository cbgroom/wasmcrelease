import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const packageRoot = process.argv[2] === '--package' && process.argv.length === 4 ? resolve(process.argv[3]) : null;
assert.ok(process.argv.length === 2 || packageRoot, 'usage: test-data-core-libsrc.mjs [--package EXACT_ROOT]');
const candidateRoot = resolve(root, 'libsrc/wasmc-data-core');
const manifest = JSON.parse(await readFile(join(candidateRoot, 'candidate.json'), 'utf8'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    timeout: options.timeout ?? 300000,
    maxBuffer: 32 << 20,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + ' failed (' + result.status + '):\n' + result.stderr + '\n' + result.stdout);
  }
  return result.stdout.trim();
}

if (!packageRoot) run('cargo', [
  '+1.96.0', 'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
  '--manifest-path', 'libsrc/wasmc-data-core/Cargo.toml',
]);

const artifact = packageRoot ? join(packageRoot, 'artifact.wasm') : resolve(root, manifest.build.artifact);
const bytes = await readFile(artifact);
if (packageRoot) {
  const metadata = JSON.parse(await readFile(join(packageRoot, 'lib.json'), 'utf8'));
  assert.equal(metadata.schema, 'wasmc.lib/v2');
  assert.equal(metadata.id, manifest.id);
  assert.equal(metadata.version, manifest.version);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.artifact.sha256);
  assert.equal(createHash('sha256').update(await readFile(join(packageRoot, 'component.wasm'))).digest('hex'), metadata.component.sha256);
  assert.deepEqual(await readFile(join(packageRoot, 'lib.wit')), await readFile(join(candidateRoot, manifest.wit)));
}
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);
assert.ok(bytes.length < 2 * 1024 * 1024);

const wit = run('wasm-tools', ['component', 'wit', packageRoot ? join(packageRoot, 'component.wasm') : artifact]);
assert.match(wit, /export wasmc:data-core\/types@0\.0\.1;/);
assert.match(wit, /export wasmc:data-core\/model@0\.0\.1;/);
assert.doesNotMatch(wit, /^\s*import\s+/gm);

const work = await mkdtemp(join(tmpdir(), 'wasmc-data-core-'));
try {
  const component = packageRoot ? join(packageRoot, 'component.wasm') : join(work, 'data-core.component.wasm');
  if (!packageRoot) run('wasm-tools', ['component', 'new', artifact, '-o', component]);

  const base = '{rows: 3, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: true}], columns: [int64-column([some(1), some(2), some(3)]), utf8-column([some("a"), none, some("c")])]}';
  const cases = [
    ['empty-validate', 'validate({rows: 0, fields: [], columns: []})', 'ok(0)'],
    ['empty-take', 'take({rows: 0, fields: [], columns: []}, [])', 'ok({rows: 0, fields: [], columns: []})'],
    ['zero-column-rows', 'take({rows: 3, fields: [], columns: []}, [2,0,2,1])', 'ok({rows: 4, fields: [], columns: []})'],
    ['empty-index', 'take({rows: 0, fields: [], columns: []}, [0])', 'err(index-out-of-bounds)'],
    ['validate', 'validate(' + base + ')', 'ok(3)'],
    ['take', 'take(' + base + ', [2,0])', 'ok({rows: 2, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: true}], columns: [int64-column([some(3), some(1)]), utf8-column([some("c"), some("a")])]})'],
    ['row-count', 'validate({rows: 2, fields: [{name: "id", data-type: int64, nullable: false}], columns: [int64-column([some(1), some(2), some(3)])]})', 'err(row-count-mismatch)'],
    ['nullability', 'validate({rows: 1, fields: [{name: "id", data-type: int64, nullable: false}], columns: [int64-column([none])]})', 'err(nullability-violation)'],
    ['duplicate-field', 'validate({rows: 1, fields: [{name: "x", data-type: int64, nullable: false}, {name: "x", data-type: utf8, nullable: false}], columns: [int64-column([some(1)]), utf8-column([some("a")])]})', 'err(duplicate-field-name)'],
    ['index', 'take(' + base + ', [3])', 'err(index-out-of-bounds)'],
  ];
  const receipts = [];
  for (const [name, invocation, expected] of cases) {
    const actual = run('wasmtime', ['run', '--invoke', invocation, component], { timeout: 30000 });
    assert.equal(actual, expected, name);
    receipts.push({ name, result: actual });
  }

  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    candidate_bytes: bytes.length,
    candidate_sha256: createHash('sha256').update(bytes).digest('hex'),
    core_imports: 0,
    arrow_backed: true,
    implementation_basis: manifest.origin.implementation_basis,
    cases: receipts.length,
    receipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
