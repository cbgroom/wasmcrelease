#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildClosure } from './lib-route-closure.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputPath = join(root, 'lib-ecosystem-control-plane.json');
const readinessOutputPath = join(root, 'release-lib-route-readiness.json');
const readJson = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sha256File = path => digest(readFileSync(join(root, path)));
const args = new Set(process.argv.slice(2));
assert(args.size === 1 && (args.has('--write') || args.has('--check')), 'usage: lib-ecosystem-control-plane.mjs --write|--check');

const release = readJson('release.json');
const routeCompleteRelease = ['0.0.14', '0.0.15', '0.0.16'].includes(release.version);
const surfaces = readJson('release-surfaces.json');
const productionCatalogPath = routeCompleteRelease ? 'catalog/libs-v014.json' : 'catalog/libs-v009.json';
const currentSideCatalogPath = routeCompleteRelease ? 'catalog/libs-v014.json' : 'catalog/libs-v013.json';
const installCatalog = readJson(productionCatalogPath);
const currentSideCatalog = existsSync(join(root, currentSideCatalogPath)) ? readJson(currentSideCatalogPath) : null;
const searchCandidateAdmission = readJson('admission/lib-search-v020-v014-admission.json');
const compatibility = readJson('compatibility/core-artifacts-v009.json');
const searchCompatibility = readJson('compatibility/lib-search-core.json');
const retainedRouteClosure = readJson('catalog/lib-route-closure.json');
const futureProduct = readJson(retainedRouteClosure.release.staged_product_manifest);
assert.deepEqual(retainedRouteClosure, buildClosure(retainedRouteClosure.authority_receipt.path,{release:retainedRouteClosure.release,stagedProduct:futureProduct}), 'Lib route closure is stale');
assert.equal(typeof release.staged_product_manifest, 'string', 'release.json must bind a staged product manifest');
const stagedProduct = readJson(release.staged_product_manifest);
assert.equal(stagedProduct.version, release.version, 'staged product version must match release.json');
assert(Array.isArray(stagedProduct.product_files), 'staged product manifest lacks product_files');
const releaseFiles = new Map(stagedProduct.product_files.map(row => [row.path, row]));

const searchPage = offset => {
  const run = spawnSync(process.execPath, ['scripts/wasmc-lib.mjs', 'search', '', '--historical', '--offset', String(offset), '--limit', '64'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
};
const searchPages = routeCompleteRelease ? [searchPage(0), searchPage(64)] : [searchPage(0)];
const search = {...searchPages[0],hits:searchPages.flatMap(page=>page.hits)};
const discoverable = new Set(search.hits.filter(row => !row.signature).map(row => row.identity));
const installable = new Set(installCatalog.packages.map(row => `${row.wit_package}`));
const currentSideInstallable = new Set((currentSideCatalog?.packages ?? []).map(row => `${row.wit_package}`));

const packageRoots = stagedProduct.product_files
  .map(row => row.path)
  .filter(path => /^(?:libs\/[^/]+|standard\/[^/]+\/[^/]+)\/lib\.json$/.test(path))
  .map(path => path.slice(0, -9))
  .sort();

function actualImports(path) {
  const module = new WebAssembly.Module(readFileSync(join(root, path)));
  return WebAssembly.Module.imports(module).map(row => ({ module: row.module, name: row.name, kind: row.kind }));
}

function engineProfile(metadata, artifactPath) {
  const exact = compatibility.artifacts.find(row => row.sha256 === metadata.artifact.sha256);
  if (exact) return {
    authority: 'compatibility/core-artifacts-v009.json',
    validation_profile: exact.validation_profile,
    additional_required_gates: exact.additional_required_gates,
    minimum_version_claimed: false
  };
  if (searchCompatibility.sha256 === metadata.artifact.sha256) return {
    authority: 'compatibility/lib-search-core.json',
    validation_profile: 'complete-module-with-function-references-and-tail-call-disabled',
    tested_local_engines: searchCompatibility.tested_local_engines,
    minimum_version_claimed: false
  };
  return {
    authority: metadata.qualification?.wasmi ?? null,
    validation_profile: metadata.qualification?.wasmi ? 'package-qualification-defined' : 'not-machine-declared',
    tested_local_engines: [],
    minimum_version_claimed: false,
    stop: metadata.qualification?.wasmi ? null : 'No artifact-bound engine profile is declared; do not infer compatibility from another package.'
  };
}

const packages = packageRoots.map(packageRoot => {
  const metadataPath = `${packageRoot}/lib.json`;
  const metadata = readJson(metadataPath);
  const identity = metadata.wit.package;
  const requiredReleaseFiles = [metadataPath, `${packageRoot}/${metadata.wit.path}`, `${packageRoot}/${metadata.artifact.path}`];
  if (metadata.component?.path) requiredReleaseFiles.push(`${packageRoot}/${metadata.component.path}`);
  const isReleased = requiredReleaseFiles.every(path => {
    const row = releaseFiles.get(path);
    if (!row) return false;
    const bytes = readFileSync(join(root, path));
    return bytes.length === row.bytes && digest(bytes) === row.sha256;
  });
  const isDiscoverable = discoverable.has(identity);
  const isInstallable = installable.has(identity);
  const isCurrentSideInstallable = currentSideInstallable.has(identity);
  const imports = actualImports(`${packageRoot}/${metadata.artifact.path}`);
  const approved = metadata.admission?.approved === true;
  const states = {
    qualified: approved || isReleased,
    admitted: approved || isReleased,
    released: isReleased,
    discoverable: isDiscoverable,
    installable: isInstallable
  };
  const stoppingConditions = [];
  if (!states.released) stoppingConditions.push('not-present-in-current-immutable-release');
  if (!states.discoverable) stoppingConditions.push('absent-from-pinned-search-snapshot');
  if (!states.installable) stoppingConditions.push('absent-from-pinned-resolver-install-catalog');
  const profile = surfaces.package_profiles?.[identity] ?? null;
  return {
    id: metadata.id,
    version: metadata.version,
    identity,
    root: packageRoot,
    metadata: { path: metadataPath, sha256: sha256File(metadataPath), schema: metadata.schema },
    wit: metadata.wit,
    artifact: metadata.artifact,
    component: metadata.component ?? null,
    core_imports: imports,
    host_authorities: metadata.qualification?.host_authorities ?? [],
    canonical_resource_intrinsics: metadata.qualification?.canonical_resource_intrinsics ?? [],
    engine_profile: engineProfile(metadata, `${packageRoot}/${metadata.artifact.path}`),
    supported_surfaces: profile?.supported_surfaces ?? metadata.qualification?.supported_surfaces ?? null,
    unsupported_surfaces: profile?.unsupported_surfaces ?? metadata.qualification?.unsupported_surfaces ?? null,
    states,
    current_side_remediation: {
      resolvable_installable: isCurrentSideInstallable,
      authority: isCurrentSideInstallable ? currentSideCatalogPath : null,
      included_in_immutable_tag: routeCompleteRelease && isReleased
    },
    state_evidence: {
      qualification: approved ? `${metadataPath}#admission` : isReleased ? `${release.staged_product_manifest} immutable product inclusion` : null,
      admission: approved ? `${metadataPath}#admission` : isReleased ? `${release.staged_product_manifest} immutable product inclusion` : null,
      release: isReleased ? `release.json -> ${release.staged_product_manifest}` : null,
      discovery: isDiscoverable ? (routeCompleteRelease ? 'standard/wasmc-lib-search/0.2.0 + examples/lib-search/index-v014-v020.lsi' : 'standard/wasmc-lib-search/0.1.0 + examples/lib-search/index.lsi') : null,
      installation: isInstallable ? productionCatalogPath : null
    },
    stopping_conditions: stoppingConditions
  };
});

const count = state => packages.filter(row => row.states[state]).length;
const searchCandidateMetadata = readJson('standard/wasmc-lib-search/0.2.0/lib.json');
const searchCandidateCatalog = readJson(searchCandidateAdmission.catalog.path);
assert.equal(searchCandidateAdmission.catalog.role, 'future-product-catalog');
assert.equal(searchCandidateAdmission.catalog.contains_candidate, true);
assert.equal(searchCandidateAdmission.catalog.candidate_install_authority, true);
assert.equal(searchCandidateAdmission.catalog.public_default_install_authority, false);
assert.equal(searchCandidateCatalog.packages.some(row => row.wit_package === searchCandidateMetadata.wit.package), true);
assert.equal(sha256File('standard/wasmc-lib-search/0.2.0/artifact.wasm'), searchCandidateAdmission.artifact.core_sha256);
assert.equal(sha256File('standard/wasmc-lib-search/0.2.0/component.wasm'), searchCandidateAdmission.artifact.component_sha256);
assert.equal(sha256File('standard/wasmc-lib-search/0.2.0/lib.json'), searchCandidateAdmission.artifact.manifest_sha256);
assert.equal(sha256File(searchCandidateAdmission.index.path), searchCandidateAdmission.index.sha256);
assert.deepEqual(searchCandidateMetadata.build.toolchain, Object.fromEntries(Object.entries(searchCandidateAdmission.toolchain).filter(([key]) => !['generated_wasmtime_binding','wasmtime_cli','wasmi_crate'].includes(key))));
const searchCandidate = {
  identity: searchCandidateMetadata.wit.package,
  root: searchCandidateAdmission.candidate.public_root,
  producer_commit: searchCandidateAdmission.candidate.producer_commit,
  build_tool_commit: searchCandidateAdmission.candidate.build_tool_commit,
  catalog: searchCandidateAdmission.catalog,
  index: searchCandidateAdmission.index,
  artifact: searchCandidateAdmission.artifact,
  toolchain: searchCandidateAdmission.toolchain,
  qualification: searchCandidateAdmission.qualification,
  reproducibility_boundary: searchCandidateAdmission.reproducibility_boundary,
  states: searchCandidateAdmission.states,
  stopping_conditions: [
    'exact-dev-stage-qualification-required',
    'not-public-default-selection-authority',
    'candidate-install-authority-is-not-release-authority',
    'toolchain-scoped-byte-reproducibility'
  ]
};
const model = {
  schema: 'wasmc.lib-ecosystem-control-plane/v1',
  authority: {
    immutable_product: `release.json -> ${release.staged_product_manifest}`,
    capability_projection: 'release-surfaces.json#agent_capability_projection',
    producer_deltas: 'release-surfaces.json#producer_capability_delta',
    discovery_snapshot: routeCompleteRelease ? 'standard/wasmc-lib-search/0.2.0 + examples/lib-search/index-v014-v020.lsi' : 'standard/wasmc-lib-search/0.1.0 + examples/lib-search/index.lsi',
    resolver_install_catalog: productionCatalogPath,
    rule: 'Package existence, qualification, admission, release, discovery, installation, engine compatibility and Host authority are independent claims.'
  },
  release: { version: release.version, tag: release.tag, source_commit: release.source_commit, staged_product_manifest: release.staged_product_manifest, product_set_sha256: stagedProduct.product_set_sha256 },
  route_closure: {
    authority: 'catalog/lib-route-closure.json',
    release_packages: retainedRouteClosure.release_bindings.length,
    package_routes: retainedRouteClosure.search_index.package_routes,
    api_routes: retainedRouteClosure.search_index.api_routes,
    candidate_extras: retainedRouteClosure.candidate_extras.length,
    release_catalog_exact: retainedRouteClosure.claims.release_catalog_exact,
    release_package_routes_exact: retainedRouteClosure.claims.release_package_routes_exact,
    release_api_routes_exact: retainedRouteClosure.claims.release_api_routes_exact,
    formal_release_ready: retainedRouteClosure.claims.formal_release_ready,
    blocking_conditions: retainedRouteClosure.blocking_conditions
  },
  inventory: {
    packages: packages.length,
    qualified: count('qualified'),
    admitted: count('admitted'),
    released: count('released'),
    discoverable: count('discoverable'),
    installable: count('installable'),
    search_entries: search.snapshot.entry_count,
    search_index_sha256: search.snapshot.index_sha256,
    install_catalog_release: installCatalog.release_tag,
    install_catalog_packages: installCatalog.packages.length,
    current_side_install_catalog: currentSideCatalog?.release_tag ?? null,
    current_side_installable: currentSideInstallable.size,
    current_side_inventory_matches_release: currentSideInstallable.size === count('released'),
    inventory_is_unified: count('released') === count('discoverable') && count('discoverable') === count('installable')
  },
  type_position_authority: surfaces.agent_capability_projection,
  producer_deltas: [surfaces.producer_capability_delta],
  packages,
  successor_candidates: routeCompleteRelease ? [] : [searchCandidate],
  ecosystem_stopping_conditions: [
    'Public third-party build, admission and publication are not closed.',
    ...(routeCompleteRelease ? [] : ['The v0.0.14 future-product catalog admits LibSearch 0.2.0 and closes all fourteen package routes, but neither the candidate nor its catalog is released or the public default.']),
    'Byte-identical Rust-backed Lib reproduction is currently scoped to an exact toolchain environment; producer commit plus Cargo.lock alone did not reproduce the historical artifact hash.',
    'Missing artifact-bound engine profiles must not be replaced by inferred version ranges.',
    'A Component or Host-SDK surface does not imply ordinary WAsmC source binding support.'
  ]
};
const encoded = `${JSON.stringify(model, null, 2)}\n`;
const readinessModel = {
  schema:'wasmc.release-lib-route-readiness/v1',
  route:'release-lib-route-readiness',
  request:`does this v${release.version} product set bind every included Lib package and API route, and where is its lifecycle stage decided`,
  product:{version:release.version,package_routes:retainedRouteClosure.search_index.package_routes,api_routes:retainedRouteClosure.search_index.api_routes,candidate_extras:retainedRouteClosure.candidate_extras.length,formal_release_ready:retainedRouteClosure.claims.formal_release_ready,blocking_conditions:retainedRouteClosure.blocking_conditions},
  active_search:{identity:searchCandidate.identity,states:{qualified:true,admitted:true,included_in_product:true,qualified_before_freeze:true,admitted_before_freeze:true},api_routes:retainedRouteClosure.release_bindings.find(row=>row.identity===searchCandidate.identity)?.api_routes??0},
  lifecycle_authority:{current_release:'release.json',stages:'channels/dev.json, channels/main.json, channels/prod.json',rule:'Never infer released, discoverable or installable from this frozen product projection.'},
  valid_resolution_count:1,
  only_valid_closure:`Verify the exact v${release.version} candidate and route closure, then read the channel authorities for lifecycle state. Every promotion must preserve the same product digest set.`,
  forbidden_shortcuts:['treat admission as release','infer lifecycle state from product presence or an admission snapshot','rebuild product bytes during promotion','rewrite any immutable release or prerelease tag'],
  authorities:['admission/lib-search-v020-v014-admission.json','catalog/lib-route-closure.json',release.staged_product_manifest,'release.json','channels/prod.json'],
  check_commands:['node scripts/lib-route-closure.mjs --check',`node scripts/release-candidate.mjs verify ${release.staged_product_manifest}`],
  stop:'This record is sufficient for the matching readiness decision. Do not scan manifests, histories or implementation scripts unless one of its check commands fails.'
};
const readinessEncoded = `${JSON.stringify(readinessModel, null, 2)}\n`;

if (args.has('--write')) {
  writeFileSync(outputPath, encoded);
  writeFileSync(readinessOutputPath, readinessEncoded);
  console.log(JSON.stringify({ accepted:true, action:'write', path:relative(root, outputPath), inventory:model.inventory }));
} else {
  assert(existsSync(outputPath), 'lib-ecosystem-control-plane.json is missing');
  assert.equal(readFileSync(outputPath, 'utf8'), encoded, 'lib ecosystem control plane is stale');
  assert(existsSync(readinessOutputPath), 'release-lib-route-readiness.json is missing');
  assert.equal(readFileSync(readinessOutputPath, 'utf8'), readinessEncoded, 'release Lib route readiness record is stale');
  console.log(JSON.stringify({ accepted:true, action:'check', path:relative(root, outputPath), inventory:model.inventory }));
}
