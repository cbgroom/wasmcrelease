// Inventory comes from the exact frozen release product set. Search semantics
// remain explicitly reviewed in catalog/discovery-intent-v1.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot, sha256, parseCatalog, catalogAuthorities } from './lib-catalog.mjs';
const manifest = JSON.parse(readFileSync(join(repositoryRoot,'manifest.json')));
const candidate013 = JSON.parse(readFileSync(join(repositoryRoot,'channels/candidates/0.0.13.json')));
const intent = JSON.parse(readFileSync(join(repositoryRoot,'catalog/discovery-intent-v1.json')));
if (intent.schema !== 'wasmc.public-lib-discovery-intent/v1' || intent.release !== '0.0.13' || !Array.isArray(intent.entries)) throw Error('discovery intent rejected');
const approved009 = [
  ['standard/wasmc-std/1.4.0',false,['standard','string','bytes','list','map','encoding','base64','hex','iterator','typed-data']],
  ['libs/wasmc-owned-algorithms',true,['algorithms','component']],
  ['libs/wasmc-resource-counter',true,['counter','resource','component']],
  ['libs/wasmc-host-clock',true,['clock','host','component']],
];
const inventory013 = [...new Set(candidate013.product_files.map(row=>row.path).flatMap(path=>{
  const lib=path.match(/^(libs\/[^/]+)\/lib\.json$/);
  const standard=path.match(/^(standard\/[^/]+\/[^/]+)\/lib\.json$/);
  return lib?[lib[1]]:standard?[standard[1]]:[];
}))].sort();
const intentRoots=intent.entries.map(row=>row.root);
if (new Set(intentRoots).size !== intentRoots.length || JSON.stringify([...intentRoots].sort()) !== JSON.stringify(inventory013)) throw Error('discovery intent inventory drift');
const approved013=intent.entries.map(row=>{
  if (typeof row.id!=='string' || typeof row.root!=='string' || typeof row.historical!=='boolean' || !Array.isArray(row.keywords) || !row.keywords.length || !Array.isArray(row.required_queries) || !row.required_queries.length) throw Error('discovery intent row rejected');
  if (!row.keywords.every(x=>typeof x==='string'&&x.length) || !row.required_queries.every(x=>typeof x==='string'&&x.length)) throw Error('discovery intent text rejected');
  const metadata=JSON.parse(readFileSync(join(repositoryRoot,row.root,'lib.json')));
  if(metadata.id!==row.id) throw Error('discovery intent identity drift');
  return [row.root,row.historical,row.keywords];
});
function makeCatalog(authority, approved, inventory, searchTextProfile = null) {
  return {schema:'wasmc.public-lib-catalog/v1',release_tag:authority.release_tag,release_commit:authority.release_commit,...(searchTextProfile?{search_text_profile:searchTextProfile}:{}),packages:approved.map(([root,historical,keywords])=>{
  const metadata = JSON.parse(readFileSync(join(repositoryRoot,root,'lib.json')));
  const files = inventory.filter(f=>f.path.startsWith(root+'/')).map(({path,bytes,sha256})=>({path,bytes,sha256})).sort((a,b)=>a.path.localeCompare(b.path));
  const row = {id:metadata.id,version:metadata.version,wit_package:metadata.wit.package,wit_sha256:metadata.wit.sha256,artifact_sha256:metadata.artifact.sha256,root,historical,keywords,files};
  if (metadata.id === 'wasmc-std') {
    const path='standard/corelib/4.8.0/corelib.wasm'; const data=readFileSync(join(repositoryRoot,path));
    row.companion={path,bytes:data.length,sha256:sha256(data)};
  }
  return row;
  })};
}
for (const [name,authority,approved,inventory,profile] of [
  ['libs-v009.json',catalogAuthorities.v009,approved009,manifest.artifacts,null],
  ['libs-v013.json',catalogAuthorities.v013,approved013,candidate013.product_files,'package-intent-v1'],
]) {
  const bytes=JSON.stringify(makeCatalog(authority,approved,inventory,profile),null,2)+'\n';
  parseCatalog(bytes,authority);
  writeFileSync(join(repositoryRoot,'catalog',name),bytes);
}
console.log('PASS refreshed finite approved Lib discovery catalogs v0.0.9 + v0.0.13');
