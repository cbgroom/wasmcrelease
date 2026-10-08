import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { inside, sha } from './lib-refresh-cache-v2.mjs';

const fields = (v, names, label) => {
  assert.ok(v && typeof v === 'object' && !Array.isArray(v), label + ': object required');
  assert.deepEqual(Object.keys(v).sort(), [...names].sort(), label + ': exact fields required');
};
const forbidden = ['wit_bindgen', 'export!(', 'core_abi', 'wasmtime', 'wasmi', 'Store<', 'Linker<'];
export function validateUpstreamSourceContract(info) {
  fields(info, ['module', 'dependencies', 'upstream_source'], 'upstream shared module');
  assert.match(info.module, /^[a-z_][a-z0-9_]{0,63}$/);
  assert.ok(Array.isArray(info.dependencies));
  const source = info.upstream_source;
  fields(source, ['repository', 'source_path', 'source_commit', 'git_blob', 'sha256'], 'upstream source contract');
  assert.ok(typeof source.repository === 'string' && source.repository.length > 0 && source.repository.length <= 128);
  assert.ok(typeof source.source_path === 'string' && source.source_path.length <= 512 && source.source_path.endsWith('.rs'));
  inside('/upstream', source.source_path);
  for (const key of ['source_commit', 'git_blob']) assert.match(source[key], /^[a-f0-9]{40}$/);
  assert.match(source.sha256, /^[a-f0-9]{64}$/);
  return source;
}

export async function upstreamSourceInputs(args, policy, producerSha, load) {
  assert.equal(Boolean(args.upstreamSourceInputs), Boolean(args.upstreamSourceInputsSha256),
    'upstream source input path and independent SHA256 must be provided together');
  const result = new Map();
  const required = Object.entries(policy.shared_modules ?? {}).filter(([, info]) => info.upstream_source);
  for (const [, info] of required) validateUpstreamSourceContract(info);
  if (!args.upstreamSourceInputs) {
    assert.equal(required.length, 0, 'explicit current upstream source inputs required before Cargo');
    return result;
  }
  assert.ok(isAbsolute(args.upstreamSourceInputs), 'absolute upstream source input manifest required');
  assert.match(args.upstreamSourceInputsSha256, /^[a-f0-9]{64}$/);
  assert.equal(await realpath(args.upstreamSourceInputs), args.upstreamSourceInputs, 'upstream input manifest must be canonical');
  const st = await lstat(args.upstreamSourceInputs);
  assert.ok(st.isFile() && !st.isSymbolicLink() && st.size <= 1048576, 'upstream input manifest file budget');
  const bytes = await load(args.upstreamSourceInputs);
  assert.equal(sha(bytes), args.upstreamSourceInputsSha256, 'upstream input manifest digest mismatch');
  const manifest = JSON.parse(bytes);
  fields(manifest, ['schema', 'producer_sha256', 'modules'], 'upstream input manifest');
  assert.equal(manifest.schema, 'wasmc.lib-refresh-upstream-source-inputs/v1');
  assert.equal(manifest.producer_sha256, producerSha, 'upstream input producer mismatch');
  assert.ok(Array.isArray(manifest.modules) && manifest.modules.length > 0 && manifest.modules.length <= 64);
  let total = 0;
  const paths = new Set();
  for (const entry of manifest.modules) {
    fields(entry, ['id', 'root', 'source', 'upstream'], 'upstream input module');
    assert.match(entry.id, /^[a-z][a-z0-9-]{0,63}$/);
    assert.ok(!result.has(entry.id), 'duplicate upstream input module');
    const info = policy.shared_modules?.[entry.id];
    assert.ok(info?.upstream_source, 'undeclared upstream input module ' + entry.id);
    assert.deepEqual(entry.upstream, validateUpstreamSourceContract(info), 'upstream source identity mismatch');
    assert.ok(isAbsolute(entry.root) && await realpath(entry.root) === entry.root, 'upstream root must be canonical');
    assert.ok(typeof entry.source === 'string' && entry.source.endsWith('.rs'), 'Rust source required');
    const file = inside(entry.root, entry.source);
    assert.ok(!paths.has(file), 'duplicate upstream source locator'); paths.add(file);
    assert.equal(await realpath(file), file, 'upstream source must be canonical without symlinks');
    const stat = await lstat(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 2 * 1024 * 1024, 'upstream Rust file budget');
    const source = await load(file);
    total += source.length; assert.ok(total <= 32 * 1024 * 1024, 'upstream source total budget');
    assert.equal(sha(source), entry.upstream.sha256, 'upstream Rust source digest mismatch');
    const blob = createHash('sha1').update(Buffer.from('blob ' + source.length + '\0')).update(source).digest('hex');
    assert.equal(blob, entry.upstream.git_blob, 'upstream Git Blob/content mismatch');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(source);
    for (const token of forbidden) assert.ok(!text.includes(token), 'upstream source contains generated/runtime concern ' + token);
    result.set(entry.id, { bytes: source, identity: {
      manifest_sha256: args.upstreamSourceInputsSha256, producer_sha256: producerSha,
      module: info.module, upstream: entry.upstream, bytes: source.length, sha256: sha(source),
    } });
  }
  assert.deepEqual([...result.keys()].sort(), required.map(([id]) => id).sort(), 'upstream source input set mismatch');
  return result;
}

export async function verifyUpstreamSourceReceipt(repo, receipt, load) {
  assert.match(receipt.producer?.sha256 ?? '', /^[a-f0-9]{64}$/, 'current refresh producer identity required');
  const policy = JSON.parse(await load(join(repo, 'libspec/rust-policy.json')));
  const locator = receipt.upstream_source_input_manifest;
  const captured = {};
  const checkedLoad = async path => {
    const bytes = await load(path);
    const expected = path.startsWith(repo + '/')
      ? receipt.source_digests?.[path.slice(repo.length + 1)] : receipt.producer_input_digests?.[path];
    assert.equal(sha(bytes), expected, 'upstream receipt input drift: ' + path);
    if (!path.startsWith(repo + '/')) captured[path] = expected;
    return bytes;
  };
  if (locator) fields(locator, ['path', 'sha256'], 'upstream receipt manifest locator');
  const inputs = await upstreamSourceInputs(locator ? {
    upstreamSourceInputs: locator.path, upstreamSourceInputsSha256: locator.sha256,
  } : {}, policy, receipt.producer.sha256, checkedLoad);
  assert.deepEqual(receipt.upstream_source_inputs ?? {},
    Object.fromEntries([...inputs].map(([id, input]) => [id, input.identity])),
    'upstream receipt identity mismatch');
  const registry = JSON.parse(await load(join(repo, 'libspec/registry.json')));
  for (const row of receipt.rows) {
    const entry = registry.libs.find(e => e.id === row.id); assert.ok(entry, 'unregistered upstream row');
    const spec = JSON.parse(await load(join(repo, entry.source, 'lib.json')));
    const expected = Object.fromEntries((spec.shared_modules ?? []).filter(id => inputs.has(id))
      .map(id => [id, inputs.get(id).identity]));
    assert.deepEqual(row.upstream_source_inputs ?? {}, expected, row.id + ': upstream row identity mismatch');
  }
  return captured;
}
