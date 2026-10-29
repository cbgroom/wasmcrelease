import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {checkedCurrentCatalog,currentProductPaths,currentProductReader} from './current-lib-release-v3.mjs';
import {collectMixedDeclaredNotices} from './current-license-policy-mixed-v1.mjs';
import {verify} from './json-derived-product-v1.mjs';
import {sha} from './lib-refresh-cache-v2.mjs';

// This checks retained declared notice bytes, not license compatibility.
export async function collectJsonDerivedNotices(options) {
 const closure=await verify(options);assert.equal(closure.derived_lineage_verified,true);
 const {root,catalogSha,oldSha}=options,read=currentProductReader(root),catalog=checkedCurrentCatalog(read('catalog/libs-current-v2.json'),catalogSha);
 const oldRoot=join(root,'proof/old-product'),oldRead=currentProductReader(oldRoot),oldBytes=oldRead('catalog/libs-current-v2.json');assert.equal(sha(oldBytes),oldSha);
 const oldPolicy=JSON.parse(oldRead('catalog/current-mixed-license-policy-v1.json'));
 const previous=await collectMixedDeclaredNotices(oldBytes,oldPolicy,async p=>oldRead(p),currentProductPaths(oldRoot));
 const parentRoot=join(root,'proof/json-q0/parent/root'),parent=JSON.parse(await readFile(join(parentRoot,'lib.json')));
 const selected=catalog.packages.find(row=>row.id==='wasmc-json');assert.ok(selected);const results=new Map();
 for(const [path,pin] of previous)results.set('proof/old-product/'+path,pin);
 for(const row of catalog.packages){
  const manifest=JSON.parse(read(row.root+'/lib.json'));assert.equal(sha(read(row.root+'/lib.json')),row.manifest_sha256);
  if(row.id===selected.id){assert.deepEqual(manifest.license.files.slice(0,parent.license.files.length),parent.license.files,'inherited notice descriptors');
   const extras=manifest.license.files.slice(parent.license.files.length);assert.equal(extras.length,1);assert.equal(extras[0].path,'licenses/DEPENDENCY-NOTICES-014.txt');}
  for(const pin of manifest.license.files.filter(p=>p.path!=='LICENSE')){
   const path=row.root+'/'+pin.path,b=read(path);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256);
   if(row.id===selected.id){
    const inherited=parent.license.files.find(x=>x.path===pin.path);
    if(inherited){assert.deepEqual(inherited,pin);const source=await readFile(join(parentRoot,pin.path));assert.deepEqual(b,source);results.set('proof/json-q0/parent/root/'+pin.path,{bytes:pin.bytes,sha256:pin.sha256});}
    else assert.equal(pin.path,'licenses/DEPENDENCY-NOTICES-014.txt');
    const captured=await readFile(join(root,'proof/json-q0/root',pin.path));assert.deepEqual(b,captured);results.set('proof/json-q0/root/'+pin.path,{bytes:pin.bytes,sha256:pin.sha256});
   } else {const prior=previous.get(path);assert.ok(prior,'original Root notice missing: '+path);assert.equal(prior.bytes,pin.bytes);assert.equal(prior.sha256,pin.sha256);}
   results.set(path,{bytes:pin.bytes,sha256:pin.sha256,manifest_sha256:row.manifest_sha256,catalog_sha256:catalogSha});
  }
 }
 return results;
}
