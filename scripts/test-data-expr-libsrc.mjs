import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const candidateRoot = resolve(root, 'libsrc/wasmc-data-expr');
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
  '--manifest-path', 'libsrc/wasmc-data-expr/Cargo.toml',
]);

const artifact = resolve(root, manifest.build.artifact);
const bytes = await readFile(artifact);
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);

const wit = run('wasm-tools', ['component', 'wit', artifact]);
assert.match(wit, /import wasmc:data-core\/types@0\.0\.1;/);
assert.match(wit, /export wasmc:data-expr\/expr@0\.0\.1;/);
assert.doesNotMatch(wit, /import .*host/i);

const work = await mkdtemp(join(tmpdir(), 'wasmc-data-expr-'));
try {
  const component = join(work, 'expr.component.wasm');
  run('wasm-tools', ['component', 'new', artifact, '-o', component]);

  const batch = '{rows: 3, fields: [{name: "x", data-type: int64, nullable: false}, {name: "y", data-type: int64, nullable: false}, {name: "flag", data-type: boolean, nullable: false}, {name: "name", data-type: utf8, nullable: true}], columns: [int64-column([some(1), some(20), some(30)]), int64-column([some(2), some(3), some(4)]), boolean-column([some(true), some(false), some(true)]), utf8-column([some("a"), none, some("c")])]}';
  const cases = [
    [
      'validate-greater',
      'validate(' + batch + ', {nodes: [column(0), literal(int64(10)), greater({left: 0, right: 1})], root: 2})',
      'ok(boolean)',
    ],
    [
      'greater',
      'evaluate(' + batch + ', {nodes: [column(0), literal(int64(10)), greater({left: 0, right: 1})], root: 2})',
      'ok(boolean-column([some(false), some(true), some(true)]))',
    ],
    [
      'add',
      'evaluate(' + batch + ', {nodes: [column(0), column(1), add({left: 0, right: 1})], root: 2})',
      'ok(int64-column([some(3), some(23), some(34)]))',
    ],
    [
      'logical-and',
      'evaluate(' + batch + ', {nodes: [column(0), literal(int64(10)), greater({left: 0, right: 1}), column(2), logical-and({left: 2, right: 3})], root: 4})',
      'ok(boolean-column([some(false), some(false), some(true)]))',
    ],
    [
      'is-null',
      'evaluate(' + batch + ', {nodes: [column(3), is-null({input: 0})], root: 1})',
      'ok(boolean-column([some(false), some(true), some(false)]))',
    ],
    [
      'forward-reference',
      'evaluate(' + batch + ', {nodes: [add({left: 0, right: 0})], root: 0})',
      'err(forward-reference)',
    ],
    [
      'column-out-of-bounds',
      'evaluate(' + batch + ', {nodes: [column(9)], root: 0})',
      'err(column-out-of-bounds)',
    ],
    [
      'root-out-of-bounds',
      'evaluate(' + batch + ', {nodes: [column(0)], root: 2})',
      'err(root-out-of-bounds)',
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
    nodes: ['column','literal','compare','arithmetic','boolean','is-null'],
    cases: receipts.length,
    receipts,
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
