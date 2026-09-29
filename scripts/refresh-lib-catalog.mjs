// Inventory comes from the exact frozen release product set. Search semantics
// remain explicitly reviewed in catalog/discovery-intent-v1.json.
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot, sha256, parseCatalog, catalogAuthorities } from './lib-catalog.mjs';
const manifest = JSON.parse(readFileSync(join(repositoryRoot,'manifest.json')));
const candidate013 = JSON.parse(readFileSync(join(repositoryRoot,'channels/candidates/0.0.13.json')));
const intent = JSON.parse(readFileSync(join(repositoryRoot,'catalog/discovery-intent-v1.json')));
const intent014 = JSON.parse(readFileSync(join(repositoryRoot,'catalog/discovery-intent-v014.json')));
const intent017Input = JSON.parse(readFileSync(join(repositoryRoot,'catalog/discovery-intent-v017-input.json')));
const intent017 = JSON.parse(readFileSync(join(repositoryRoot,'catalog/discovery-intent-v017.json')));
const intent018Input = JSON.parse(readFileSync(join(repositoryRoot,'catalog/discovery-intent-v018-input.json')));
const intent018 = JSON.parse(readFileSync(join(repositoryRoot,'catalog/discovery-intent-v018.json')));
if (intent.schema !== 'wasmc.public-lib-discovery-intent/v1' || intent.release !== '0.0.13' || !Array.isArray(intent.entries)) throw Error('discovery intent rejected');
if (intent014.schema !== 'wasmc.public-lib-discovery-intent/v1' || intent014.release !== '0.0.14' || !Array.isArray(intent014.entries)) throw Error('v0.0.14 discovery intent rejected');
if (intent017Input.schema !== 'wasmc.public-lib-discovery-intent/v1' || intent017Input.release !== '0.0.17-input' || !Array.isArray(intent017Input.entries)) throw Error('v0.0.17 input discovery intent rejected');
if (intent017.schema !== 'wasmc.public-lib-discovery-intent/v1' || intent017.release !== '0.0.17' || !Array.isArray(intent017.entries)) throw Error('v0.0.17 discovery intent rejected');
if (intent018Input.schema !== 'wasmc.public-lib-discovery-intent/v1' || intent018Input.release !== '0.0.18-input' || !Array.isArray(intent018Input.entries)) throw Error('v0.0.18 input discovery intent rejected');
if (intent018.schema !== 'wasmc.public-lib-discovery-intent/v1' || intent018.release !== '0.0.18' || !Array.isArray(intent018.entries)) throw Error('v0.0.18 discovery intent rejected');
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
const collectFiles=root=>readdirSync(join(repositoryRoot,root)).sort().flatMap(name=>{
  const path=`${root}/${name}`,stat=lstatSync(join(repositoryRoot,path));
  if(stat.isSymbolicLink())throw Error('catalog product symlink rejected');
  if(stat.isDirectory())return collectFiles(path);
  const bytes=readFileSync(join(repositoryRoot,path));
  return [{path,bytes:bytes.length,sha256:sha256(bytes)}];
});
const inventory014=[...candidate013.product_files,...collectFiles('standard/wasmc-lib-search/0.2.0')];
const inventoryRoots014=[...new Set(inventory014.map(row=>row.path).flatMap(path=>{
  const lib=path.match(/^(libs\/[^/]+)\/lib\.json$/),standard=path.match(/^(standard\/[^/]+\/[^/]+)\/lib\.json$/);
  return lib?[lib[1]]:standard?[standard[1]]:[];
}))].sort();
if(JSON.stringify([...intent014.entries.map(row=>row.root)].sort())!==JSON.stringify(inventoryRoots014))throw Error('v0.0.14 discovery intent inventory drift');
const approved014=intent014.entries.map(row=>{
  if(typeof row.id!=='string'||typeof row.root!=='string'||typeof row.historical!=='boolean'||!Array.isArray(row.keywords)||!row.keywords.length||!Array.isArray(row.required_queries)||!row.required_queries.length)throw Error('v0.0.14 discovery intent row rejected');
  const metadata=JSON.parse(readFileSync(join(repositoryRoot,row.root,'lib.json')));
  if(metadata.id!==row.id)throw Error('v0.0.14 discovery intent identity drift');
  return [row.root,row.historical,row.keywords];
});
const approved017Input=intent017Input.entries.map(row=>{
  if(typeof row.id!=='string'||typeof row.root!=='string'||typeof row.historical!=='boolean'||!Array.isArray(row.keywords)||!row.keywords.length||!Array.isArray(row.required_queries)||!row.required_queries.length)throw Error('v0.0.17 input discovery intent row rejected');
  const metadata=JSON.parse(readFileSync(join(repositoryRoot,row.root,'lib.json')));
  if(metadata.id!==row.id)throw Error('v0.0.17 input discovery intent identity drift');
  return [row.root,row.historical,row.keywords];
});
const inventory017Input=approved017Input.flatMap(([root])=>collectFiles(root));
const approved017=intent017.entries.map(row=>{
  if(typeof row.id!=='string'||typeof row.root!=='string'||typeof row.historical!=='boolean'||!Array.isArray(row.keywords)||!row.keywords.length||!Array.isArray(row.required_queries)||!row.required_queries.length)throw Error('v0.0.17 discovery intent row rejected');
  const metadata=JSON.parse(readFileSync(join(repositoryRoot,row.root,'lib.json')));
  if(metadata.id!==row.id)throw Error('v0.0.17 discovery intent identity drift');
  return [row.root,row.historical,row.keywords];
});
const inventory017=approved017.flatMap(([root])=>collectFiles(root));
const approved018Input=intent018Input.entries.map(row=>{
  if(typeof row.id!=='string'||typeof row.root!=='string'||typeof row.historical!=='boolean'||!Array.isArray(row.keywords)||!row.keywords.length||!Array.isArray(row.required_queries)||!row.required_queries.length)throw Error('v0.0.18 input discovery intent row rejected');
  const metadata=JSON.parse(readFileSync(join(repositoryRoot,row.root,'lib.json')));
  if(metadata.id!==row.id)throw Error('v0.0.18 input discovery intent identity drift');
  return [row.root,row.historical,row.keywords];
});
const inventory018Input=approved018Input.flatMap(([root])=>collectFiles(root));
const approved018=intent018.entries.map(row=>{
  if(typeof row.id!=='string'||typeof row.root!=='string'||typeof row.historical!=='boolean'||!Array.isArray(row.keywords)||!row.keywords.length||!Array.isArray(row.required_queries)||!row.required_queries.length)throw Error('v0.0.18 discovery intent row rejected');
  const metadata=JSON.parse(readFileSync(join(repositoryRoot,row.root,'lib.json')));
  if(metadata.id!==row.id)throw Error('v0.0.18 discovery intent identity drift');
  return [row.root,row.historical,row.keywords];
});
const inventory018=approved018.flatMap(([root])=>collectFiles(root));
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
  ['libs-v014.json',catalogAuthorities.v014,approved014,inventory014,'package-intent-v1'],
  ['libs-v017-input.json',catalogAuthorities.v017,approved017Input,inventory017Input,'package-intent-v1'],
  ['libs-v017.json',catalogAuthorities.v017,approved017,inventory017,'package-intent-v1'],
  ['libs-v018-input.json',catalogAuthorities.v018,approved018Input,inventory018Input,'package-intent-v1'],
  ['libs-v018.json',catalogAuthorities.v018,approved018,inventory018,'package-intent-v1'],
]) {
  const bytes=JSON.stringify(makeCatalog(authority,approved,inventory,profile),null,2)+'\n';
  parseCatalog(bytes,authority);
  writeFileSync(join(repositoryRoot,'catalog',name),bytes);
}
console.log('PASS refreshed finite approved Lib discovery catalogs through v0.0.18');
