import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const catalogAuthorities = Object.freeze({
  v009: Object.freeze({release_tag:'v0.0.9',release_commit:'0fec38d59872a7f1527dc94799da542e968f1f8a'}),
  v013: Object.freeze({release_tag:'v0.0.13',release_commit:'b1d22d27bdc9727e607cf77a4af57b151df6832d'}),
});
const fail = code => { throw Object.assign(new Error(code), { code }); };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function safePath(path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\') || path.split('/').some(s => !s || s === '.' || s === '..')) fail('catalog.path_invalid');
  return path;
}
export function packageReader(root = repositoryRoot) {
  const base = realpathSync(root);
  return path => {
    const actual = realpathSync(resolve(base, safePath(path)));
    const rel = relative(base, actual);
    if (rel.startsWith('..') || isAbsolute(rel)) fail('catalog.path_escape');
    return readFileSync(actual);
  };
}
export function parseCatalog(bytes, authority = catalogAuthorities.v009) {
  let catalog;
  try { catalog = JSON.parse(bytes); } catch { fail('catalog.invalid'); }
  if (!authority || catalog?.schema !== 'wasmc.public-lib-catalog/v1' || catalog.release_tag !== authority.release_tag || catalog.release_commit !== authority.release_commit || !Array.isArray(catalog.packages) || !catalog.packages.length || catalog.packages.length > 64) fail('catalog.invalid');
  if (catalog.search_text_profile != null && catalog.search_text_profile !== 'package-intent-v1') fail('catalog.invalid');
  for (const row of catalog.packages) {
    if (typeof row.id !== 'string' || !row.id || !/^\d+\.\d+\.\d+$/.test(row.version) || typeof row.wit_package !== 'string' || !digest(row.wit_sha256) || !digest(row.artifact_sha256) || !Array.isArray(row.files) || !row.files.length || row.files.length > 256 || !Array.isArray(row.keywords) || !row.keywords.every(k => typeof k === 'string') || typeof row.historical !== 'boolean') fail('catalog.invalid');
    safePath(row.root);
    if (row.companion && (row.id !== 'wasmc-std' || row.companion.path !== 'standard/corelib/4.8.0/corelib.wasm' || !digest(row.companion.sha256) || !Number.isSafeInteger(row.companion.bytes) || row.companion.bytes <= 0 || row.companion.bytes > 16777216)) fail('catalog.invalid');
    if (row.id === 'wasmc-std' && !row.companion) fail('catalog.invalid');
    const paths = new Set();
    for (const file of row.files) {
      safePath(file.path);
      if (!file.path.startsWith(row.root + '/') || paths.has(file.path) || !digest(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 16777216) fail('catalog.invalid');
      paths.add(file.path);
    }
    if (!paths.has(row.root + '/lib.json') || !paths.has(row.root + '/lib.wit') || !paths.has(row.root + '/artifact.wasm')) fail('catalog.invalid');
  }
  return catalog;
}
export function searchCatalog(bytes, query = '', includeHistorical = false, authority = catalogAuthorities.v009) {
  const catalog = parseCatalog(bytes, authority);
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return catalog.packages.filter(row => (includeHistorical || !row.historical) && words.every(word => [row.id, row.wit_package, ...row.keywords].join(' ').toLowerCase().includes(word)))
    .sort((a,b) => `${a.id}@${a.version}` < `${b.id}@${b.version}` ? -1 : `${a.id}@${a.version}` > `${b.id}@${b.version}` ? 1 : 0)
    .map(({files, ...row}) => row);
}
export function selectCatalog(bytes, request, authority = catalogAuthorities.v009) {
  if (!request || !digest(request.catalog_sha256) || sha256(bytes) !== request.catalog_sha256) fail('catalog.identity_mismatch');
  if (typeof request.id !== 'string' || typeof request.version !== 'string' || !digest(request.wit_sha256) || !digest(request.artifact_sha256)) fail('resolve.exact_lock_required');
  const catalog = parseCatalog(bytes, authority);
  const matches = catalog.packages.filter(row => row.id === request.id && row.version === request.version);
  if (!matches.length) fail('resolve.not_found');
  if (matches.length !== 1) fail('resolve.ambiguous');
  const row = matches[0];
  if (row.wit_sha256 !== request.wit_sha256 || row.artifact_sha256 !== request.artifact_sha256) fail('resolve.identity_mismatch');
  return {catalog, row};
}
export function resolveCatalog(bytes, request, read = packageReader(), authority = catalogAuthorities.v009) {
  const {catalog, row} = selectCatalog(bytes, request, authority);
  const contents = new Map();
  for (const file of row.files) {
    let data;
    try { data = read(file.path); } catch (error) { if (error.code === 'catalog.path_escape') throw error; fail('package.file_missing'); }
    if (!(data instanceof Uint8Array) || data.byteLength !== file.bytes || sha256(data) !== file.sha256) fail('package.identity_mismatch');
    contents.set(file.path, data);
  }
  let metadata;
  if (row.companion) {
    let data;
    try { data = read(row.companion.path); } catch { fail('package.companion_missing'); }
    if (!(data instanceof Uint8Array) || data.byteLength !== row.companion.bytes || sha256(data) !== row.companion.sha256) fail('package.companion_drift');
  }
  try { metadata = JSON.parse(contents.get(row.root + '/lib.json')); } catch { fail('package.metadata_invalid'); }
  if (metadata.id !== row.id || metadata.version !== row.version || metadata.wit?.package !== row.wit_package || metadata.wit?.path !== 'lib.wit' || metadata.wit?.sha256 !== row.wit_sha256 || metadata.artifact?.path !== 'artifact.wasm' || metadata.artifact?.sha256 !== row.artifact_sha256 || sha256(contents.get(row.root + '/lib.wit')) !== row.wit_sha256 || sha256(contents.get(row.root + '/artifact.wasm')) !== row.artifact_sha256) fail('package.metadata_drift');
  return {schema:'wasmc.public-lib-lock/v1', catalog_sha256:request.catalog_sha256, release_tag:catalog.release_tag, release_commit:catalog.release_commit, id:row.id, version:row.version, wit_package:row.wit_package, wit_sha256:row.wit_sha256, artifact_sha256:row.artifact_sha256, root:row.root, files:row.files, verified:true, authority_granted:false, engine_admission:'separate', companion:row.companion ?? null};
}
