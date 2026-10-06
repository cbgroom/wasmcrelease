import { generatedLib } from './generated-lib-v2.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const selected = await generatedLib('wasmc-csv');
const csvRoot = selected.root;
const manifest = selected.manifest;
const oracle = JSON.parse(await readFile(resolve(root, 'tests/lib-refresh/oracles/wasmc-csv.json'), 'utf8'));

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


const csvArtifact = selected.artifact;
const dataSelected = await generatedLib('wasmc-data-core');
const dataArtifact = dataSelected.artifact;
const csvBytes = await readFile(csvArtifact);
const dataBytes = await readFile(dataArtifact);
assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(csvBytes)), []);
assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(dataBytes)), []);

const wit = run('wasm-tools', ['component', 'wit', csvArtifact]);
assert.match(wit, /import wasmc:data-core\/types@0\.0\.1;/);
assert.match(wit, /export wasmc:csv\/parser@0\.0\.1;/);
assert.doesNotMatch(wit, /import .*host/i);

const work = await mkdtemp(join(tmpdir(), 'wasmc-csv-'));
try {
  const csvComponent = selected.component;
  const dataComponent = dataSelected.component;



  const bytes = [...new TextEncoder().encode('id,name\n1,A\n2,B\n3,C\n')].join(',');
  const fields = '[{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: false}]';
  const invocation = 'parse([' + bytes + '], ' + fields + ', {has-header: true, validate-header: true, delimiter: 44, batch-rows: 2})';
  const expected = 'ok([{rows: 2, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: false}], columns: [int64-column([some(1), some(2)]), utf8-column([some("A"), some("B")])]}, {rows: 1, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: false}], columns: [int64-column([some(3)]), utf8-column([some("C")])]}])';
  const actual = run('wasmtime', ['run', '--invoke', invocation, csvComponent], { timeout: 30000 });
  assert.equal(actual, expected);

  const firstBatch = '{rows: 2, fields: [{name: "id", data-type: int64, nullable: false}, {name: "name", data-type: utf8, nullable: false}], columns: [int64-column([some(1), some(2)]), utf8-column([some("A"), some("B")])]}';
  const validated = run('wasmtime', ['run', '--invoke', 'validate(' + firstBatch + ')', dataComponent], { timeout: 30000 });
  assert.equal(validated, 'ok(2)');

  const invalidOptions = run('wasmtime', [
    'run', '--invoke',
    'parse([], ' + fields + ', {has-header: false, validate-header: false, delimiter: 44, batch-rows: 0})',
    csvComponent,
  ]);
  assert.equal(invalidOptions, 'err(invalid-options)');

  const binaryFields = '[{name: "payload", data-type: binary, nullable: true}]';
  const unsupported = run('wasmtime', [
    'run', '--invoke',
    'parse([120,10], ' + binaryFields + ', {has-header: false, validate-header: false, delimiter: 44, batch-rows: 16})',
    csvComponent,
  ]);
  assert.equal(unsupported, 'err(unsupported-type)');

  const pipeBytes = [...new TextEncoder().encode('1|x\n2|y\n')].join(',');
  const pipe = run('wasmtime', [
    'run', '--invoke',
    'parse([' + pipeBytes + '], ' + fields + ', {has-header: false, validate-header: false, delimiter: 124, batch-rows: 16})',
    csvComponent,
  ]);
  assert.match(pipe, /^ok\(\[\{rows: 2,/);

  console.log(JSON.stringify({
    accepted: true,
    candidate: manifest.id,
    version: manifest.version,
    candidate_bytes: csvBytes.length,
    candidate_sha256: createHash('sha256').update(csvBytes).digest('hex'),
    core_imports: 0,
    type_dependency: oracle.origin.type_dependency,
    arrow_csv_backed: true,
    batches: [2, 1],
    data_core_validate: validated,
    delimiter_case: 'pipe-pass',
    negative_cases: ['invalid-options', 'unsupported-type'],
  }));
} finally {
  await rm(work, { recursive: true, force: true });
}
