// Discovery is derived only from the finite approved package list, not arbitrary directories.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot, sha256, parseCatalog } from './lib-catalog.mjs';
const manifest = JSON.parse(readFileSync(join(repositoryRoot,'manifest.json')));
const approved = [
  ['standard/wasmc-std/1.4.0',false,['standard','string','bytes','list','map','encoding','base64','hex','iterator','typed-data']],
  ['libs/wasmc-owned-algorithms',true,['algorithms','component']],
  ['libs/wasmc-resource-counter',true,['counter','resource','component']],
  ['libs/wasmc-host-clock',true,['clock','host','component']],
];
const catalog = {schema:'wasmc.public-lib-catalog/v1',release_tag:'v0.0.9',release_commit:'0fec38d59872a7f1527dc94799da542e968f1f8a', packages:approved.map(([root,historical,keywords])=>{
  const metadata = JSON.parse(readFileSync(join(repositoryRoot,root,'lib.json')));
  const files = manifest.artifacts.filter(f=>f.path.startsWith(root+'/')).map(({path,bytes,sha256})=>({path,bytes,sha256})).sort((a,b)=>a.path.localeCompare(b.path));
  const row = {id:metadata.id,version:metadata.version,wit_package:metadata.wit.package,wit_sha256:metadata.wit.sha256,artifact_sha256:metadata.artifact.sha256,root,historical,keywords,files};
  if (metadata.id === 'wasmc-std') {
    const path='standard/corelib/4.8.0/corelib.wasm'; const data=readFileSync(join(repositoryRoot,path));
    row.companion={path,bytes:data.length,sha256:sha256(data)};
  }
  return row;
})};
const bytes=JSON.stringify(catalog,null,2)+'\n';
parseCatalog(bytes);
writeFileSync(join(repositoryRoot,'catalog/libs-v009.json'),bytes);
console.log('PASS refreshed finite approved Lib discovery catalog');
