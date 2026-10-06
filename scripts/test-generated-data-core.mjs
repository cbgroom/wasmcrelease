import { generatedLib } from './generated-lib-v2.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const selected = await generatedLib('wasmc-data-core');
const candidateRoot = selected.root;
const manifest = selected.manifest;
const oracle = JSON.parse(await readFile(resolve(root, 'tests/lib-refresh/oracles/wasmc-data-core.json'), 'utf8'));

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


const artifact = selected.artifact;
const bytes = await readFile(artifact);
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);
assert.ok(bytes.length < 2 * 1024 * 1024);

const wit = run('wasm-tools', ['component', 'wit', artifact]);
assert.match(wit, /export wasmc:data-core\/types@0\.0\.1;/);
assert.match(wit, /export wasmc:data-core\/model@0\.0\.1;/);
assert.doesNotMatch(wit, /^\s*import\s+/gm);

const work = await mkdtemp(join(tmpdir(), 'wasmc-data-core-'));
try {
  const component = selected.component;


  const base = '{rows: 3, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: true}], columns: [int64-column([some(1), some(2), some(3)]), utf8-column([some("a"), none, some("c")])]}';
  const cases = [
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
    implementation_basis: oracle.origin.implementation_basis,
    cases: receipts.length,
    receipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
