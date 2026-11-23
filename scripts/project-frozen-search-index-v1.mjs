import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha } from './lib-refresh-cache-v2.mjs';
import { currentProductPaths, currentProductReader, verifyCurrentRelease, verifyCurrentReleaseV4 } from './current-lib-release-v3.mjs';
import { CurrentSearchCaller, currentIndexEntries } from './current-lib-search-v3.mjs';

// Preserve the exact prior delivery identity only when the package's entire
// source-facing index record agrees with the new Q0 record. Neither input is
// changed and a historical delivery never becomes a new Q0 output.
export function projectFrozenIndex(oldCatalog, oldIndex, candidateCatalog, candidateIndex) {
  const index = structuredClone(candidateIndex), reused = [];
  const byId = rows => { const m = new Map(); for (const r of rows) {
    assert.ok(!m.has(r.id ?? r.package_id), 'duplicate package'); m.set(r.id ?? r.package_id, r);
  } return m; };
  const oldRows = byId(oldCatalog.packages), oldPackages = byId(oldIndex.packages), fresh = byId(index.packages);
  assert.equal(candidateCatalog.packages.length, fresh.size);
  for (const row of candidateCatalog.packages) {
    const old = oldRows.get(row.id), p = fresh.get(row.id);
    assert.ok(p); assert.equal(p.version, row.version); assert.equal(p.delivery.manifest_sha256, row.manifest_sha256);
    if (!old || old.version !== row.version || (old.manifest_sha256 === row.manifest_sha256 && old.root_inventory_sha256 === row.root_inventory_sha256)) continue;
    assert.deepEqual(old.source, row.source, `${row.id}: source identity`);
    assert.equal(old.wit_sha256, row.wit_sha256, `${row.id}: delivered WIT identity`);
    const previous = oldPackages.get(row.id); assert.ok(previous);
    assert.equal(previous.delivery.manifest_sha256, old.manifest_sha256);
    assert.deepEqual({ ...previous, delivery: null }, { ...p, delivery: null }, `${row.id}: source/API index identity`);
    p.delivery = structuredClone(previous.delivery);
    reused.push({ id: row.id, version: row.version, manifest_sha256: old.manifest_sha256,
      root_inventory_sha256: old.root_inventory_sha256, receipt_sha256: previous.delivery.receipt_sha256 });
  }
  return { index, reused };
}

export async function buildFrozenIndex({ oldRoot, oldSha, candidateRoot, candidateSha, out }) {
  for (const p of [oldRoot, candidateRoot, out]) assert.ok(isAbsolute(p));
  for (const pin of [oldSha, candidateSha]) assert.match(pin, /^[0-9a-f]{64}$/);
  const oldRead = currentProductReader(oldRoot), candidateRead = currentProductReader(candidateRoot);
  const oldBytes = oldRead('catalog/libs-current-v2.json'), candidateBytes = candidateRead('catalog/libs-current-v2.json');
  assert.equal(sha(oldBytes), oldSha); assert.equal(sha(candidateBytes), candidateSha);
  const oldClosure = verifyCurrentRelease(oldBytes, oldSha, oldRead, currentProductPaths(oldRoot));
  const candidateClosure = verifyCurrentReleaseV4(candidateBytes, candidateSha, candidateRead, currentProductPaths(candidateRoot));
  const old = JSON.parse(oldBytes), candidate = JSON.parse(candidateBytes);
  const readIndex = (catalog, read) => { const b = read(catalog.index.path); assert.equal(sha(b), catalog.index.sha256); return JSON.parse(b); };
  const result = projectFrozenIndex(old, readIndex(old, oldRead), candidate, readIndex(candidate, candidateRead));
  const bytes = Buffer.from(JSON.stringify(result.index) + '\n');
  const search = candidate.packages.find(r => r.id === 'wasmc-lib-search'); assert.ok(search);
  const searchRoot = result.reused.some(r => r.id === search.id) ? oldRead : candidateRead;
  const caller = new CurrentSearchCaller(bytes, searchRoot(search.root + '/artifact.wasm'), searchRoot(search.root + '/core-abi.json'));
  const entries = currentIndexEntries(result.index), ids = result.index.packages.length;
  assert.deepEqual(caller.snapshot(), { tag:'ok', value:{ entry_count:entries.length, package_count:ids,
    api_count:entries.length-ids, bound_package_count:ids, registry_sha256:result.index.registry_sha256, index_sha256:sha(bytes) } });
  for (const entry of entries) assert.deepEqual(caller.lookup(entry.identity), { tag:'ok', value:entry });
  const pages=[]; for(let offset=0;offset<entries.length;offset+=64) {
    const page=caller.search({text:'',package_id:null,profile:null,bound_only:false},offset,64);
    assert.equal(page.tag,'ok'); pages.push(...page.value);
  }
  assert.deepEqual(pages,entries);
  await mkdir(out); await writeFile(join(out,'index.json'),bytes,{flag:'wx'});
  const receipt={schema:'wasmc.frozen-search-projection/v1',old_catalog_sha256:oldSha,candidate_catalog_sha256:candidateSha,
    index_sha256:sha(bytes),reused:result.reused,packages:ids,entries:entries.length,
    source_products_verified:true,actual_search_snapshot_lookup_pagination:true,public_admission:false,
    old_closure_schema:oldClosure.schema,candidate_closure_schema:candidateClosure.schema};
  await writeFile(join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'}); return receipt;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [oldRoot,oldSha,candidateRoot,candidateSha,out]=process.argv.slice(2);
  buildFrozenIndex({oldRoot,oldSha,candidateRoot,candidateSha,out}).then(r=>console.log(JSON.stringify(r)))
    .catch(e=>{console.error(e);process.exitCode=1;});
}
