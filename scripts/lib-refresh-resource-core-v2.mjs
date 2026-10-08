import assert from 'node:assert/strict';
import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { digest, inside, sha } from './lib-refresh-cache-v2.mjs';

const fields = (value, names, label) => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), label + ': object required');
  assert.deepEqual(Object.keys(value).sort(), [...names].sort(), label + ': exact fields required');
};
const pin = (value, label) => assert.match(value, /^[a-f0-9]{64}$/, label + ': exact SHA256 required');

export async function resourceCoreInputs(args, specs, payloads, producerSha, load) {
  assert.equal(Boolean(args.resourceCoreInputs), Boolean(args.resourceCoreInputsSha256),
    'resource Core input path and independent SHA256 must be provided together');
  const result = new Map();
  if (!args.resourceCoreInputs) return result;
  assert.ok(isAbsolute(args.resourceCoreInputs), 'resource Core input path must be absolute');
  pin(args.resourceCoreInputsSha256, 'resource Core input');
  const manifestBytes = await load(args.resourceCoreInputs);
  assert.ok(manifestBytes.length <= 1048576, 'resource Core input manifest budget');
  assert.equal(sha(manifestBytes), args.resourceCoreInputsSha256, 'resource Core input manifest digest mismatch');
  const manifest = JSON.parse(manifestBytes);
  fields(manifest, ['schema', 'producer_sha256', 'source_commit', 'packages'], 'resource Core input manifest');
  assert.equal(manifest.schema, 'wasmc.lib-refresh-resource-core-inputs/v1');
  assert.equal(manifest.producer_sha256, producerSha, 'resource Core input producer mismatch');
  assert.match(manifest.source_commit, /^[a-f0-9]{40}$/, 'resource Core source commit required');
  assert.ok(Array.isArray(manifest.packages) && manifest.packages.length > 0 && manifest.packages.length <= 64);
  for (const entry of manifest.packages) {
    fields(entry, ['id', 'root', 'wit_sha256', 'assembly'], 'resource Core package');
    assert.ok(specs.has(entry.id) && specs.get(entry.id).core_resource, 'undeclared resource Core package ' + entry.id);
    assert.ok(!result.has(entry.id), 'duplicate resource Core package ' + entry.id);
    assert.ok(isAbsolute(entry.root), 'resource Core source root must be absolute');
    assert.equal(await realpath(entry.root), entry.root, 'resource Core source root must be canonical, without symlinks');
    const spec = specs.get(entry.id), assembly = entry.assembly;
    assert.equal(spec.profile, 'resource', 'resource Core requires the resource profile');
    fields(spec.core_resource, ['target_profile', 'provider', 'exports'], 'resource Core authoring contract');
    fields(assembly, ['target_profile', 'graph', 'graph_sha256', 'modules', 'provider', 'exports'], 'resource Core assembly');
    assert.equal(assembly.target_profile, 'portable-v0');
    assert.equal(assembly.target_profile, spec.core_resource.target_profile, 'resource Core profile mismatch');
    assert.deepEqual(assembly.exports, spec.core_resource.exports, 'resource Core explicit exports mismatch');
    fields(assembly.provider, ['artifact', 'module', 'id', 'version', 'sha256'], 'resource Core provider');
    const { artifact, sha256, ...identity } = assembly.provider;
    assert.deepEqual(identity, spec.core_resource.provider, 'resource Core provider identity mismatch');
    assert.equal(entry.wit_sha256, sha(payloads.get(entry.id)['lib.wit']), 'resource Core WIT mismatch');
    assert.ok(Array.isArray(assembly.modules) && assembly.modules.length > 0 && assembly.modules.length <= 64);
    assert.equal(new Set(assembly.modules.map(m => m.module)).size, assembly.modules.length, 'duplicate resource Core module');
    const files = {}, paths = new Set();
    let total = 0;
    const capture = async (path, expected, limit) => {
      pin(expected, 'resource Core file');
      assert.ok(!paths.has(path), 'duplicate resource Core input path');
      paths.add(path);
      const full = inside(entry.root, path), st = await lstat(full);
      assert.equal(await realpath(full), full, 'resource Core input path must be canonical, without symlinks');
      assert.ok(st.isFile() && !st.isSymbolicLink(), 'resource Core input must be a regular file');
      assert.ok(st.size <= limit, 'resource Core file budget');
      const bytes = await load(full);
      total += bytes.length;
      assert.ok(total <= 64 * 1024 * 1024, 'resource Core total input budget');
      assert.equal(sha(bytes), expected, 'resource Core file digest mismatch: ' + path);
      files[path] = bytes;
      return bytes;
    };
    const graph = JSON.parse(await capture(assembly.graph, assembly.graph_sha256, 1048576));
    assert.equal(graph.schema, 'wasmc.resource-plan-source/v1');
    assert.equal(graph.wit.sha256, entry.wit_sha256, 'resource Core graph WIT mismatch');
    for (const module of assembly.modules) {
      fields(module, ['artifact', 'module', 'sha256'], 'resource Core module');
      assert.ok(typeof module.module === 'string' && module.module.length > 0, 'resource Core module identity');
      await capture(module.artifact, module.sha256, 16 * 1024 * 1024);
    }
    await capture(artifact, sha256, 16 * 1024 * 1024);
    const identityRecord = {
      manifest_sha256: args.resourceCoreInputsSha256, source_commit: manifest.source_commit,
      producer_sha256: producerSha, wit_sha256: entry.wit_sha256, assembly,
      files: Object.fromEntries(Object.entries(files).map(([p, b]) => [p, { bytes: b.length, sha256: sha(b) }])),
    };
    result.set(entry.id, { files, assembly, identity: identityRecord, key: digest(identityRecord) });
  }
  return result;
}

export async function stageResourceCore(input, workspace, id, sync) {
  const base = 'resource-core/' + id + '/' + input.key;
  for (const [path, bytes] of Object.entries(input.files)) await sync(join(workspace, base, path), bytes);
  const assembly = structuredClone(input.assembly);
  assembly.graph = base + '/' + assembly.graph;
  for (const module of assembly.modules) module.artifact = base + '/' + module.artifact;
  assembly.provider.artifact = base + '/' + assembly.provider.artifact;
  return assembly;
}

export async function verifyResourceCoreReceipt(repo, receipt, load) {
  const registry = JSON.parse(await load(join(repo, 'libspec/registry.json')));
  const specs = new Map(), payloads = new Map();
  for (const row of registry.libs) {
    specs.set(row.id, JSON.parse(await load(join(repo, row.source, 'lib.json'))));
    payloads.set(row.id, { 'lib.wit': await load(join(repo, row.source, 'lib.wit')) });
  }
  const selected = receipt.rows.filter(row => specs.get(row.id)?.core_resource);
  const locator = receipt.resource_core_input_manifest;
  if (!locator) {
    assert.equal(selected.length, 0, 'resource Core receipt requires the explicit input manifest');
    assert.deepEqual(receipt.resource_core_inputs ?? {}, {});
    assert.deepEqual(receipt.producer_input_digests ?? {}, {});
    for (const row of receipt.rows) assert.ok(!row.resource_core_inputs, 'unexpected resource Core row identity');
    return;
  }
  fields(locator, ['path', 'sha256'], 'resource Core receipt manifest locator');
  assert.ok(isAbsolute(locator.path), 'absolute resource Core receipt manifest required');
  pin(locator.sha256, 'resource Core receipt manifest');
  const captured = {};
  const checkedLoad = async path => {
    const bytes = await load(path);
    const expected = path.startsWith(repo + '/')
      ? receipt.source_digests?.[path.slice(repo.length + 1)] : receipt.producer_input_digests?.[path];
    assert.equal(sha(bytes), expected, 'resource Core receipt input drift: ' + path);
    if (!path.startsWith(repo + '/')) captured[path] = expected;
    return bytes;
  };
  const inputs = await resourceCoreInputs({
    resourceCoreInputs: locator.path, resourceCoreInputsSha256: locator.sha256,
  }, specs, payloads, receipt.producer.sha256, checkedLoad);
  assert.deepEqual(receipt.resource_core_inputs,
    Object.fromEntries([...inputs].map(([id, input]) => [id, input.identity])),
    'resource Core receipt assembly identity mismatch');
  assert.deepEqual(receipt.producer_input_digests, captured, 'resource Core receipt external input set mismatch');
  for (const row of receipt.rows) {
    const expected = specs.get(row.id)?.core_resource ? inputs.get(row.id)?.identity : null;
    if (specs.get(row.id)?.core_resource) assert.ok(expected, row.id + ': current resource Core input missing');
    assert.deepEqual(row.resource_core_inputs ?? null, expected, row.id + ': resource Core row identity mismatch');
  }
}
