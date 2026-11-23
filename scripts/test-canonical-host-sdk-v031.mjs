import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCanonicalHostCompiler} from '../current/canonical-host.mjs';
const root = new URL('../', import.meta.url);
const read = path => new Uint8Array(readFileSync(new URL(path, root)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = 'examples/current/canonical-host-v031/';
const readTuple = name => Object.fromEntries([
  ['wit', 'lib.wit'], ['executionAbi', 'execution-abi.json'],
  ['providerContract', 'provider-contract.json'], ['binding', 'binding.json']
].map(([key, file]) => [key, read(fixture + 'host/' + name + '/' + file)]));
const source = new TextDecoder().decode(read(fixture + 'app/ordinary.wasmc'));
const input = {source, activation: read(fixture + 'app/activation.json'),
  entry: readTuple('entry'), operations: readTuple('operations'),
  libCore: read('standard/wasmc-json/0.0.6/artifact.wasm'),
  libWit: read('standard/wasmc-json/0.0.6/lib.wit'), template: read(fixture + 'producer-assets/canonical-template.json')};
const expected = JSON.parse(new TextDecoder().decode(read(fixture + 'expected-frame.json')));
assert.equal(hash(input.activation), expected.activation_sha256);
assert.equal(hash(read('current/wasmc_compiler.wasm')), expected.compiler_sha256);
assert.equal(hash(read(fixture + 'producer-assets/frame-descriptor.json')), expected.frame_descriptor_sha256);
assert.equal(hash(read(fixture + 'producer-assets/caller-plan.json')), expected.caller_plan_sha256);
const checkModules = result => {
  for (const row of expected.modules) {
    const bytes = result.modules.get(row.path);
    assert.ok(bytes, row.path);
    assert.equal(bytes.length, row.bytes, row.path);
    assert.equal(hash(bytes), row.sha256, row.path);
  }
};
const product=JSON.parse(new TextDecoder().decode(read('current/compiler-release.json')));
let checkedProfile=false;
if(Number(product.version.split('.')[2])>=27) {
 const map=JSON.parse(new TextDecoder().decode(read(fixture+'checked-chunk-profile.json')));
 assert.equal(map.version,product.version);assert.equal(map.compiler.sha256,expected.compiler_sha256);
 assert.equal(Object.keys(map.assets).length,15);assert.equal(map.input_slots,14);assert.equal(map.module_count,8);
 for(const row of [map.compiler,...Object.values(map.assets)]){const bytes=read(row.path);assert.equal(bytes.length,row.bytes);assert.equal(hash(bytes),row.sha256);assert.equal(row.mode,'0644');}
 assert.equal(map.sdk_postprocessor,false);assert.equal(map.manual_module_substitution,false);
 checkedProfile=true;
}
const compiler = await createCanonicalHostCompiler(read('current/wasmc_compiler.wasm'));
let outputs = 0;
try {
  for (let i = 0; i < 2; i++) {
    const result = await compiler.compile(input);
    assert.equal(hash(result.frame), expected.frame_sha256);
    assert.equal(result.frame.length, expected.frame_bytes);
    assert.equal(result.modules.size, expected.module_count);
    checkModules(result);
    if(checkedProfile)for(const name of ['lib-projection.wasm','app-projection.wasm']) {
      const imports=WebAssembly.Module.imports(new WebAssembly.Module(result.modules.get(name)));
      for(const op of ['string_read_chunk_le','list_u8_read_chunk_le','list_u8_extend_chunk_le'])assert(imports.some(i=>i.name===op));
    }
    assert.equal(result.descriptor.source_sha256, hash(new TextEncoder().encode(source)));
    outputs++;
  }
  // A rejected source must leave no one-shot configuration for the next call.
  await assert.rejects(compiler.compile({...input, source: source + '\ninvalid source body'}));
  const recovered = await compiler.compile(input);
  assert.equal(hash(recovered.frame), expected.frame_sha256);
  checkModules(recovered);
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
  frame_bytes: expected.frame_bytes, checked_chunk_profile:checkedProfile, exact_native_modules: expected.modules.length,
  rejection_then_recovery: true, source_rebinding: true, real_Host_invocation: false}));
