import assert from 'node:assert/strict';
import {checkedCurrentCatalog,hash} from './current-lib-release-v3.mjs';
const text=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
export async function collectCurrentDeclaredThirdPartyNotices(catalogBytes,policy,read) {
  assert.equal(policy.schema,'wasmc.current-license-policy/v1');
  const catalog=checkedCurrentCatalog(catalogBytes,policy.catalog_sha256);
  assert.equal(catalog.package_authority_commit,policy.package_authority_commit);
  assert.equal(catalog.packages.length,42);
  assert.equal(catalog.version,policy.version);
  const exact=async pin=>{
    const bytes=await read(pin.path);
    assert.ok(bytes instanceof Uint8Array);
    assert.equal(bytes.length,pin.bytes,'notice input size');
    assert.equal(hash(bytes),pin.sha256,'notice input digest');
    text(bytes);assert.ok(!Buffer.from(bytes).includes(0),'notice text contains NUL');
    return bytes;
  };
  const cohort=JSON.parse(text(await exact(catalog.cohort)));
  const notices=cohort.release_notices;
  assert.ok(notices?.manifest&&Array.isArray(notices.files));
  const manifest=JSON.parse(text(await exact(notices.manifest)));
  assert.equal(manifest.schema,'wasmc.release-notices-input/v1');
  assert.deepEqual(manifest.files,notices.files);
  assert.equal(cohort.source_inputs[notices.manifest.path],notices.manifest.sha256);
  assert.ok(notices.files.length>0&&notices.files.length<=31);
  const licenseBytes=await read('LICENSE');
  assert.equal(hash(licenseBytes),cohort.release_license_sha256);
  assert.ok(text(licenseBytes).startsWith('WAsmC Research-Only Non-Commercial License 1.0\n'));
  const result=new Map();let total=licenseBytes.length;
  for(const pin of notices.files) {
    assert.match(pin.path,/^licenses\/DEPENDENCY-NOTICES-[0-9]{3}\.txt$/);
    assert.ok(Number.isSafeInteger(pin.bytes)&&pin.bytes>0&&pin.bytes<=262144);
    assert.equal(cohort.source_inputs[pin.path],pin.sha256);
    await exact(pin);total+=pin.bytes;
    assert.ok(!result.has(pin.path));result.set(pin.path,{bytes:pin.bytes,sha256:pin.sha256,catalog_sha256:policy.catalog_sha256});
  }
  assert.ok(total<=2097152);
  const expected=[{path:'LICENSE',bytes:licenseBytes.length,sha256:hash(licenseBytes)},...notices.files];
  for(const row of catalog.packages) {
    const files=new Map(row.files.map(pin=>[pin.path,pin]));
    const bound=async path=>{const pin=files.get(path);assert.ok(pin,'complete licensed Root file');return exact(pin);};
    const raw=await bound(row.root+'/lib.json');
    assert.equal(hash(raw),row.manifest_sha256);
    const m=JSON.parse(text(raw));assert.equal(m.id,row.id);assert.equal(m.version,row.version);
    assert.equal(m.schema,row.delivery.kind==='wasm-core-component'?'wasmc.lib/v2':'wasmc.lib-native/v2');
    assert.equal(m.license?.schema,'wasmc.lib-license/v1');
    assert.equal(m.license.identifier,'WAsmC Research-Only Non-Commercial License 1.0');
    assert.deepEqual(m.license.files,expected);
    for(const pin of expected) {
      const path=row.root+'/'+pin.path;const bytes=await bound(path);
      assert.equal(bytes.length,pin.bytes);assert.equal(hash(bytes),pin.sha256);
      if(pin.path!=='LICENSE')result.set(path,{bytes:pin.bytes,sha256:pin.sha256,manifest_sha256:hash(raw),catalog_sha256:policy.catalog_sha256});
    }
    for(const key of ['rust_core','rust_component']) {
      const sdk=m.bindings?.[key];if(!sdk)continue;
      assert.ok(sdk.cargo_toml&&typeof sdk.cargo_toml.path==='string');
      const cargo=await bound(row.root+'/'+sdk.cargo_toml.path);
      assert.equal(hash(cargo),sdk.cargo_toml.sha256);
      const source=text(cargo);
      assert.equal(source.match(/^license-file\s*=/gm)?.length,1);
      assert.match(source,/^license-file\s*=\s*"\.\.\/\.\.\/LICENSE"\s*$/m);
      assert.ok(!/^license\s*=/m.test(source));
    }
  }
  assert.deepEqual(policy.standard_root_mirrors,[
    {root:'standard/wasmc-std/1.4.1',id:'wasmc-std',version:'1.4.1'},
    {root:'standard/wasmc-lib-search/0.5.0',id:'wasmc-lib-search',version:'0.5.0'},
  ]);
  for(const mirror of policy.standard_root_mirrors) {
    const row=catalog.packages.find(p=>p.id===mirror.id&&p.version===mirror.version);
    assert.ok(row,'selected standard Root mirror');
    const rootBytes=await read(mirror.root+'/lib.json');
    assert.equal(hash(rootBytes),row.manifest_sha256,'standard mirror manifest');
    for(const pin of expected) {
      const path=mirror.root+'/'+pin.path,bytes=await read(path);
      assert.equal(bytes.length,pin.bytes);assert.equal(hash(bytes),pin.sha256,'standard mirror snapshot');
      if(pin.path!=='LICENSE')result.set(path,{bytes:pin.bytes,sha256:pin.sha256,manifest_sha256:hash(rootBytes),catalog_sha256:policy.catalog_sha256});
    }
  }
  return result;
}
