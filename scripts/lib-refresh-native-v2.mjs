// Native platform payloads share the current source and receipt contract.
// Embedded Swift/Android sources are never mislabeled as executable Wasm.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { atomicJson, command, sha, writeChanged } from './lib-refresh-cache-v2.mjs';

export async function buildNative(spec, payloads, root, context) {
  assert.equal(spec.profile, 'native');
  const native = spec.native;
  assert.ok(['c-boundary', 'node-boundary', 'swift-embedded'].includes(native.kind));
  assert.ok(native.files.includes(native.entry));
  for (const file of ['lib.wit', ...native.files]) await writeChanged(join(root, file), payloads[file]);
  const describe = async path => {
    const bytes = await readFile(join(root, path));
    return { path, bytes: bytes.length, sha256: sha(bytes) };
  };
  let artifact = null, descriptor = null;
  let status = 'embedded_source_packaged';
  const local = native.target === process.platform;
  if (native.kind === 'c-boundary' && local) {
    assert.equal(process.platform, 'linux', 'current native C builder requires Linux');
    const path = 'native-adapter.so';
    await command('cc', ['-shared', '-fPIC', '-O2', '-Wall', '-Wextra', '-Werror', '-pthread',
      join(root, native.entry), '-o', join(root, path)],
      { cwd: context.repo, env: context.env, logs: join(context.logs, 'native-cc'), timeout: 90000 });
    artifact = await describe(path);
    status = 'native_binary_built_not_runtime_qualified';
  } else if (native.kind === 'node-boundary') {
    for (const path of native.files.filter(f => f.endsWith('.mjs')))
      await command(process.execPath, ['--check', join(root, path)],
        { cwd: context.repo, env: context.env, logs: join(context.logs, 'syntax-'+path.replaceAll('/', '_')), timeout: 15000 });
    artifact = await describe(native.entry);
    status = 'native_module_syntax_checked_not_runtime_qualified';
  }
  if (artifact && native.descriptor_template) {
    const template = JSON.parse(payloads[native.descriptor_template]);
    assert.equal(template.schema, 'wasmc.native-boundary-descriptor/v1');
    template.adapter.path = artifact.path;
    template.adapter.sha256 = artifact.sha256;
    template.lifecycle = 'current-source-built-not-admitted-not-released';
    await atomicJson(join(root, 'native-boundary.json'), template);
    descriptor = await describe('native-boundary.json');
  }
  const implementation = await Promise.all(native.files.map(describe));
  const manifest = {
    schema: 'wasmc.lib-native/v2', id: spec.id, version: spec.version, profile: 'native',
    wit: await describe('lib.wit'), implementation, artifact, native_boundary: descriptor,
    native: { kind: native.kind, target: native.target, status,
      build_host: process.platform, build_arch: process.arch,
      device_qualified: false, wasm_lowered: false, component_sdk: false },
    build: { input_authority: 'libspec', producer_sha256: context.producerSha,
      native_toolchain: context.nativeToolchain },
    bindings: { native: { schema: 'wasmc.lib-native-binding/v2',
      kind: native.kind, entry: native.entry, target: native.target } },
    lifecycle: { source_packaged: true, runtime_qualified: false,
      admitted: false, released: false, installable: false },
  };
  await atomicJson(join(root, 'lib.json'), manifest);
  return status;
}
