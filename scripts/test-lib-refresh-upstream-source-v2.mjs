import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha } from './lib-refresh-cache-v2.mjs';
import { upstreamSourceInputs, verifyUpstreamSourceReceipt } from './lib-refresh-upstream-source-v2.mjs';
import { verifyResourceCoreReceipt } from './lib-refresh-resource-core-v2.mjs';

// Producer-input controls only, not upstream kernel or real Lib qualification.
async function fixture(id = 'current-upstream-module') {
  const root = await mkdtemp(join(tmpdir(), 'wasmc-upstream-input-'));
  const bytes = Buffer.from('pub fn value(v: i64) -> i64 { v }\n');
  await writeFile(join(root, 'source.rs'), bytes);
  const upstream = { repository: 'generic-source-repo', source_path: 'src/lib.rs',
    source_commit: 'b'.repeat(40), sha256: sha(bytes),
    git_blob: createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex') };
  const info = { module: 'upstream_module', dependencies: [], upstream_source: upstream };
  const policy = { shared_modules: { [id]: info } }, producer = 'a'.repeat(64);
  const manifest = { schema: 'wasmc.lib-refresh-upstream-source-inputs/v1',
    producer_sha256: producer, modules: [{ id, root, source: 'source.rs', upstream: structuredClone(upstream) }] };
  const path = join(root, 'inputs.json');
  const seal = async () => { const b = Buffer.from(JSON.stringify(manifest)); await writeFile(path, b);
    return { upstreamSourceInputs: path, upstreamSourceInputsSha256: sha(b) }; };
  return { id, root, bytes, upstream, info, policy, producer, manifest, seal };
}

test('current generic and renamed source inputs retain exact bytes and Git identity', async () => {
  for (const id of ['current-upstream-module', 'renamed-upstream-module']) {
    const f = await fixture(id);
    try { const inputs = await upstreamSourceInputs(await f.seal(), f.policy, f.producer, readFile);
      assert.deepEqual(inputs.get(id).bytes, f.bytes);
      assert.deepEqual(inputs.get(id).identity.upstream, f.upstream); }
    finally { await rm(f.root, { recursive: true, force: true }); }
  }
});
test('upstream sources require explicit paired independent manifest pins', async () => {
  const f = await fixture();
  try {
    await assert.rejects(upstreamSourceInputs({}, f.policy, f.producer, readFile), /explicit current upstream/);
    await assert.rejects(upstreamSourceInputs({ upstreamSourceInputs: '/not-read' }, f.policy, f.producer, readFile), /provided together/);
    const args = await f.seal(); args.upstreamSourceInputsSha256 = '0'.repeat(64);
    await assert.rejects(upstreamSourceInputs(args, f.policy, f.producer, readFile), /manifest digest mismatch/);
    assert.equal((await upstreamSourceInputs({}, {}, '', readFile)).size, 0);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
for (const [name, mutate, expected] of [
  ['producer substitution', f => { f.manifest.producer_sha256 = 'c'.repeat(64); }, /producer mismatch/],
  ['source commit drift', f => { f.manifest.modules[0].upstream.source_commit = 'c'.repeat(40); }, /identity mismatch/],
  ['source digest drift', async f => { await writeFile(join(f.root, 'source.rs'), 'different'); }, /source digest mismatch/],
  ['Git Blob substitution with policy agreement', f => { f.upstream.git_blob = 'c'.repeat(40); f.manifest.modules[0].upstream.git_blob = f.upstream.git_blob; }, /Blob\/content mismatch/],
  ['duplicate module', f => { f.manifest.modules.push(structuredClone(f.manifest.modules[0])); }, /duplicate upstream/],
  ['unknown module', f => { f.manifest.modules[0].id = 'unknown'; }, /undeclared upstream/],
  ['extra manifest field', f => { f.manifest.compatibility = true; }, /exact fields/],
  ['relative root', f => { f.manifest.modules[0].root = '.'; }, /canonical/],
  ['path traversal', f => { f.manifest.modules[0].source = '../outside.rs'; }, /unsafe|relative|escape/],
  ['symlink source file', async f => { await writeFile(join(f.root, 'other.rs'), f.bytes);
    await rm(join(f.root, 'source.rs')); await symlink(join(f.root, 'other.rs'), join(f.root, 'source.rs')); }, /canonical|symlink/],
  ['symlink source parent', async f => { await symlink(f.root, join(f.root, 'alias')); f.manifest.modules[0].source = 'alias/source.rs'; }, /canonical|symlink/],
  ['Rust source budget', async f => { await writeFile(join(f.root, 'source.rs'), Buffer.alloc(2 * 1024 * 1024 + 1)); }, /file budget/],
  ['both repository and upstream authority', f => { f.info.source = 'libspec/shared/other.rs'; }, /exact fields/],
]) test('upstream input rejects ' + name, async () => {
  const f = await fixture();
  try { await mutate(f); await assert.rejects(upstreamSourceInputs(await f.seal(), f.policy, f.producer, readFile), expected); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});

async function receiptFixture() {
  const f = await fixture(), args = await f.seal(), repo = join(f.root, 'repo');
  const put = async (path, data) => { const p = join(repo, path); await mkdir(p.slice(0, p.lastIndexOf('/')), { recursive: true });
    await writeFile(p, typeof data === 'string' ? data : JSON.stringify(data)); };
  await put('libspec/rust-policy.json', f.policy);
  await put('libspec/registry.json', { libs: [{ id: 'generic-lib', source: 'libspec/generic-lib' }] });
  await put('libspec/generic-lib/lib.json', { id: 'generic-lib', shared_modules: [f.id] });
  await put('libspec/generic-lib/lib.wit', 'package example:generic;');
  const digests = {};
  const load = async path => { const bytes = await readFile(path); digests[path] = sha(bytes); return bytes; };
  const inputs = await upstreamSourceInputs(args, f.policy, f.producer, load), identity = inputs.get(f.id).identity;
  const receipt = { producer: { sha256: f.producer },
    upstream_source_input_manifest: { path: args.upstreamSourceInputs, sha256: args.upstreamSourceInputsSha256 },
    upstream_source_inputs: { [f.id]: identity }, producer_input_digests: digests, source_digests: {},
    rows: [{ id: 'generic-lib', upstream_source_inputs: { [f.id]: identity } }] };
  return { ...f, repo, receipt };
}
const verify = async f => verifyResourceCoreReceipt(f.repo, f.receipt, readFile,
  await verifyUpstreamSourceReceipt(f.repo, f.receipt, readFile));
test('current receipt jointly fences upstream source and resource input closures', async () => {
  const f = await receiptFixture();
  try { await verify(f); } finally { await rm(f.root, { recursive: true, force: true }); }
});
for (const [name, mutate, expected] of [
  ['missing producer identity', f => { delete f.receipt.producer; }, /current refresh producer identity required/],
  ['missing locator', f => { delete f.receipt.upstream_source_input_manifest; }, /explicit current upstream/],
  ['source changed after build', async f => { await writeFile(join(f.root, 'source.rs'), 'changed'); }, /input drift/],
  ['row identity changed', f => { f.receipt.rows[0].upstream_source_inputs = {}; }, /row identity/],
  ['external input unbound', f => { f.receipt.producer_input_digests['/unknown'] = 'd'.repeat(64); }, /deep-equal/],
  ['self-rehashed changed source', async f => { const p = join(f.root, 'source.rs'); await writeFile(p, 'changed');
    f.receipt.producer_input_digests[p] = sha(Buffer.from('changed')); }, /source digest mismatch/],
]) test('upstream receipt rejects ' + name, async () => {
  const f = await receiptFixture();
  try { await mutate(f); await assert.rejects(verify(f), expected); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});
