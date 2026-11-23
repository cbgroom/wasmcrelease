import assert from 'node:assert/strict';
import { checkedCurrentCatalog,hash } from './current-lib-release-v3.mjs';
import { verifyMixedFromCatalog } from './mixed-current-product-v1.mjs';
import { collectCurrentDeclaredThirdPartyNotices } from './current-license-policy-v3.mjs';
import { collectCurrentDeclaredThirdPartyNoticesV4 } from './current-license-policy-v4.mjs';

// Preserve per-Root declared notice bytes from the verified original product;
// a new product-wide notice list must not rewrite a published Root.
export async function collectMixedDeclaredNotices(catalogBytes,policy,read,productPaths) {
  assert.equal(policy.schema,'wasmc.current-license-policy/mixed-v1');
  const catalog=checkedCurrentCatalog(catalogBytes,policy.catalog_sha256);
  assert.equal(catalog.version,policy.version);assert.equal(catalog.package_authority_commit,policy.package_authority_commit);
  assert.equal(catalog.packages.length,policy.current_packages);assert.ok(Array.isArray(productPaths));
  const cache=new Map(),load=async path=>{if(!cache.has(path)){const b=await read(path);assert.ok(b instanceof Uint8Array);cache.set(path,Buffer.from(b));}return cache.get(path);};
  const cohortBytes=await load(catalog.cohort.path);assert.equal(cohortBytes.length,catalog.cohort.bytes);assert.equal(hash(cohortBytes),catalog.cohort.sha256);
  const cohort=JSON.parse(cohortBytes);assert.equal(cohort.schema,'wasmc.mixed-current-cohort/v1');
  const prefix='admission/mixed-product-inputs-v1';
  await load('catalog/libs-current-v2.json');await load(catalog.registry.path);await load(catalog.index.path);
  for(const [name,graph] of Object.entries(cohort.inputs))for(const f of graph.files)await load(`${prefix}/${name}/${f.path}`);
  for(const row of catalog.packages){for(const pin of row.files)await load(pin.path);for(const pin of Object.values(row.source))await load(pin.path);}
  for(const pin of cohort.common_files)await load(pin.path);
  const get=p=>{assert.ok(cache.has(p),'undeclared mixed notice input: '+p);return cache.get(p);};
  const closure=verifyMixedFromCatalog(catalogBytes,policy.catalog_sha256,get,productPaths);assert.equal(closure.accepted,true);
  const graph=name=>async p=>get(`${prefix}/${name}/${p}`);
  const oldBytes=get(`${prefix}/old/catalog/libs-current-v2.json`),newBytes=get(`${prefix}/candidate/catalog/libs-current-v2.json`);
  const oldPolicy=JSON.parse(get(`${prefix}/old/catalog/current-v3-license-policy.json`));
  const newPolicy=JSON.parse(get(`${prefix}/candidate/catalog/current-v4-license-policy.json`));
  const old=await collectCurrentDeclaredThirdPartyNotices(oldBytes,oldPolicy,graph('old'));
  const fresh=await collectCurrentDeclaredThirdPartyNoticesV4(newBytes,newPolicy,graph('candidate'),cohort.inputs.candidate.product_paths);
  const result=new Map();
  for(const [name,items] of [['old',old],['candidate',fresh]])for(const [path,pin] of items)
    result.set(`${prefix}/${name}/${path}`,pin);
  const reused=new Set(cohort.reused.map(r=>r.id));
  for(const row of catalog.packages){
    const original=reused.has(row.id)?old:fresh,manifest=JSON.parse(get(row.root+'/lib.json'));
    for(const pin of manifest.license.files){
      if(pin.path==='LICENSE')continue;
      const path=row.root+'/'+pin.path,proof=original.get(path);assert.ok(proof,'original declared Root notice required');
      assert.equal(proof.bytes,pin.bytes);assert.equal(proof.sha256,pin.sha256);
      const b=get(path);assert.equal(b.length,pin.bytes);assert.equal(hash(b),pin.sha256);
      result.set(path,{bytes:pin.bytes,sha256:pin.sha256,manifest_sha256:row.manifest_sha256,catalog_sha256:policy.catalog_sha256});
    }
  }
  for(const pin of cohort.common_files){
    if(!/^licenses\/DEPENDENCY-NOTICES-[0-9]{3}\.txt$/.test(pin.path))continue;
    const proof=fresh.get(pin.path);assert.ok(proof);assert.equal(proof.bytes,pin.bytes);assert.equal(proof.sha256,pin.sha256);
    result.set(pin.path,{bytes:pin.bytes,sha256:pin.sha256,catalog_sha256:policy.catalog_sha256});
  }
  return result;
}
