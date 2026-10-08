import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resourceCoreInputs, stageResourceCore, verifyResourceCoreReceipt } from './lib-refresh-resource-core-v2.mjs';
import { sha } from './lib-refresh-cache-v2.mjs';

// Input-envelope controls only. Real Core signatures, WIT and runtime behavior
// are qualified separately by the producer and actual all-operation consumers.
async function fixture(id = 'generic-resource-library') {
  const root = await mkdtemp(join(tmpdir(), 'wasmc-resource-input-'));
  const bytes = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
  const wit = Buffer.from('package example:resource;');
  const producer = 'a'.repeat(64);
  const graph = Buffer.from(JSON.stringify({ schema: 'wasmc.resource-plan-source/v1', wit: { sha256: sha(wit) }, logical_plan: {} }));
  await writeFile(join(root, 'graph.json'), graph);
  await writeFile(join(root, 'module.wasm'), bytes);
  await writeFile(join(root, 'provider.wasm'), bytes);
  const provider = { id: 'generic.heap', module: 'example:heap@2.0.0', version: '2.0.0' };
  const contract = { target_profile: 'portable-v0', provider, exports: [] };
  const assembly = { target_profile: 'portable-v0', graph: 'graph.json', graph_sha256: sha(graph),
    modules: [{ artifact: 'module.wasm', module: 'generic-delta', sha256: sha(bytes) }],
    provider: { ...provider, artifact: 'provider.wasm', sha256: sha(bytes) }, exports: [] };
  const manifest = { schema: 'wasmc.lib-refresh-resource-core-inputs/v1', producer_sha256: producer,
    source_commit: 'b'.repeat(40), packages: [{ id, root, wit_sha256: sha(wit), assembly }] };
  const specs = new Map([[id, { id, profile: 'resource', core_resource: contract }]]);
  const payloads = new Map([[id, { 'lib.wit': wit }]]);
  const path = join(root, 'inputs.json');
  const seal = async () => {
    const b = Buffer.from(JSON.stringify(manifest));
    await writeFile(path, b);
    return { resourceCoreInputs: path, resourceCoreInputsSha256: sha(b) };
  };
  return { root, manifest, specs, payloads, producer, seal, id };
}

async function rejection(name, mutate, expected) {
  await test(name, async () => {
    const f = await fixture();
    try {
      await mutate(f);
      const args = await f.seal();
      await assert.rejects(resourceCoreInputs(args, f.specs, f.payloads, f.producer, readFile), expected);
      assert.equal(await readFile(join(f.root, 'module.wasm')).then(b => b.length), 8);
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });
}

test('generic renamed identities stage exactly the independently pinned input bytes', async () => {
  for (const id of ['generic-resource-library', 'renamed-resource-library']) {
    const f = await fixture(id);
    try {
      const inputs = await resourceCoreInputs(await f.seal(), f.specs, f.payloads, f.producer, readFile);
      const input = inputs.get(id);
      assert.equal(input.identity.source_commit, 'b'.repeat(40));
      const workspace = join(f.root, 'workspace');
      const sync = async (path, bytes) => {
        await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
        await writeFile(path, bytes);
      };
      const staged = await stageResourceCore(input, workspace, id, sync);
      for (const file of [staged.graph, ...staged.modules.map(m => m.artifact), staged.provider.artifact]) {
        assert.ok(file.startsWith('resource-core/' + id + '/' + input.key + '/'));
        const expected = file === staged.graph ? staged.graph_sha256
          : file === staged.provider.artifact ? staged.provider.sha256 : staged.modules[0].sha256;
        assert.equal(sha(await readFile(join(workspace, file))), expected);
      }
    } finally { await rm(f.root, { recursive: true, force: true }); }
  }
});

test('input manifest requires an independent digest and never infers inputs', async () => {
  assert.equal((await resourceCoreInputs({}, new Map(), new Map(), '', readFile)).size, 0);
  await assert.rejects(resourceCoreInputs({ resourceCoreInputs: '/not-read' }, new Map(), new Map(), '', readFile), /provided together/);
  const f = await fixture();
  try {
    const args = await f.seal();
    args.resourceCoreInputsSha256 = '0'.repeat(64);
    await assert.rejects(resourceCoreInputs(args, f.specs, f.payloads, f.producer, readFile), /manifest digest mismatch/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

await rejection('producer drift rejects', f => { f.manifest.producer_sha256 = 'c'.repeat(64); }, /producer mismatch/);
await rejection('authored WIT drift rejects', f => { f.manifest.packages[0].wit_sha256 = 'c'.repeat(64); }, /WIT mismatch/);
await rejection('module digest drift rejects', f => { f.manifest.packages[0].assembly.modules[0].sha256 = 'c'.repeat(64); }, /file digest mismatch/);
await rejection('provider identity drift rejects', f => { f.manifest.packages[0].assembly.provider.version = '3.0.0'; }, /provider identity mismatch/);
await rejection('graph digest drift rejects', f => { f.manifest.packages[0].assembly.graph_sha256 = 'c'.repeat(64); }, /file digest mismatch/);
await rejection('duplicate package rejects', f => { f.manifest.packages.push(structuredClone(f.manifest.packages[0])); }, /duplicate resource Core package/);
await rejection('duplicate physical module rejects', f => { f.manifest.packages[0].assembly.modules.push(structuredClone(f.manifest.packages[0].assembly.modules[0])); }, /duplicate resource Core module/);
await rejection('unknown package rejects', f => { f.manifest.packages[0].id = 'unregistered'; }, /undeclared resource Core package/);
await rejection('extra source fields reject', f => { f.manifest.compatibility = true; }, /exact fields required/);
await rejection('relative root rejects', f => { f.manifest.packages[0].root = '.'; }, /root must be absolute/);
await rejection('path traversal rejects', f => { f.manifest.packages[0].assembly.modules[0].artifact = '../outside.wasm'; }, /relative path|escapes|unsafe/i);
await rejection('symlink source parent rejects', async f => {
  await symlink(f.root, join(f.root, 'alias'));
  f.manifest.packages[0].assembly.modules[0].artifact = 'alias/module.wasm';
}, /symbolic|canonical|symlink/i);
await rejection('graph WIT substitution rejects despite a correct new graph digest', async f => {
  const graph = Buffer.from(JSON.stringify({ schema: 'wasmc.resource-plan-source/v1', wit: { sha256: 'c'.repeat(64) }, logical_plan: {} }));
  await writeFile(join(f.root, 'graph.json'), graph);
  f.manifest.packages[0].assembly.graph_sha256 = sha(graph);
}, /graph WIT mismatch/);

async function receiptFixture() {
  const f = await fixture(), repo = join(f.root, 'repo'), args = await f.seal();
  const put = async (path, bytes) => {
    const full = join(repo, path); await mkdir(full.slice(0, full.lastIndexOf('/')), { recursive: true });
    await writeFile(full, typeof bytes === 'string' || Buffer.isBuffer(bytes) ? bytes : JSON.stringify(bytes));
  };
  await put('libspec/registry.json', { libs: [{ id: f.id, source: 'libspec/' + f.id }] });
  await put('libspec/' + f.id + '/lib.json', f.specs.get(f.id));
  await put('libspec/' + f.id + '/lib.wit', f.payloads.get(f.id)['lib.wit']);
  const external = {};
  const load = async path => { const b = await readFile(path); external[path] = sha(b); return b; };
  const inputs = await resourceCoreInputs(args, f.specs, f.payloads, f.producer, load);
  const identity = inputs.get(f.id).identity;
  const receipt = { rows: [{ id: f.id, resource_core_inputs: identity }],
    producer: { sha256: f.producer },
    resource_core_input_manifest: { path: args.resourceCoreInputs, sha256: args.resourceCoreInputsSha256 },
    resource_core_inputs: { [f.id]: identity }, producer_input_digests: external, source_digests: {} };
  return { ...f, repo, receipt };
}

test('pinned refresh receipt revalidates the current resource Core input closure', async () => {
  const f = await receiptFixture();
  try { await verifyResourceCoreReceipt(f.repo, f.receipt, readFile); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});
for (const [name, mutate, expected] of [
  ['missing manifest locator', f => { delete f.receipt.resource_core_input_manifest; }, /explicit input manifest/],
  ['changed provider bytes after build', async f => { await writeFile(join(f.root, 'provider.wasm'), 'changed'); }, /input drift/],
  ['changed row identity', f => { f.receipt.rows[0].resource_core_inputs = { ...f.receipt.rows[0].resource_core_inputs, source_commit: 'c'.repeat(40) }; }, /row identity/],
  ['unbound external digest', f => { f.receipt.producer_input_digests['/unknown-input'] = 'c'.repeat(64); }, /external input set/],
  ['self-rehashed input replacement', async f => {
    const p = join(f.root, 'provider.wasm'); await writeFile(p, 'replacement');
    f.receipt.producer_input_digests[p] = sha(Buffer.from('replacement'));
  }, /file digest mismatch/],
]) test('resource receipt rejects ' + name, async () => {
  const f = await receiptFixture();
  try { await mutate(f); await assert.rejects(verifyResourceCoreReceipt(f.repo, f.receipt, readFile), expected); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});
