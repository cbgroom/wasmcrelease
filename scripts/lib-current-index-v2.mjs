// Current authoring registry -> explicit immutable search data. No frozen catalog.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWitRoutes } from './lib-route-closure.mjs';
import { generatedLib } from './generated-lib-v2.mjs';
import { inventory, sha, digest } from './lib-refresh-cache-v2.mjs';

const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export async function currentIndex(repo, bindings = []) {
  repo = resolve(repo);
  const registryBytes = await readFile(join(repo, 'libspec/registry.json'));
  const registry = JSON.parse(registryBytes);
  assert.equal(registry.schema, 'wasmc.lib-refresh-registry/v2');
  assert.ok(Array.isArray(registry.libs) && registry.libs.length > 0);
  const policyBytes = await readFile(join(repo, 'libspec/rust-policy.json'));
  const policy = JSON.parse(policyBytes);
  const lockHash = sha(await readFile(join(repo, 'libspec/Cargo.lock')));
  const source = {}, sources = new Map();
  for (const row of registry.libs) {
    assert.match(row.id, /^[a-z0-9][a-z0-9-]*$/);
    assert.equal(row.source, 'libspec/' + row.id);
    assert.ok(!sources.has(row.id), 'duplicate implementation ID');
    const files = await inventory(join(repo, row.source));
    const specBytes = await readFile(join(repo, row.source, 'lib.json'));
    assert.equal(sha(specBytes), files['lib.json']?.sha256, 'source changed while scanning');
    const spec = JSON.parse(specBytes);
    assert.equal(spec.id, row.id); assert.equal(spec.schema, 'wasmc.lib-refresh-source/v2');
    assert.match(spec.version, /^\d+\.\d+\.\d+$/);
    assert.ok(['value', 'resource', 'host', 'native'].includes(spec.profile));
    const wit = await readFile(join(repo, row.source, 'lib.wit'));
    assert.equal(sha(wit), files['lib.wit']?.sha256, 'WIT changed while scanning');
    const text = wit.toString('utf8');
    // The shared extractor handles current interface exports, including resource
    // constructors/methods. Reject inline forms instead of silently omitting APIs.
    assert.ok(!/\bexport\s+[^;{}]+:/.test(text), row.id + ': inline/aliased WIT export requires an extractor extension');
    const routes = parseWitRoutes(wit);
    assert.ok(routes.identity.endsWith('@' + spec.version), row.id + ': version drift');
    assert.ok(routes.api_routes.length > 0, row.id + ': empty exported API inventory');
    for (const [path, value] of Object.entries(files)) source[row.source + '/' + path] = value.sha256;
    sources.set(row.id, { row, spec, files, routes, delivery: null });
  }
  const receipts = [];
  for (const binding of bindings) {
    assert.match(binding.receipt_sha256, /^[a-f0-9]{64}$/);
    const run = resolve(binding.run_root);
    const receiptBytes = await readFile(join(run, 'refresh-receipt.json'));
    assert.equal(sha(receiptBytes), binding.receipt_sha256, 'refresh receipt pin mismatch');
    const receipt = JSON.parse(receiptBytes);
    assert.equal(receipt.accepted, true, 'partial refresh cannot authorize binding');
    assert.equal(receipt.schema, 'wasmc.lib-refresh-receipt/v2');
    assert.equal(receipt.cargo_lock_sha256, lockHash, 'binding has stale shared lock');
    assert.equal(receipt.source_digests?.['libspec/rust-policy.json'], sha(policyBytes), 'binding has stale Rust policy');
    assert.equal(new Set(receipt.rows.map(row => row.id)).size, receipt.rows.length);
    const expectedInput = async path => {
      assert.equal(receipt.source_digests?.[path], sha(await readFile(join(repo, path))), 'binding has stale source: ' + path);
    };
    for (const row of receipt.rows) {
      const current = sources.get(row.id);
      assert.ok(current, 'binding for unregistered implementation: ' + row.id);
      assert.equal(current.delivery, null, 'ambiguous duplicate artifact binding: ' + row.id);
      assert.equal(row.version, current.spec.version); assert.equal(row.profile, current.spec.profile);
      for (const path of Object.keys(current.files)) await expectedInput(current.row.source + '/' + path);
      const visited = new Set();
      const dependencies = async id => {
        if (visited.has(id)) return; visited.add(id);
        const item = sources.get(id); assert.ok(item, 'unknown WIT dependency: ' + id);
        await expectedInput(item.row.source + '/lib.wit');
        for (const dep of item.spec.wit_dependencies ?? []) await dependencies(dep);
      };
      for (const dep of current.spec.wit_dependencies ?? []) await dependencies(dep);
      for (const name of current.spec.shared_modules ?? []) {
        assert.ok(policy.shared_modules?.[name]); await expectedInput(policy.shared_modules[name].source);
      }
      const loaded = await generatedLib(row.id, run);
      assert.equal(loaded.manifest.wit.sha256, current.files['lib.wit'].sha256, 'bound WIT is not current');
      const native = current.spec.profile === 'native';
      const artifactKind = !native ? 'wasm-core-component' : !loaded.manifest.artifact ? 'native-source'
        : current.spec.native.kind === 'node-boundary' ? 'native-module' : 'native-binary';
      current.delivery = {
        manifest_sha256: loaded.row.manifest_sha256, receipt_sha256: binding.receipt_sha256,
        artifact_kind: artifactKind,
        artifact_path: loaded.manifest.artifact?.path ?? null,
        artifact_sha256: loaded.manifest.artifact?.sha256 ?? null,
        component_sha256: loaded.manifest.component?.sha256 ?? null,
      };
      if (native) assert.equal(current.delivery.component_sha256, null);
    }
    receipts.push({ receipt_sha256: binding.receipt_sha256, ids: receipt.rows.map(row => row.id).sort(order) });
  }
  const entries = [];
  for (const { row, spec, files, routes, delivery } of sources.values()) {
    const packageIdentity = row.id + '@' + spec.version;
    const base = { package_id: row.id, version: spec.version, profile: spec.profile,
      target: spec.profile === 'native' ? spec.native.target : policy.target,
      source_path: row.source + '/lib.wit', wit_sha256: files['lib.wit'].sha256, delivery };
    entries.push({ ...base, identity: packageIdentity, kind: 'package', wit_route: routes.identity, description: spec.description });
    for (const route of routes.api_routes) {
      const suffix = route.slice(routes.identity.length + 1);
      const leaf = suffix.split('#')[1];
      const api = leaf.startsWith('[constructor]') ? 'constructor' : leaf.replace(/^\[(?:static|method)\][^.]+\./, '');
      const description = spec.apis.find(a => a.api === api)?.delta ?? 'Public WIT resource operation: ' + leaf;
      entries.push({ ...base, identity: packageIdentity + '/' + suffix, kind: 'api', wit_route: route, description });
    }
  }
  entries.sort((a, b) => order(a.identity, b.identity));
  assert.equal(new Set(entries.map(e => e.identity)).size, entries.length, 'duplicate search identity');
  assert.ok(entries.length <= 4096, 'index entry budget');
  const input = Object.fromEntries(Object.entries(source).sort(([a], [b]) => order(a, b)));
  const index = { schema: 'wasmc.current-lib-search-index/v1', registry_sha256: sha(registryBytes),
    source_fingerprint: digest(input), entries };
  const bytes = Buffer.from(JSON.stringify(index) + '\n');
  assert.ok(bytes.length <= 2 * 1024 * 1024, 'index byte budget');
  for (const [path, expected] of Object.entries(input)) assert.equal(sha(await readFile(join(repo, path))), expected, 'source changed during index generation: ' + path);
  assert.equal(sha(await readFile(join(repo, 'libspec/registry.json'))), index.registry_sha256);
  assert.equal(sha(await readFile(join(repo, 'libspec/rust-policy.json'))), sha(policyBytes));
  assert.equal(sha(await readFile(join(repo, 'libspec/Cargo.lock'))), lockHash);
  return { index, bytes, inputs: input, receipts,
    summary: { packages: sources.size, apis: entries.length - sources.size, entries: entries.length,
      bound_packages: [...sources.values()].filter(s => s.delivery).length,
      native_source_packages: [...sources.values()].filter(s => s.delivery?.artifact_kind === 'native-source').length,
      index_sha256: sha(bytes), bytes: bytes.length, public_admission: false } };
}

async function main() {
  const args = process.argv.slice(2); let out, check; const bindings = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') out = resolve(args[++i]);
    else if (args[i] === '--check') check = resolve(args[++i]);
    else if (args[i] === '--bind') bindings.push({ run_root: args[++i], receipt_sha256: args[++i] });
    else throw new Error('unknown current-index argument: ' + args[i]);
  }
  assert.ok(Boolean(out) !== Boolean(check), 'use --out <absent-dir> or --check <exact-index-file>');
  const result = await currentIndex(process.cwd(), bindings);
  if (check) assert.deepEqual(await readFile(check), result.bytes, 'retained index does not match current inputs');
  else {
    await mkdir(out, { recursive: false });
    await writeFile(join(out, 'index.json'), result.bytes, { flag: 'wx' });
    const tools = {};
    for (const file of ['lib-current-index-v2.mjs', 'lib-route-closure.mjs', 'generated-lib-v2.mjs', 'lib-refresh-cache-v2.mjs'])
      tools[file] = sha(await readFile(new URL(file, import.meta.url)));
    await writeFile(join(out, 'receipt.json'), JSON.stringify({ schema: 'wasmc.current-lib-search-index-receipt/v1',
      accepted: true, ...result.summary, generator_inputs: tools, source_inputs: result.inputs, binding_receipts: result.receipts,
      claims: { current_registry_discovery: true, generated_bindings_checked: true,
        installation: false, runtime_device_qualified: false, trusted_authority: false } }, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ accepted: true, ...result.summary, out: out ?? check }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
