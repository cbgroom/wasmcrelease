import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCanonicalHostCompiler} from '../current/canonical-host.mjs';
const root = new URL('../', import.meta.url);
const read = path => new Uint8Array(readFileSync(new URL(path, root)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = 'examples/canonical-host/';
const readTuple = name => Object.fromEntries([
  ['wit', 'lib.wit'], ['executionAbi', 'execution-abi.json'],
  ['providerContract', 'provider-contract.json'], ['binding', 'binding.json']
].map(([key, file]) => [key, read(fixture + 'host/' + name + '/' + file)]));
const source = new TextDecoder().decode(read(fixture + 'app/ordinary.wasmc'));
const input = {source, activation: read(fixture + 'app/activation.json'),
  entry: readTuple('entry'), operations: readTuple('operations'),
  libCore: read('standard/wasmc-json/0.0.5/artifact.wasm'),
  libWit: read('standard/wasmc-json/0.0.5/lib.wit'), template: read(fixture + 'aux/canonical-template.json')};
const expected = JSON.parse(new TextDecoder().decode(read(fixture + 'expected-frame.json')));
const compiler = await createCanonicalHostCompiler(read('current/wasmc_compiler.wasm'));
let outputs = 0;
try {
  for (let i = 0; i < 2; i++) {
    const result = await compiler.compile(input);
    assert.equal(hash(result.frame), expected.frame_sha256);
    assert.equal(result.frame.length, expected.frame_bytes);
    assert.equal(result.modules.size, expected.module_count);
    assert.equal(result.descriptor.source_sha256, hash(new TextEncoder().encode(source)));
    outputs++;
  }
  // A rejected source must leave no one-shot configuration for the next call.
  await assert.rejects(compiler.compile({...input, source: source + '\ninvalid source body'}));
  assert.equal(hash((await compiler.compile(input)).frame), expected.frame_sha256);
  outputs++;
  const nextSource = source + '\n';
  const activation = JSON.parse(new TextDecoder().decode(input.activation));
  activation.source_sha256 = hash(new TextEncoder().encode(nextSource));
  const result = await compiler.compile({...input, source: nextSource,
    activation: new TextEncoder().encode(JSON.stringify(activation))});
  assert.equal(result.descriptor.source_sha256, activation.source_sha256);
  assert.notEqual(hash(result.frame), expected.frame_sha256);
  assert.equal(result.modules.size, 8);
  outputs++;
} finally {compiler.dispose();}
await assert.rejects(compiler.compile(input), /disposed/);
console.log(JSON.stringify({accepted: true,
  runtime: globalThis.Deno ? 'deno' : globalThis.Bun ? 'bun' : 'node',
  compiler_sha256: hash(read('current/wasmc_compiler.wasm')),
  compiled_frames: outputs, modules_per_frame: 8, native_parity: expected.frame_sha256,
  rejection_then_recovery: true, source_rebinding: true, real_Host_invocation: false}));
