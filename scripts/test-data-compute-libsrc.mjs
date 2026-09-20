import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-data-compute');
const manifest = JSON.parse(await readFile(join(candidateRoot, 'candidate.json'), 'utf8'));

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
    throw new Error(command + ' failed (' + result.status + '):\n' + result.stderr + '\n' + result.stdout);
  }
  return result.stdout.trim();
}

run('cargo', [
  '+1.96.0', 'build', '--release', '--locked', '--target', 'wasm32-unknown-unknown',
  '--manifest-path', 'libsrc/wasmc-data-compute/Cargo.toml',
]);

const artifact = resolve(root, manifest.build.artifact);
const bytes = await readFile(artifact);
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);

const wit = run('wasm-tools', ['component', 'wit', artifact]);
assert.match(wit, /import wasmc:data-core\/types@0\.0\.1;/);
assert.match(wit, /export wasmc:data-compute\/compute@0\.0\.1;/);
assert.doesNotMatch(wit, /import .*host/i);

const work = await mkdtemp(join(tmpdir(), 'wasmc-data-compute-'));
try {
  const component = join(work, 'compute.component.wasm');
  run('wasm-tools', ['component', 'new', artifact, '-o', component]);

  const batch = '{rows: 4, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: true}], columns: [int64-column([some(3), some(1), some(2), some(4)]), utf8-column([some("c"), some("a"), none, some("b")])]}';
  const cases = [
    [
      'filter',
      'filter(' + batch + ', boolean-column([some(false), some(true), none, some(true)]))',
      'ok({rows: 2, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: true}], columns: [int64-column([some(1), some(4)]), utf8-column([some("a"), some("b")])]})',
    ],
    [
      'project',
      'project(' + batch + ', [1,0])',
      'ok({rows: 4, fields: [{name: "name", data-type: utf8, nullable: true}, {name: "id", data-type: int64, nullable: false}], columns: [utf8-column([some("c"), some("a"), none, some("b")]), int64-column([some(3), some(1), some(2), some(4)])]})',
    ],
    [
      'empty-project',
      'project(' + batch + ', [])',
      'ok({rows: 4, fields: [], columns: []})',
    ],
    [
      'sort-limit',
      'sort(' + batch + ', [{column: 0, descending: true, nulls-first: false}], some(2))',
      'ok({rows: 2, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: true}], columns: [int64-column([some(4), some(3)]), utf8-column([some("b"), some("c")])]})',
    ],
    [
      'sort-null-last',
      'sort(' + batch + ', [{column: 1, descending: false, nulls-first: false}], none)',
      'ok({rows: 4, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: true}], columns: [int64-column([some(1), some(4), some(3), some(2)]), utf8-column([some("a"), some("b"), some("c"), none])]})',
    ],
    [
      'mask-type',
      'filter(' + batch + ', int64-column([some(1), some(1), some(1), some(1)]))',
      'err(mask-type-mismatch)',
    ],
    [
      'mask-length',
      'filter(' + batch + ', boolean-column([some(true)]))',
      'err(mask-length-mismatch)',
    ],
    [
      'duplicate-project',
      'project(' + batch + ', [0,0])',
      'err(duplicate-column)',
    ],
    [
      'empty-sort',
      'sort(' + batch + ', [], none)',
      'err(empty-sort)',
    ],
    [
      'sort-oob',
      'sort(' + batch + ', [{column: 9, descending: false, nulls-first: false}], none)',
      'err(column-out-of-bounds)',
    ],
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
    type_dependency: manifest.origin.type_dependency,
    arrow_backed: true,
    operations: ['filter','project','sort'],
    cases: receipts.length,
    receipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
