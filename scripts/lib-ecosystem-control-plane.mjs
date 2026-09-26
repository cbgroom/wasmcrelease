#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputPath = join(root, 'lib-ecosystem-control-plane.json');
const readJson = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sha256File = path => digest(readFileSync(join(root, path)));
const args = new Set(process.argv.slice(2));
assert(args.size === 1 && (args.has('--write') || args.has('--check')), 'usage: lib-ecosystem-control-plane.mjs --write|--check');

const release = readJson('release.json');
const surfaces = readJson('release-surfaces.json');
const installCatalog = readJson('catalog/libs-v009.json');
const currentSideCatalog = existsSync(join(root, 'catalog/libs-v013.json')) ? readJson('catalog/libs-v013.json') : null;
const searchCandidateAdmission = readJson('admission/lib-search-v020-v013-candidate.json');
const compatibility = readJson('compatibility/core-artifacts-v009.json');
const searchCompatibility = readJson('compatibility/lib-search-core.json');
assert.equal(typeof release.staged_product_manifest, 'string', 'release.json must bind a staged product manifest');
const stagedProduct = readJson(release.staged_product_manifest);
assert.equal(stagedProduct.version, release.version, 'staged product version must match release.json');
assert(Array.isArray(stagedProduct.product_files), 'staged product manifest lacks product_files');
const releaseFiles = new Map(stagedProduct.product_files.map(row => [row.path, row]));

const searchRun = spawnSync(process.execPath, ['scripts/wasmc-lib.mjs', 'search', '', '--historical', '--limit', '64'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024
});
assert.equal(searchRun.status, 0, searchRun.stderr);
const search = JSON.parse(searchRun.stdout);
const discoverable = new Set(search.hits.filter(row => !row.signature).map(row => row.identity));
const installable = new Set(installCatalog.packages.map(row => `${row.wit_package}`));
const currentSideInstallable = new Set((currentSideCatalog?.packages ?? []).map(row => `${row.wit_package}`));

const libRoots = readdirSync(join(root, 'libs'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(join(root, 'libs', entry.name, 'lib.json')))
  .map(entry => `libs/${entry.name}`);
const packageRoots = [
  'standard/wasmc-std/1.4.0',
  'standard/wasmc-lib-search/0.1.0',
  ...libRoots
].sort();

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
      authority: isCurrentSideInstallable ? 'catalog/libs-v013.json' : null,
      included_in_immutable_tag: false
    },
    state_evidence: {
      qualification: approved ? `${metadataPath}#admission` : isReleased ? `${release.staged_product_manifest} immutable product inclusion` : null,
      admission: approved ? `${metadataPath}#admission` : isReleased ? `${release.staged_product_manifest} immutable product inclusion` : null,
      release: isReleased ? `release.json -> ${release.staged_product_manifest}` : null,
      discovery: isDiscoverable ? 'standard/wasmc-lib-search/0.1.0 + examples/lib-search/index.lsi' : null,
      installation: isInstallable ? 'catalog/libs-v009.json' : null
    },
    stopping_conditions: stoppingConditions
  };
});

const count = state => packages.filter(row => row.states[state]).length;
const searchCandidateMetadata = readJson('candidates/wasmc-lib-search/0.2.0/lib.json');
assert.equal(sha256File('candidates/wasmc-lib-search/0.2.0/artifact.wasm'), searchCandidateAdmission.artifact.core_sha256);
assert.equal(sha256File('candidates/wasmc-lib-search/0.2.0/component.wasm'), searchCandidateAdmission.artifact.component_sha256);
assert.equal(sha256File(searchCandidateAdmission.index.path), searchCandidateAdmission.index.sha256);
const searchCandidate = {
  identity: searchCandidateMetadata.wit.package,
  root: searchCandidateAdmission.candidate.public_root,
  producer_commit: searchCandidateAdmission.candidate.producer_commit,
  catalog: searchCandidateAdmission.catalog,
  index: searchCandidateAdmission.index,
  artifact: searchCandidateAdmission.artifact,
  toolchain: searchCandidateAdmission.toolchain,
  qualification: searchCandidateAdmission.qualification,
  reproducibility_boundary: searchCandidateAdmission.reproducibility_boundary,
  states: {
    qualified: true,
    admitted: false,
    released: false,
    discoverable: false,
    installable: false
  },
  stopping_conditions: [
    'future-release-admission-required',
    'not-selection-authority',
    'toolchain-scoped-byte-reproducibility'
  ]
};
const model = {
  schema: 'wasmc.lib-ecosystem-control-plane/v1',
  authority: {
    immutable_product: `release.json -> ${release.staged_product_manifest}`,
    capability_projection: 'release-surfaces.json#agent_capability_projection',
    producer_deltas: 'release-surfaces.json#producer_capability_delta',
    discovery_snapshot: 'standard/wasmc-lib-search/0.1.0 + examples/lib-search/index.lsi',
    resolver_install_catalog: 'catalog/libs-v009.json',
    rule: 'Package existence, qualification, admission, release, discovery, installation, engine compatibility and Host authority are independent claims.'
  },
  release: { version: release.version, tag: release.tag, source_commit: release.source_commit, staged_product_manifest: release.staged_product_manifest, product_set_sha256: stagedProduct.product_set_sha256 },
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
  successor_candidates: [searchCandidate],
  ecosystem_stopping_conditions: [
    'Public third-party build, admission and publication are not closed.',
    'The current-side resolver/install catalog covers all released packages and LibSearch 0.2.0 is locally qualified over all thirteen roots, but neither is inside immutable v0.0.13.',
    'Byte-identical Rust-backed Lib reproduction is currently scoped to an exact toolchain environment; producer commit plus Cargo.lock alone did not reproduce the historical artifact hash.',
    'Missing artifact-bound engine profiles must not be replaced by inferred version ranges.',
    'A Component or Host-SDK surface does not imply ordinary WAsmC source binding support.'
  ]
};
const encoded = `${JSON.stringify(model, null, 2)}\n`;

if (args.has('--write')) {
  writeFileSync(outputPath, encoded);
  console.log(JSON.stringify({ accepted:true, action:'write', path:relative(root, outputPath), inventory:model.inventory }));
} else {
  assert(existsSync(outputPath), 'lib-ecosystem-control-plane.json is missing');
  assert.equal(readFileSync(outputPath, 'utf8'), encoded, 'lib ecosystem control plane is stale');
  console.log(JSON.stringify({ accepted:true, action:'check', path:relative(root, outputPath), inventory:model.inventory }));
}
