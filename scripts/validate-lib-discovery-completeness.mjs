import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot, catalogAuthorities, parseCatalog, searchCatalog } from './lib-catalog.mjs';

const candidate=JSON.parse(readFileSync(join(repositoryRoot,'channels/candidates/0.0.13.json')));
const intent=JSON.parse(readFileSync(join(repositoryRoot,'catalog/discovery-intent-v1.json')));
const catalogBytes=readFileSync(join(repositoryRoot,'catalog/libs-v013.json'));
const catalog=parseCatalog(catalogBytes,catalogAuthorities.v013);
const productRoots=[...new Set(candidate.product_files.map(row=>row.path).flatMap(path=>{
  const lib=path.match(/^(libs\/[^/]+)\/lib\.json$/);
  const standard=path.match(/^(standard\/[^/]+\/[^/]+)\/lib\.json$/);
  return lib?[lib[1]]:standard?[standard[1]]:[];
}))].sort();
assert.deepEqual(intent.entries.map(row=>row.root).sort(),productRoots,'every released Lib root requires explicit discovery intent');
assert.deepEqual(catalog.packages.map(row=>row.root).sort(),productRoots,'catalog must cover the exact released Lib inventory');
const seenIds=new Set();
let queries=0;
for(const entry of intent.entries){
  assert.equal(seenIds.has(entry.id),false,'duplicate discovery intent id');
  seenIds.add(entry.id);
  const row=catalog.packages.find(row=>row.root===entry.root);
  assert.ok(row,entry.root);
  assert.equal(row.id,entry.id);
  assert.deepEqual(row.keywords,entry.keywords);
  const metadata=JSON.parse(readFileSync(join(repositoryRoot,entry.root,'lib.json')));
  assert.equal(row.version,metadata.version);
  assert.equal(row.wit_package,metadata.wit.package);
  assert.equal(row.wit_sha256,metadata.wit.sha256);
  assert.equal(row.artifact_sha256,metadata.artifact.sha256);
  assert.equal(searchCatalog(catalogBytes,entry.id,true,catalogAuthorities.v013).some(hit=>hit.id===entry.id),true,entry.id);
  for(const query of entry.required_queries){
    assert.equal(searchCatalog(catalogBytes,query,true,catalogAuthorities.v013).some(hit=>hit.id===entry.id),true,entry.id+': '+query);
    queries++;
  }
}
console.log(JSON.stringify({accepted:true,schema:'wasmc.lib-discovery-completeness/v1',release:'v0.0.13',released_lib_roots:productRoots.length,catalog_packages:catalog.packages.length,explicit_intent_rows:intent.entries.length,required_query_checks:queries,selection_authority:false}));
