import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root = new URL('../../../', import.meta.url);
const fixture = 'examples/canonical-host/producer-assets/';
const read = path => new Uint8Array(readFileSync(new URL(path, root)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(new TextDecoder().decode(read(path)));
const recipe = json(fixture + 'merge-assets.json');
const plan = json(fixture + 'caller-plan.json');
const descriptor = json(fixture + 'frame-descriptor.json');
assert.equal(recipe.inputs.length, 11);
assert.equal(plan.inputs.length, 11);
assert.equal(plan.corelib_instances, 1);
assert.equal(plan.imports.length, 18);
assert.equal(hash(read(fixture + recipe.qualified_caller_plan.path)), recipe.qualified_caller_plan.sha256);
assert.deepEqual(recipe.memory_binding, plan.memory_binding);
assert.equal(recipe.core_provider.abi_namespace, recipe.inputs[10].module);
assert.equal(recipe.core_provider.raw.sha256, plan.corelib_sha256);
assert.equal(hash(read('current/lib_core.wasm')), recipe.core_provider.raw.sha256);
assert.equal(recipe.core_provider.prepared.sha256, plan.inputs[10].sha256);
assert.deepEqual(descriptor.canonical_entries, plan.canonical_entries);
assert.deepEqual(descriptor.native_host_projection, plan.native_host_projection);
const modules = new Map();
for (let i = 0; i < recipe.inputs.length; i++) {
  const input = recipe.inputs[i], pinned = plan.inputs[i];
  assert.equal(input.index, i);
  assert.equal(input.plan_path, pinned.path);
  assert.equal(input.module, pinned.module);
  assert.equal(input.bytes, pinned.bytes);
  assert.equal(input.sha256, pinned.sha256);
  const bytes = read(fixture + input.path);
  assert.equal(bytes.length, input.bytes);
  assert.equal(hash(bytes), input.sha256);
  modules.set(input.module, new WebAssembly.Module(bytes));
}
const memoryEdges = [];
for (const [consumer, module] of modules) {
  for (const item of WebAssembly.Module.imports(module).filter(row => row.kind === 'memory')) {
    const provider = modules.get(item.module);
    assert.ok(provider, item.module);
    assert.ok(WebAssembly.Module.exports(provider).some(row => row.kind === 'memory' && row.name === item.name));
    memoryEdges.push({consumer, provider: item.module, memory: item.name});
  }
}
const host = plan.memory_binding.host_memory;
const split = host.lastIndexOf('.');
assert.ok(split > 0);
assert.ok(WebAssembly.Module.exports(modules.get(host.slice(0, split))).some(row => row.kind === 'memory' && row.name === host.slice(split + 1)));
assert.ok(WebAssembly.Module.exports(modules.get(recipe.lib_import_module)).some(row => row.kind === 'memory'));
const expectedArgv = recipe.inputs.flatMap(row => [row.path, row.module]);
expectedArgv.push('--rename-export-conflicts', '--all-features', '--quiet', '-o', 'app.wasm');
assert.deepEqual(recipe.merger.argv, expectedArgv);
assert.equal(recipe.merger.sha256, plan.merge_tool_sha256);
assert.deepEqual(recipe.merger.expected_output, plan.artifact);
console.log(JSON.stringify({accepted:true, inputs:recipe.inputs.length, all_input_bytes_and_hashes_exact:true, all_modules_engine_validated:true, memory_edges:memoryEdges, host_memory:host, lib_memory_export:true, exact_merge_argv:true, expected_app:plan.artifact, app_instantiated:false, Rust_build:false, original19_rerun:false}));
