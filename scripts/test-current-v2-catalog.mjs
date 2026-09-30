import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {repositoryRoot, parseCatalog, searchCatalog, resolveCatalog, packageReader, catalogAuthorities, sha256} from './lib-catalog.mjs';
const bytes=readFileSync(join(repositoryRoot,'catalog/libs-current-v2.json'));
const catalog=parseCatalog(bytes,catalogAuthorities.currentV2);
assert.equal(catalog.packages.length,5);
assert.deepEqual(catalog.packages.map(x=>x.id).sort(),['mcpgit-resident-memory','wasmc-compression','wasmc-json','wasmc-lib-search','wasmc-std']);
for(const row of catalog.packages){
  assert.match(row.root,/^current-libs\//);
  const manifest=JSON.parse(readFileSync(join(repositoryRoot,row.root,'lib.json')));
  assert.equal(manifest.schema,'wasmc.lib/v2');
  assert.equal(manifest.agent.default_view,'runtime');
  assert.deepEqual(Object.keys(manifest.agent.views).sort(),['developer','runtime']);
  assert.equal(manifest.agent.views.developer.includes_runtime,true);
  const lock=resolveCatalog(bytes,{id:row.id,version:row.version,catalog_sha256:sha256(bytes),wit_sha256:row.wit_sha256,artifact_sha256:row.artifact_sha256},packageReader(),catalogAuthorities.currentV2);
  assert.equal(lock.verified,true);
  assert.equal(lock.release_commit,catalogAuthorities.currentV2.release_commit);
}
assert.equal(searchCatalog(bytes,'standard',false,catalogAuthorities.currentV2)[0].id,'wasmc-std');
assert.equal(searchCatalog(bytes,'lib search',false,catalogAuthorities.currentV2)[0].id,'wasmc-lib-search');
assert.equal(searchCatalog(bytes,'mcpgit',false,catalogAuthorities.currentV2)[0].id,'mcpgit-resident-memory');
assert.equal(searchCatalog(bytes,'telemetry',false,catalogAuthorities.currentV2).length,0);
console.log(JSON.stringify({accepted:true,packages:catalog.packages.length,telemetry_current:false,default_view:'runtime',views:['runtime','developer']}));
