import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sha256, repositoryRoot, searchCatalog, resolveCatalog, packageReader } from './lib-catalog.mjs';
const bytes=readFileSync(join(repositoryRoot,'catalog/libs-v009.json'));
const catalog=JSON.parse(bytes);
const request=row=>({id:row.id,version:row.version,catalog_sha256:sha256(bytes),wit_sha256:row.wit_sha256,artifact_sha256:row.artifact_sha256});
const rejected=(fn,code)=>assert.throws(fn,error=>error.code===code);
assert.equal(searchCatalog(bytes).length,1);
assert.equal(searchCatalog(bytes,'',true).length,4);
assert.equal(searchCatalog(bytes,'bytes')[0].id,'wasmc-std');
assert.equal(searchCatalog(bytes,'nonexistent').length,0);
for (const row of catalog.packages) {
  const a=resolveCatalog(bytes,request(row)); const b=resolveCatalog(bytes,request(row));
  assert.deepEqual(a,b); assert.equal(a.authority_granted,false); assert.equal(a.verified,true);
}
const row=catalog.packages[0], req=request(row), read=packageReader();
rejected(()=>resolveCatalog(bytes,{...req,catalog_sha256:'0'.repeat(64)}),'catalog.identity_mismatch');
rejected(()=>resolveCatalog(bytes,{...req,version:undefined}),'resolve.exact_lock_required');
rejected(()=>resolveCatalog(bytes,{...req,version:'9.9.9'}),'resolve.not_found');
rejected(()=>resolveCatalog(bytes,{...req,wit_sha256:'0'.repeat(64)}),'resolve.identity_mismatch');
const altered=value=>Buffer.from(JSON.stringify(value));
const duplicate=altered({...catalog,packages:[...catalog.packages,row]});
rejected(()=>resolveCatalog(duplicate,{...req,catalog_sha256:sha256(duplicate)}),'resolve.ambiguous');
const invalid=structuredClone(catalog); invalid.packages[0].files[0].path='../escape';
const invalidBytes=altered(invalid);
rejected(()=>resolveCatalog(invalidBytes,{...req,catalog_sha256:sha256(invalidBytes)}),'catalog.path_invalid');
rejected(()=>resolveCatalog(bytes,req,p=>p.endsWith('/artifact.wasm')?new Uint8Array(0):read(p)),'package.identity_mismatch');
rejected(()=>resolveCatalog(bytes,req,p=>{if(p.endsWith('/lib.wit'))throw Error();return read(p); }),'package.file_missing');
rejected(()=>resolveCatalog(bytes,req,p=>p===row.companion.path?new Uint8Array(0):read(p)),'package.companion_drift');
const fixture=mkdtempSync(join(tmpdir(),'wasmc-catalog-'));
try {symlinkSync(join(repositoryRoot,'README.md'),join(fixture,'escape'));rejected(()=>packageReader(fixture)('escape'),'catalog.path_escape');}
finally {rmSync(fixture,{recursive:true});}
console.log(JSON.stringify({accepted:true,packages:4,negative_tests:10,selection:'unique exact lock',network_access:false,artifact_changes:false}));
