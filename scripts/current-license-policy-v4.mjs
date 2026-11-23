import assert from 'node:assert/strict';
import {checkedCurrentCatalog,hash,verifyCurrentReleaseV4} from './current-lib-release-v3.mjs';
const text=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);

// The v4 collector accepts only an independently verified, full v4 cohort.
// It classifies exact notice bytes; it does not infer grants or publication.
export async function collectCurrentDeclaredThirdPartyNoticesV4(catalogBytes,policy,read,productPaths) {
  assert.equal(policy.schema,'wasmc.current-license-policy/v2');
  const catalog=checkedCurrentCatalog(catalogBytes,policy.catalog_sha256);
  assert.equal(catalog.version,policy.version);assert.equal(catalog.package_authority_commit,policy.package_authority_commit);
  assert.equal(catalog.packages.length,policy.current_packages);
  assert.ok(Array.isArray(policy.standard_root_mirrors));
  assert.ok(Array.isArray(productPaths),'independent current Root inventory required');
  const files=new Map();
  const load=async path=>{if(!files.has(path)){const data=await read(path);assert.ok(data instanceof Uint8Array);files.set(path,Buffer.from(data));}return files.get(path);};
  for(const pin of [catalog.registry,catalog.index,catalog.cohort])await load(pin.path);
  await load('LICENSE');
  for(const row of catalog.packages){for(const file of row.files)await load(file.path);for(const pin of Object.values(row.source))await load(pin.path);}
  const cohort=JSON.parse(text(files.get(catalog.cohort.path)));
  assert.equal(cohort.schema,'wasmc.public-current-refresh-cohort/v2');
  const manifestPin=cohort.release_notices?.manifest;assert.ok(manifestPin);
  await load(manifestPin.path);
  for(const pin of cohort.release_notices.files)await load(pin.path);
  const get=path=>{assert.ok(files.has(path),'v4 notice verification input missing: '+path);return files.get(path);};
  const closure=verifyCurrentReleaseV4(catalogBytes,policy.catalog_sha256,get,productPaths);
  assert.equal(closure.schema,'wasmc.current-release-closure/v4');
  const rootLicense=get('LICENSE');assert.equal(hash(rootLicense),cohort.release_license_sha256);
  assert.ok(text(rootLicense).startsWith('WAsmC Research-Only Non-Commercial License 1.0\n'));
  const noticeManifest=JSON.parse(text(get(manifestPin.path)));
  assert.equal(noticeManifest.schema,'wasmc.release-notices-input/v1');assert.deepEqual(noticeManifest.files,cohort.release_notices.files);
  const result=new Map();
  const check=(path,pin,manifestSha)=>{
    const bytes=get(path);assert.equal(bytes.length,pin.bytes);assert.equal(hash(bytes),pin.sha256);
    text(bytes);assert.ok(!bytes.includes(0),'notice contains NUL');
    result.set(path,{bytes:pin.bytes,sha256:pin.sha256,manifest_sha256:manifestSha,catalog_sha256:policy.catalog_sha256});
  };
  for(const pin of noticeManifest.files){
    assert.match(pin.path,/^licenses\/DEPENDENCY-NOTICES-[0-9]{3}\.txt$/);
    check(pin.path,pin,null);
    for(const row of catalog.packages)check(row.root+'/'+pin.path,pin,row.manifest_sha256);
  }
  const seen=new Set();
  for(const mirror of policy.standard_root_mirrors){
    assert.deepEqual(Object.keys(mirror).sort(),['id','root','version']);
    assert.equal(mirror.root,'standard/'+mirror.id+'/'+mirror.version);assert.ok(!seen.has(mirror.root));seen.add(mirror.root);
    const row=catalog.packages.find(p=>p.id===mirror.id&&p.version===mirror.version);assert.ok(row,'standard mirror selected from current catalog');
    const manifest=await load(mirror.root+'/lib.json');assert.equal(hash(manifest),row.manifest_sha256);
    assert.deepEqual(await load(mirror.root+'/LICENSE'),rootLicense);
    for(const pin of noticeManifest.files){await load(mirror.root+'/'+pin.path);check(mirror.root+'/'+pin.path,pin,row.manifest_sha256);}
  }
  return result;
}
