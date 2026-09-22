// Discovery is derived only from the finite approved package list, not arbitrary directories.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot, sha256, parseCatalog, catalogAuthorities } from './lib-catalog.mjs';
const manifest = JSON.parse(readFileSync(join(repositoryRoot,'manifest.json')));
const candidate012 = JSON.parse(readFileSync(join(repositoryRoot,'channels/candidates/0.0.12.json')));
const approved009 = [
  ['standard/wasmc-std/1.4.0',false,['standard','string','bytes','list','map','encoding','base64','hex','iterator','typed-data']],
  ['libs/wasmc-owned-algorithms',true,['algorithms','component']],
  ['libs/wasmc-resource-counter',true,['counter','resource','component']],
  ['libs/wasmc-host-clock',true,['clock','host','component']],
];
const approved012 = [
  ['standard/wasmc-std/1.4.0',false,['standard','string','bytes','list','map','encoding','base64','hex','iterator','typed-data']],
  ['libs/wasmc-data-core',false,['data','typed-batch','schema','column','validate','take']],
  ['libs/wasmc-csv',false,['csv','parse','header','delimiter','typed-batch','tabular']],
  ['libs/wasmc-data-expr',false,['data','expression','predicate','filter','literal','column','dag']],
  ['libs/wasmc-data-compute',false,['data','compute','filter','project','sort','typed-batch']],
  ['libs/wasmc-data-relational',false,['data','relational','join','equi-join','union','aggregate','window','rank','row-number','dense-rank','group']],
  ['libs/wasmc-data-profile',false,['data','profile','statistics','describe','minimum','maximum','mean','null-count']],
  ['libs/wasmc-data-interchange',false,['data','interchange','arrow','ipc','parquet','encode','decode']],
  ['libs/wasmc-owned-algorithms',true,['algorithms','component']],
  ['libs/wasmc-resource-counter',true,['counter','resource','component','stateful']],
  ['libs/wasmc-host-clock',true,['clock','time','host','now','component']],
  ['standard/wasmc-lib-search/0.1.0',false,['search','catalog','discovery','lookup','library']],
];
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
for (const [name,authority,approved,inventory,searchTextProfile] of [
  ['libs-v009.json',catalogAuthorities.v009,approved009,manifest.artifacts,null],
  ['libs-v012.json',catalogAuthorities.v012,approved012,candidate012.product_files,'package-intent-v1'],
]) {
  const bytes=JSON.stringify(makeCatalog(authority,approved,inventory,searchTextProfile),null,2)+'\n';
  parseCatalog(bytes,authority);
  writeFileSync(join(repositoryRoot,'catalog',name),bytes);
}
console.log('PASS refreshed finite approved Lib discovery catalogs v0.0.9 + v0.0.12');
