import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentProductPaths, currentProductReader, verifyCurrentRelease, verifyCurrentReleaseV4 } from './current-lib-release-v3.mjs';
import { projectFrozenIndex } from './project-frozen-search-index-v1.mjs';
import { CurrentSearchCaller } from './current-lib-search-v3.mjs';
import { collectCurrentDeclaredThirdPartyNotices } from './current-license-policy-v3.mjs';
import { collectCurrentDeclaredThirdPartyNoticesV4 } from './current-license-policy-v4.mjs';
import { inventory, sha } from './lib-refresh-cache-v2.mjs';

const prefix='admission/mixed-product-inputs-v1';
const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const safe=p=>typeof p==='string'&&p&&!p.startsWith('/')&&!p.includes('\\')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
const descriptor=(path,b)=>({path,bytes:b.length,sha256:sha(b)});
const parse=b=>JSON.parse(b.toString('utf8'));
const sort=a=>[...a].sort();

function verifyInput(read,paths,expected,verify) {
  const catalogBytes=read('catalog/libs-current-v2.json');assert.equal(sha(catalogBytes),expected,'independent catalog pin');
  const catalog=parse(catalogBytes),closure=verify(catalogBytes,expected,read,paths);
  const indexBytes=read(catalog.index.path);assert.equal(sha(indexBytes),catalog.index.sha256);
  return {catalog,index:parse(indexBytes),closure};
}
function select(old, candidate, projected) {
  const reused=new Set(projected.reused.map(x=>x.id));
  return candidate.catalog.packages.map(row=>reused.has(row.id)
    ? structuredClone(old.catalog.packages.find(x=>x.id===row.id)) : structuredClone(row));
}

// Verification requires caller-provided old and candidate catalog pins. The
// embedded input graphs make the original two closures independently replayable.
export function verifyMixedCurrentProductData(read, productPaths, mixedSha, oldSha, candidateSha) {
  for(const pin of [mixedSha,oldSha,candidateSha])assert.match(pin,/^[0-9a-f]{64}$/);
  const catalogBytes=read('catalog/libs-current-v2.json');assert.equal(sha(catalogBytes),mixedSha,'independent mixed catalog pin');
  const catalog=parse(catalogBytes);assert.equal(catalog.schema,'wasmc.public-lib-catalog/v2');
  assert.match(catalog.version,/^\d+\.\d+\.\d+$/);assert.match(catalog.package_authority_commit,/^[0-9a-f]{40}$/);
  const cohortBytes=read(catalog.cohort.path);assert.equal(sha(cohortBytes),catalog.cohort.sha256);
  assert.equal(cohortBytes.length,catalog.cohort.bytes);
  const cohort=parse(cohortBytes);assert.equal(cohort.schema,'wasmc.mixed-current-cohort/v1');
  assert.equal(cohort.old_catalog_sha256,oldSha,'old catalog pin');
  assert.equal(cohort.candidate_catalog_sha256,candidateSha,'candidate catalog pin');
  assert.equal(cohort.public_admission,false);
  const graph=(name,verify,pin)=>{
    const info=cohort.inputs[name],seen=new Set();
    for(const file of info.files){assert.ok(safe(file.path)&&!seen.has(file.path));seen.add(file.path);
      const b=read(`${prefix}/${name}/${file.path}`);assert.equal(b.length,file.bytes);assert.equal(sha(b),file.sha256);}
    const graphRead=path=>{assert.ok(seen.has(path),'undeclared original graph file: '+path);return read(`${prefix}/${name}/${path}`);};
    return verifyInput(graphRead,info.product_paths,pin,verify);
  };
  const old=graph('old',verifyCurrentRelease,oldSha),candidate=graph('candidate',verifyCurrentReleaseV4,candidateSha);
  const projected=projectFrozenIndex(old.catalog,old.index,candidate.catalog,candidate.index);
  assert.deepEqual(cohort.reused,projected.reused);
  assert.deepEqual(catalog.packages,select(old,candidate,projected),'exact original selected package rows');
  const indexBytes=Buffer.from(JSON.stringify(projected.index)+'\n');
  assert.deepEqual(read(catalog.index.path),indexBytes);assert.equal(sha(indexBytes),catalog.index.sha256);
  assert.equal(catalog.index.bytes,indexBytes.length);
  assert.deepEqual(catalog.registry,candidate.catalog.registry);
  assert.deepEqual(read(catalog.registry.path),read(`${prefix}/candidate/${catalog.registry.path}`));
  const reused=new Set(projected.reused.map(r=>r.id)),files=[];
  for(const row of catalog.packages){
    const name=reused.has(row.id)?'old':'candidate';
    for(const f of row.files){const b=read(f.path);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);
      assert.deepEqual(b,read(`${prefix}/${name}/${f.path}`),'original Root bytes');files.push(f.path);}
    for(const pin of Object.values(row.source))assert.deepEqual(read(pin.path),read(`${prefix}/candidate/${pin.path}`),'Q0 source bytes');
  }
  assert.deepEqual(sort(productPaths),sort(files),'complete current Root inventory');
  const candidateCohort=parse(read(`${prefix}/candidate/${candidate.catalog.cohort.path}`));
  const requiredCommon=['LICENSE',candidateCohort.release_notices.manifest.path,...candidateCohort.release_notices.files.map(x=>x.path)];
  assert.deepEqual(sort(cohort.common_files.map(x=>x.path)),sort(requiredCommon),'complete candidate common notices');
  for(const pin of cohort.common_files){assert.ok(safe(pin.path));const b=read(pin.path);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256);
    assert.deepEqual(b,read(`${prefix}/candidate/${pin.path}`),'candidate common notice input');}
  return {schema:'wasmc.mixed-current-verification/v1',accepted:true,catalog_sha256:sha(catalogBytes),index_sha256:sha(indexBytes),
    packages:catalog.packages.length,reused:projected.reused.length,root_files:files.length,
    original_input_closures_verified:true,public_admission:false,release:false};
}
export function verifyMixedCurrentProduct(root, mixedSha, oldSha, candidateSha) {
  return verifyMixedCurrentProductData(currentProductReader(root),currentProductPaths(root),mixedSha,oldSha,candidateSha);
}
// The pinned outer catalog authenticates the cohort and its two input pins.
// Callers still supply the outer catalog identity independently.
export function verifyMixedFromCatalog(catalogBytes,catalogSha,read,productPaths) {
  assert.equal(sha(catalogBytes),catalogSha);
  const catalog=parse(catalogBytes),cohortBytes=read(catalog.cohort.path);
  assert.equal(cohortBytes.length,catalog.cohort.bytes);assert.equal(sha(cohortBytes),catalog.cohort.sha256);
  const cohort=parse(cohortBytes);assert.equal(cohort.schema,'wasmc.mixed-current-cohort/v1');
  assert.deepEqual(read('catalog/libs-current-v2.json'),catalogBytes);
  assert.ok(Array.isArray(productPaths),'independent product inventory required');
  return verifyMixedCurrentProductData(read,productPaths.filter(p=>p.startsWith('current-libs/')),catalogSha,cohort.old_catalog_sha256,cohort.candidate_catalog_sha256);
}
export function searchMixedCurrentRelease(catalogBytes,catalogSha,read,selection,offset=0,limit=64,productPaths) {
  verifyMixedFromCatalog(catalogBytes,catalogSha,read,productPaths);
  const catalog=parse(catalogBytes),search=catalog.packages.find(x=>x.id==='wasmc-lib-search');assert.ok(search);
  const caller=new CurrentSearchCaller(read(catalog.index.path),read(search.root+'/artifact.wasm'),read(search.root+'/core-abi.json'));
  return {schema:'wasmc.mixed-current-lib-search/v1',catalog_sha256:catalogSha,index_sha256:catalog.index.sha256,
    selection_authority:false,offset,limit,result:caller.search(selection,offset,limit)};
}

export async function assembleMixedCurrentProduct({oldRoot,oldSha,candidateRoot,candidateSha,out,version}) {
  for(const p of [oldRoot,candidateRoot,out])assert.ok(isAbsolute(p));assert.match(version,/^\d+\.\d+\.\d+$/);
  const captured={old:new Map(),candidate:new Map()};
  const load=(name,root,shaPin,verify)=>{
    const original=currentProductReader(root),read=path=>{const b=original(path);captured[name].set(path,b);return b;};
    const paths=currentProductPaths(root);const v=verifyInput(read,paths,shaPin,verify);return {...v,read,paths};
  };
  const old=load('old',oldRoot,oldSha,verifyCurrentRelease),candidate=load('candidate',candidateRoot,candidateSha,verifyCurrentReleaseV4);
  const projected=projectFrozenIndex(old.catalog,old.index,candidate.catalog,candidate.index),packages=select(old,candidate,projected);
  // Capture all inputs used by the original notice collectors, including
  // historical composition carriers not read by the product verifier alone.
  const oldPolicy=parse(old.read('catalog/current-v3-license-policy.json'));
  const candidatePolicy=parse(candidate.read('catalog/current-v4-license-policy.json'));
  await collectCurrentDeclaredThirdPartyNotices(old.read('catalog/libs-current-v2.json'),oldPolicy,async p=>old.read(p));
  await collectCurrentDeclaredThirdPartyNoticesV4(candidate.read('catalog/libs-current-v2.json'),candidatePolicy,async p=>candidate.read(p),candidate.paths);
  const common=['LICENSE',...currentProductPaths(candidateRoot,'licenses')];
  for(const path of common)candidate.read(path);
  for(const row of packages){const source=projected.reused.some(x=>x.id===row.id)?old:candidate;
    for(const f of row.files)source.read(f.path);for(const pin of Object.values(row.source))candidate.read(pin.path);}
  await mkdir(out);const put=async(path,b)=>{assert.ok(safe(path));const p=join(out,path);await mkdir(dirname(p),{recursive:true});await writeFile(p,b,{flag:'wx'});};
  const inputs={};for(const [name,source] of [['old',old],['candidate',candidate]]){
    const files=[];for(const [path,b] of [...captured[name]].sort(([a],[b])=>a<b?-1:1)){
      await put(`${prefix}/${name}/${path}`,b);files.push(descriptor(path,b));}
    inputs[name]={files,product_paths:source.paths};
  }
  await put(candidate.catalog.registry.path,candidate.read(candidate.catalog.registry.path));
  for(const path of common)await put(path,candidate.read(path));
  for(const row of packages){const source=projected.reused.some(x=>x.id===row.id)?old:candidate;
    for(const f of row.files)await put(f.path,source.read(f.path));
    for(const pin of Object.values(row.source))await put(pin.path,candidate.read(pin.path));}
  const indexPath='catalog/current-index-v2.json',indexBytes=Buffer.from(JSON.stringify(projected.index)+'\n');await put(indexPath,indexBytes);
  const cohortPath='admission/mixed-current-cohort-v1.json',cohort={schema:'wasmc.mixed-current-cohort/v1',
    old_catalog_sha256:oldSha,candidate_catalog_sha256:candidateSha,inputs,reused:projected.reused,
    common_files:common.map(path=>descriptor(path,candidate.read(path))),public_admission:false};
  const cohortBytes=bytes(cohort);await put(cohortPath,cohortBytes);
  const catalog={schema:'wasmc.public-lib-catalog/v2',version,package_authority_commit:'0'.repeat(40),registry:candidate.catalog.registry,
    index:descriptor(indexPath,indexBytes),cohort:descriptor(cohortPath,cohortBytes),packages};
  const catalogBytes=bytes(catalog);await put('catalog/libs-current-v2.json',catalogBytes);
  await put('catalog/current-mixed-license-policy-v1.json',bytes({schema:'wasmc.current-license-policy/mixed-v1',
    version,catalog_sha256:sha(catalogBytes),package_authority_commit:catalog.package_authority_commit,current_packages:packages.length}));
  const verification=verifyMixedCurrentProduct(out,sha(catalogBytes),oldSha,candidateSha);
  await put('admission/mixed-product-verification-v1.json',bytes(verification));return verification;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [oldRoot,oldSha,candidateRoot,candidateSha,out,version]=process.argv.slice(2);
  assembleMixedCurrentProduct({oldRoot,oldSha,candidateRoot,candidateSha,out,version}).then(r=>console.log(JSON.stringify(r)))
    .catch(e=>{console.error(e);process.exitCode=1;});
}
