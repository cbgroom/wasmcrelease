import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishedLifecycle } from './release-lifecycle.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = (base, path) => JSON.parse(readFileSync(resolve(base, path), 'utf8'));
const encode = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function buildAgentGuidance(base = root, overrides = {}) {
  const read = path => overrides[path] ?? json(base, path);
  const release = read('release.json'), prod = read('channels/prod.json');
  const candidate = read(release.staged_product_manifest), compiler = read('current/compiler-release.json');
  const surfaces = read('release-surfaces.json'), readiness = read('release-lib-route-readiness.json');
  const catalog = read('catalog/libs-current-v2.json'), policy = read('.agents/agent-route-policy.json');
  const std = catalog.packages.find(row => row.id === 'wasmc-std');
  assert.ok(std && compiler.version === catalog.version && release.version === compiler.version);
  const lifecycle = publishedLifecycle(release, prod, candidate, catalog.version);
  const routes = structuredClone(policy.routes);
  const identity = `wasmc:std@${std.version}`;
  const catalogHash = candidate.current_catalog.sha256;
  assert.equal(sha(readFileSync(resolve(base, 'catalog/libs-current-v2.json'))), catalogHash);
  const facade = compiler.artifacts.find(row => row.path === 'current/wasmc.mjs');
  const provider = compiler.artifacts.find(row => row.path === 'current/lib_core.wasm');
  assert.ok(facade && provider);
  routes['release-orientation'] = {
    product_version: release.tag, entrypoint: 'AGENTS.md',
    compiler: { ...compiler.compiler, imports: compiler.imports },
    facade: { path: facade.path, sha256: facade.sha256 },
    private_source_commit: compiler.source_commit,
    identity_rule: 'The private_source_commit identifies compiler source, not the public Git release commit. The immutable public package identity is the release tag or the pinned public checkout commit.',
    check_command: 'node scripts/agent-release-orientation.mjs --check',
    required_additional_reads: ['agent-release-orientation.json'],
    mutable_not_authority: ['main', 'unversioned URLs', 'package-index.json.latest'],
    final_answer_policy: 'Name AGENTS.md and agent-release-orientation.json. Report the immutable product tag, compiler path and full compiler SHA256 once; do not substitute a field name. Stop after the named check passes.'
  };
  routes['release-lib-route-readiness'] = { ...readiness, authority_file: 'release-lib-route-readiness.json', required_additional_reads: ['release-lib-route-readiness.json'] };
  const scalar = surfaces.agent_capability_projection.type_decisions.u64_ordinary_source;
  assert.ok(scalar.positions.includes('parameter'));
  assert.equal(surfaces.agent_capability_projection.feature_decisions.async_ordinary_source_or_lib, 'unsupported');
  routes['position-aware-capability-negative'].supported_positions = scalar.positions.map(p => 'u64 ' + p);
  const telemetry = surfaces.package_profiles['wasmc-system-telemetry@0.0.1'];
  assert.ok(telemetry.unsupported_surfaces.includes('wasmc-source-direct-resource-methods'));
  routes['release-state-separation'].states = Object.fromEntries(Object.keys(lifecycle).map(key => [key, false]));
  routes['release-state-separation'].related_product = { ...lifecycle, routes: telemetry.supported_surfaces,
    lifecycle_authority: 'release.json and channels/prod.json; only these supported profiles, never direct ordinary Source' };
  const base64 = routes['library-first-selection'];
  Object.assign(base64, { product_release: release.tag, package: identity,
    apis: [`${identity}/base64#try-encode-standard`, `${identity}/base64#try-decode-standard`],
    catalog_path: 'catalog/libs-current-v2.json', catalog_sha256: catalogHash,
    catalog_release_snapshot: release.tag, catalog_snapshot_carried_forward: false,
    artifact_sha256: std.delivery.artifact.sha256, wit_sha256: std.wit_sha256, states: lifecycle,
    search: `node scripts/wasmc-lib.mjs search base64 --catalog-sha256 ${catalogHash} --limit 8`,
    resolve: `node scripts/wasmc-lib.mjs resolve ${std.id} ${std.version} --catalog-sha256 ${catalogHash} --manifest-sha256 ${std.manifest_sha256} --root-inventory-sha256 ${std.root_inventory_sha256}`,
    behavior: 'node examples/base64/run.mjs',
    required_additional_reads: [`${std.root}/SKILL.md`, `${std.root}/lib.wit`] });
  base64.exact_report = { instruction: surfaces.agent_task_routes['released-base64'].exact_report.instruction,
    package: base64.package, apis: base64.apis, catalog_sha256: catalogHash,
    manifest_sha256: std.manifest_sha256, root_inventory_sha256: std.root_inventory_sha256,
    wit_sha256: std.wit_sha256, artifact_sha256: std.delivery.artifact.sha256,
    companion_sha256: provider.sha256, import_module: 'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0',
    library_import_module: 'wasmc:lib/wasmc.std@' + std.version };
  routes['library-discovery'] = { decision: 'Search is discovery, not approval. Inspect selected Root SKILL.md and lib.wit, approve the exact API/profile, resolve with independent catalog, manifest and Root inventory pins, inspect imports, then execute behavior.',
    search_prefix: `node scripts/wasmc-lib.mjs search`, catalog_sha256: catalogHash, search_options: '--catalog-sha256 ' + catalogHash + ' --limit 8',
    selected_std: { package: identity, root: std.root, states: lifecycle, resolve: base64.resolve },
    byte_codec_driver: 'node examples/lib-bytes/run.mjs --codec base64|hex --text TEXT',
    driver_rule: 'Choose the codec matching the selected WIT API. The driver verifies independent catalog/Root pins and exact Provider imports, checks behavior and drops owned resources. It supports only the declared codecs; other APIs require their documented driver.',
    required_additional_reads: [], host_authority: 'Resolution and installation grant no Host authority.' };
  for (const [id, route] of Object.entries(routes)) {
    route.schema = 'wasmc.agent-task-route/v1'; route.id = id;
  }
  const files = Object.fromEntries(Object.entries(routes).map(([id, value]) => [`agent-routes/${id}.json`, encode(value)]));
  const index = { schema: 'wasmc.agent-quickstart/v2', scope: 'Unreleased guidance experiment over unchanged v0.0.21 runtime; not a new product admission.',
    rule: 'Choose one route. Read only its file and required_additional_reads; run named checks, report exact identities, then stop. For an unmatched task follow the relevant general route or public Skill.',
    routes: Object.fromEntries(Object.entries(routes).map(([id]) => [id, { intent: policy.intents[id], path: `agent-routes/${id}.json`, sha256: sha(files[`agent-routes/${id}.json`]) }])) };
  return { index, routes, files };
}

export function loadAgentRoutes(base = root) {
  const index = json(base, 'agent-quickstart.json');
  assert.equal(index.schema, 'wasmc.agent-quickstart/v2');
  const routes = {};
  for (const [id, row] of Object.entries(index.routes)) {
    assert.equal(row.path, `agent-routes/${id}.json`);
    const bytes = readFileSync(resolve(base, row.path));
    assert.equal(sha(bytes), row.sha256, `route digest drift: ${id}`);
    routes[id] = JSON.parse(bytes); assert.equal(routes[id].id, id);
  }
  return { ...index, routes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = process.argv[2]; assert.ok(['--write', '--check'].includes(action));
  const model = buildAgentGuidance();
  const files = { 'agent-quickstart.json': encode(model.index), ...model.files };
  for (const [path, value] of Object.entries(files)) {
    if (action === '--write') { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), value); }
    else assert.equal(readFileSync(resolve(root, path), 'utf8'), value, `stale generated guidance: ${path}`);
  }
  console.log(JSON.stringify({ accepted: true, action, routes: Object.keys(model.routes).length, index_bytes: Buffer.byteLength(files['agent-quickstart.json']) }));
}
