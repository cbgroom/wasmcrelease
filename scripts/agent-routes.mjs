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
  routes['source-adaptation'].function_shape = surfaces.agent_capability_projection.function_shape;
  delete routes['source-adaptation'].function_shape.canonical_example;
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
    provenance_reference: 'current/compiler-release.json; inspect separately only when compiler-source provenance is requested',
    identity_rule: 'Compiler-source provenance is distinct from public release identity. The immutable public package identity is the release tag or the pinned public checkout commit.',
    check_command: 'node scripts/agent-release-orientation.mjs --check',
    required_additional_reads: ['agent-release-orientation.json'],
    mutable_not_authority: ['main', 'unversioned URLs', 'package-index.json.latest'],
    required_report: { product: release.tag, public_agent_entrypoint: 'AGENTS.md', compact_authority: 'agent-release-orientation.json', compiler_path: compiler.compiler.path, compiler_sha256: compiler.compiler.sha256 },
    final_answer_policy: 'After the named check passes, copy its report_text unchanged once as the complete final answer. It includes every required_report value, including AGENTS.md and agent-release-orientation.json. Do not append a summary or explanatory identities, digests, source commits or abbreviations; stop.'
  };
  routes['release-lib-route-readiness'] = { ...readiness, authority_file: 'release-lib-route-readiness.json', required_additional_reads: ['release-lib-route-readiness.json'] };
  const scalar = surfaces.agent_capability_projection.type_decisions.u64_ordinary_source;
  assert.ok(scalar.positions.includes('parameter'));
  assert.equal(surfaces.agent_capability_projection.feature_decisions.async_ordinary_source_or_lib, 'unsupported');
  routes['position-aware-capability-negative'].supported_positions = scalar.positions.map(p => 'u64 ' + p);
  routes['position-aware-capability-negative'].position_projection = {
    source_u64: scalar,
    public_map: surfaces.agent_capability_projection.type_decisions.map,
    async: surfaces.agent_capability_projection.feature_decisions.async_ordinary_source_or_lib,
    host: surfaces.agent_capability_projection.type_decisions.host_import,
    authority_rule: 'Imports request effects; explicit application approval and an exact module/name/kind/signature allowlist are still required. A supported scalar is not an authority grant.'
  };
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
    lifecycle_check: 'node scripts/agent-routes.mjs --lifecycle',
    search: `node scripts/wasmc-lib.mjs search base64 --catalog-sha256 ${catalogHash} --limit 8`,
    resolve: `node scripts/wasmc-lib.mjs resolve ${std.id} ${std.version} --catalog-sha256 ${catalogHash} --manifest-sha256 ${std.manifest_sha256} --root-inventory-sha256 ${std.root_inventory_sha256}`,
    behavior: 'node examples/base64/run.mjs',
    verify: 'node scripts/agent-library-check.mjs --codec base64 --text abc',
    required_additional_reads: [`${std.root}/SKILL.md`, `${std.root}/lib.wit`] });
  base64.exact_report = { instruction: surfaces.agent_task_routes['released-base64'].exact_report.instruction,
    package: base64.package, apis: base64.apis, catalog_sha256: catalogHash,
    manifest_sha256: std.manifest_sha256, root_inventory_sha256: std.root_inventory_sha256,
    wit_sha256: std.wit_sha256, artifact_sha256: std.delivery.artifact.sha256,
    companion_sha256: provider.sha256, import_module: 'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0',
    library_import_module: 'wasmc:lib/wasmc.std@' + std.version };
  routes['library-discovery'] = { decision: 'Search is discovery, not approval. Inspect the selected Root Skill and WIT files, approve the exact API/profile, run lifecycle_check and stop unless published, then resolve with independent catalog, manifest and Root inventory pins, inspect imports and execute behavior.',
    search_prefix: `node scripts/wasmc-lib.mjs search`, catalog_sha256: catalogHash, search_options: '--catalog-sha256 ' + catalogHash + ' --limit 8',
    search_command_pattern: `node scripts/wasmc-lib.mjs search QUERY --catalog-sha256 ${catalogHash} --limit 8`,
    search_rule: 'Replace QUERY with the requested capability. The interface above is complete; no help probe or catalog listing is needed.',
    selected_std: { package: identity, root: std.root, states: lifecycle, resolve: base64.resolve,
      public_files: { skill: `${std.root}/SKILL.md`, wit: `${std.root}/lib.wit` } },
    selection_read_rule: 'After a matching hit, read the exact Skill and WIT file paths for its package Root. For Std use selected_std.public_files. WIT interface and API identities are logical names inside lib.wit, not directories under the Root; never append an interface name to a package path. The selected Root is the approval scope, not every catalog entry.',
    lifecycle_check: 'node scripts/agent-routes.mjs --lifecycle',
    byte_codec_driver: 'node examples/lib-bytes/run.mjs --codec CODEC --text TEXT',
    byte_codec_choices: ['base64', 'hex'],
    verify_command_pattern: 'node scripts/agent-library-check.mjs --codec CODEC --text TEXT',
    verify_rule: 'After reading and approving the selected Root and WIT APIs, run this combined check. It performs actual search, lifecycle, pinned resolution and behavior. Copy its canonical report_text and actual behavior; catalog display identities are not WIT package identities. The declared command is complete; do not add exploratory reads or duplicate checks.',
    driver_rule: 'Choose the codec matching the selected WIT API. The driver verifies independent catalog/Root pins and exact Provider imports, checks behavior and drops owned resources. It supports only the declared codecs; other APIs require their documented driver.',
    final_answer_policy: 'Report exact package and selected WIT API identities, actual behavior and verification field names. Digest values need not be repeated in prose. If a requested digest is reported, copy its full value once. Never abbreviate any identity or digest. After the named checks pass, stop; the driver interface above is complete.',
    required_additional_reads: [], host_authority: 'Resolution and installation grant no Host authority.' };
  for (const [id, route] of Object.entries(routes)) {
    route.named_checks = id === 'source-adaptation' ? [route.runner, route.digest_rejection_probe]
      : id === 'library-discovery' ? [route.verify_command_pattern]
      : route.verify ? [route.verify] : route.check_command ? [route.check_command] : route.run ? [route.run] : [];
    route.check_rule = 'read_command already completed route integrity verification. Run only the applicable named_checks for the request. An empty named_checks list means this is a decision route: answer and stop. Do not invent flags or extra check commands; do not repeat a completed check.';
    route.schema = 'wasmc.agent-task-route/v1'; route.id = id;
  }
  const files = Object.fromEntries(Object.entries(routes).map(([id, value]) => [`agent-routes/${id}.json`, encode(value)]));
  const index = { schema: 'wasmc.agent-quickstart/v2', scope: 'Unreleased guidance experiment over unchanged v0.0.21 runtime; not a new product admission.',
    rule: 'Choose one route. Run its read_command to read and verify that selected file, then its required_additional_reads and named checks. Report requested identities exactly and stop. For an unmatched task follow the relevant general route or public Skill.',
    routes: Object.fromEntries(Object.entries(routes).map(([id]) => [id, { intent: policy.intents[id], path: `agent-routes/${id}.json`, read_command: `node scripts/agent-routes.mjs --show ${id}` }])) };
  files['agent-routes/integrity.json'] = encode({ schema: 'wasmc.agent-route-integrity/v1',
    lifecycle_candidate: { path: release.staged_product_manifest, sha256: sha(readFileSync(resolve(base, release.staged_product_manifest))) },
    routes: Object.fromEntries(Object.entries(routes).map(([id]) => [id, sha(files[`agent-routes/${id}.json`])])) });
  return { index, routes, files };
}

export function loadAgentRoute(id, base = root) {
  assert.match(id, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
  const index = json(base, 'agent-quickstart.json');
  assert.equal(index.schema, 'wasmc.agent-quickstart/v2');
  const row = index.routes[id]; assert.ok(row, `unknown route: ${id}`);
  assert.equal(row.path, `agent-routes/${id}.json`);
  const integrity = json(base, 'agent-routes/integrity.json');
  assert.equal(integrity.schema, 'wasmc.agent-route-integrity/v1');
  const bytes = readFileSync(resolve(base, row.path));
  assert.equal(sha(bytes), integrity.routes[id], `route digest drift: ${id}`);
  const route = JSON.parse(bytes); assert.equal(route.id, id);
  return route;
}

export function readPublishedLifecycle(base = root) {
  const release = json(base, 'release.json'), prod = json(base, 'channels/prod.json');
  const pin = json(base, 'agent-routes/integrity.json').lifecycle_candidate;
  assert.match(release.staged_product_manifest, /^channels\/candidates\/[0-9.]+\.json$/);
  assert.equal(release.staged_product_manifest, pin.path);
  assert.equal(sha(readFileSync(resolve(base, pin.path))), pin.sha256, 'lifecycle candidate digest drift');
  const candidate = json(base, release.staged_product_manifest);
  return { product_version: release.tag, stage: prod.stage, states: publishedLifecycle(release, prod, candidate, release.version),
    checked_authorities: ['release.json', 'channels/prod.json', release.staged_product_manifest] };
}

export function loadAgentRoutes(base = root) {
  const index = json(base, 'agent-quickstart.json');
  assert.equal(index.schema, 'wasmc.agent-quickstart/v2');
  const routes = {};
  for (const id of Object.keys(index.routes)) routes[id] = loadAgentRoute(id, base);
  return { ...index, routes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = process.argv[2]; assert.ok(['--write', '--check', '--show', '--lifecycle'].includes(action));
  if (action === '--show') {
    console.log(encode({ ...loadAgentRoute(process.argv[3]), route_digest_verified: true }));
  } else if (action === '--lifecycle') {
    const result = readPublishedLifecycle(); console.log(encode(result));
    if (!result.states.installable) process.exitCode = 1;
  } else {
  const model = buildAgentGuidance();
  const files = { 'agent-quickstart.json': encode(model.index), ...model.files };
  for (const [path, value] of Object.entries(files)) {
    if (action === '--write') { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), value); }
    else assert.equal(readFileSync(resolve(root, path), 'utf8'), value, `stale generated guidance: ${path}`);
  }
  console.log(JSON.stringify({ accepted: true, action, routes: Object.keys(model.routes).length, index_bytes: Buffer.byteLength(files['agent-quickstart.json']) }));
  }
}
