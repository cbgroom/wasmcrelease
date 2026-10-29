import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentIndex } from './lib-current-index-v2.mjs';
import { currentProductPaths, currentProductReader } from './current-lib-release-v3.mjs';
import { verifyMixedFromCatalog } from './mixed-current-product-v1.mjs';
import { CurrentSearchCaller, currentIndexEntries } from './current-lib-search-v3.mjs';
import { sha } from './lib-refresh-cache-v2.mjs';

// Keep existing delivery identities; the new receipt binds only the changed root.
// This projection is discovery evidence, not authorization for a combined release.
export function projectResidentIndex(old, fresh, newReceipt) {
  assert.equal(old.schema, 'wasmc.current-lib-search-index/v2');
  assert.equal(fresh.schema, old.schema);
  assert.equal(old.registry_sha256, fresh.registry_sha256);
  const map = rows => { const m = new Map(); for (const p of rows) {
    assert.ok(!m.has(p.package_id), 'duplicate package'); m.set(p.package_id, p);
  } return m; };
  const previous = map(old.packages), next = map(fresh.packages);
  assert.equal(previous.size, next.size);
  const index = structuredClone(fresh); let reused = 0, changed = 0;
  for (const p of index.packages) {
    const prior = previous.get(p.package_id); assert.ok(prior, 'new package');
    if (p.package_id === 'mcpgit-resident-memory') {
      assert.equal(prior.version, '0.2.0'); assert.equal(p.version, '0.2.1');
      assert.ok(prior.delivery && p.delivery); assert.equal(p.delivery.receipt_sha256, newReceipt);
      assert.deepEqual(prior.apis, p.apis, 'resident API changed'); changed++; continue;
    }
    assert.equal(p.delivery, null, 'unexpected fresh binding'); assert.ok(prior.delivery, 'old delivery missing');
    assert.deepEqual({ ...prior, delivery:null }, { ...p, delivery:null }, p.package_id + ': index source drift');
    p.delivery = structuredClone(prior.delivery); reused++;
  }
  assert.equal(changed, 1); return { index, reused };
}

export async function projectResidentSearch({oldRoot, oldSha, source, run, receiptSha, witPath, witSha, out}) {
  for (const p of [oldRoot, source, run, witPath, out]) assert.ok(isAbsolute(p));
  for (const p of [oldSha, receiptSha, witSha]) assert.match(p, /^[0-9a-f]{64}$/);
  const read=currentProductReader(oldRoot), catalogBytes=read('catalog/libs-current-v2.json');
  const closure=verifyMixedFromCatalog(catalogBytes,oldSha,read,currentProductPaths(oldRoot));
  const catalog=JSON.parse(catalogBytes), oldBytes=read(catalog.index.path);
  assert.equal(sha(oldBytes),catalog.index.sha256);
  const old=JSON.parse(oldBytes), fresh=await currentIndex(source,[{run_root:run,receipt_sha256:receiptSha}],{path:witPath,sha256:witSha});
  const projected=projectResidentIndex(old,fresh.index,receiptSha);
  const bytes=Buffer.from(JSON.stringify(projected.index)+'\n'), entries=currentIndexEntries(projected.index);
  const search=catalog.packages.find(p=>p.id==='wasmc-lib-search'); assert.ok(search);
  const caller=new CurrentSearchCaller(bytes,read(search.root+'/artifact.wasm'),read(search.root+'/core-abi.json'));
  assert.deepEqual(caller.snapshot(),{tag:'ok',value:{entry_count:entries.length,package_count:projected.index.packages.length,
    api_count:entries.length-projected.index.packages.length,bound_package_count:projected.index.packages.length,
    registry_sha256:projected.index.registry_sha256,index_sha256:sha(bytes)}});
  for(const entry of entries) assert.deepEqual(caller.lookup(entry.identity),{tag:'ok',value:entry});
  const pages=[];for(let i=0;i<entries.length;i+=64){const p=caller.search({text:'',package_id:null,profile:null,bound_only:false},i,64);assert.equal(p.tag,'ok');pages.push(...p.value);}
  assert.deepEqual(pages,entries); assert.deepEqual(caller.lookup('mcpgit-resident-memory@0.2.0'),{tag:'ok',value:null});
  const receipt={schema:'wasmc.resident-search-projection/v1',accepted:true,old_catalog_sha256:oldSha,
    old_index_sha256:catalog.index.sha256,new_receipt_sha256:receiptSha,index_sha256:sha(bytes),
    packages:projected.index.packages.length,entries:entries.length,reused_deliveries:projected.reused,
    old_product_closure_verified:closure.accepted,actual_search_snapshot_lookup_pagination:true,
    scope:'discovery projection only; no automatic receipt rebinding, combined product admission, production deployment, or release',public_admission:false};
  await mkdir(out); await writeFile(join(out,'index.json'),bytes,{flag:'wx'});
  await writeFile(join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [oldRoot,oldSha,source,run,receiptSha,witPath,witSha,out]=process.argv.slice(2);
  projectResidentSearch({oldRoot,oldSha,source,run,receiptSha,witPath,witSha,out}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
}
