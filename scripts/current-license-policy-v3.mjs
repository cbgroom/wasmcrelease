import assert from 'node:assert/strict';
import {checkedCurrentCatalog,hash,verifyCurrentRelease} from './current-lib-release-v3.mjs';
import {verifyCurrentCompositionLineageData} from './current-lib-source-custody-v1.mjs';
const text=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
// Reviewed historical delivery input, not a permission or a current selection.
// Its full original composition and source custody must still verify below.
export const historicalNoticeCompositions=Object.freeze([Object.freeze({
  cohort:Object.freeze({path:'admission/ordinary-canonical-host-v024/historical-composition-005-cohort-v1.json',bytes:615518,
    sha256:'1f782e36252f280f6c21a4ef092ddfcb16d021b5b38bfb7b81112d4fde0d9f8a'}),
  roots:Object.freeze([Object.freeze({locator:'standard/wasmc-json/0.0.5',
    manifest_sha256:'3bfaa6449d8800aaa98a7068ceccaae3527490f6cb7773b53b70195e9c7eaadc',
    inventory_sha256:'c4adbe3a37e49d028c7f0a8351bab2686ef26ae154549068b4bb1a8b1b39e63c'})])
})]);
export function historicalNoticeCarrierPins(record,cohort){
  assert.equal(cohort.schema,'wasmc.public-current-composition-cohort/v1');
  assert.deepEqual(cohort.source_lineage.admitted_original_sources.map(({source})=>({locator:source.root.locator,
    manifest_sha256:source.root.manifest_sha256,inventory_sha256:source.root.inventory_sha256})),record.roots);
  return cohort.source_lineage.admitted_original_sources.flatMap(({source})=>[...source.root.files,...source.source_packet.files]);
}
export function requiredHistoricalNoticeCompositions(cohort){
  if(cohort.schema!=='wasmc.public-current-composition-cohort/v1')return [];
  const active=cohort.source_lineage.admitted_original_sources.map(({source})=>source.root);
  return historicalNoticeCompositions.filter(record=>!record.roots.every(root=>active.some(value=>
    value.locator===root.locator&&value.manifest_sha256===root.manifest_sha256&&value.inventory_sha256===root.inventory_sha256)));
}
export function historicalNoticeProductInputs(cohort,read){
  const paths=[];
  for(const record of requiredHistoricalNoticeCompositions(cohort)){
    const bytes=read(record.cohort.path);assert.equal(bytes.length,record.cohort.bytes);assert.equal(hash(bytes),record.cohort.sha256);
    for(const pin of [record.cohort,...historicalNoticeCarrierPins(record,JSON.parse(text(bytes)))]){
      const b=read(pin.path);assert.equal(b.length,pin.bytes);assert.equal(hash(b),pin.sha256);paths.push(pin.path);
    }
  }
  return paths;
}
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
  if(cohort.schema==='wasmc.public-current-composition-cohort/v1'||catalog.cohort.path==='admission/current-composition-cohort-v1.json'){
    assert.equal(cohort.schema,'wasmc.public-current-composition-cohort/v1','composition cohort cannot impersonate full Q0');
    return collectComposedNotices(catalogBytes,catalog,policy,read,cohort);
  }
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

// Snapshot the declared graph for the synchronous product verifier. Reading a
// declaration grants no notice exemption: the entire original base, current
// Root/source lineage, WIT and Core Search must verify before any row is used.
async function collectComposedNotices(catalogBytes,catalog,policy,read,cohort){
  const prefix='admission/current-composition-inputs-v1',data=new Map();
  const safe=p=>typeof p==='string'&&p&&!p.startsWith('/')&&!p.includes('\\')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
  assert.equal(cohort.input_prefix,prefix);assert.ok(Array.isArray(cohort.input_files)&&cohort.input_files.length>0&&cohort.input_files.length<=10000);
  const load=async path=>{assert.ok(safe(path));if(!data.has(path)){const b=await read(path);assert.ok(b instanceof Uint8Array);data.set(path,Buffer.from(b));}return data.get(path);};
  const get=path=>{assert.ok(data.has(path),'missing composed notice proof input '+path);return data.get(path);};
  for(const pin of cohort.input_files){assert.ok(safe(pin.path));await load(prefix+'/'+pin.path);}
  for(const pin of [catalog.registry,catalog.index,catalog.cohort])await load(pin.path);
  await load('LICENSE');
  for(const pin of cohort.input_files)if(pin.path.startsWith('licenses/'))await load(pin.path);
  for(const row of catalog.packages){
    for(const pin of row.files)await load(pin.path);
    for(const pin of Object.values(row.source))await load(pin.path);
    const spec=JSON.parse(text(get(row.source.spec.path)));
    if(spec.schema==='wasmc.lib-refresh-source/v2'){
      const directory=row.source.spec.path.slice(0,-'/lib.json'.length);
      for(const pin of cohort.input_files)if(pin.path.startsWith(directory+'/'))await load(pin.path);
    }
  }
  for(const {source} of cohort.source_lineage.admitted_original_sources)
    for(const pin of [...source.root.files,...source.source_packet.files])await load(pin.path);
  const closure=verifyCurrentRelease(catalogBytes,policy.catalog_sha256,get,[...data.keys()]);
  assert.equal(closure.schema,'wasmc.current-composition-release-closure/v1');
  assert.equal(closure.fresh_full_q0,false);assert.equal(closure.original_receipt_bytes_verified,false);
  const baseOptions=cohort.input_options.base,baseBytes=get(prefix+'/'+baseOptions.catalog_path);
  const base=checkedCurrentCatalog(baseBytes,baseOptions.catalog_sha256);
  const baseRead=async path=>path.startsWith('standard/')?read(path):get(prefix+'/'+path);
  const basePolicy={...policy,version:base.version,catalog_sha256:baseOptions.catalog_sha256,package_authority_commit:base.package_authority_commit};
  const baseRows=await collectCurrentDeclaredThirdPartyNotices(baseBytes,basePolicy,baseRead),result=new Map();
  const currentFiles=new Set(catalog.packages.flatMap(row=>row.files.map(pin=>pin.path)));
  for(const [path,pin]of baseRows){
    const row={...pin,catalog_sha256:policy.catalog_sha256};
    if(path.startsWith('standard/')||!path.startsWith('current-libs/')||currentFiles.has(path))result.set(path,row);
    if(!path.startsWith('standard/'))result.set(prefix+'/'+path,row);
  }
  const contexts=cohort.source_lineage.admitted_original_sources.map(({source})=>{
    const row=catalog.packages.find(p=>p.id===source.id);assert.ok(row);
    return {source,row,read:get,specPath:prefix+'/'+source.source_spec.path,
      roots:[row.root,prefix+'/'+source.root.locator,source.root.locator],packetPrefixes:['',prefix+'/']};
  });
  contexts.push(...await historicalNoticeContexts(cohort,read,get));
  for(const context of contexts){
    const {source,row,read:get,specPath,roots,packetPrefixes}=context;
    const raw=get(row.root+'/lib.json'),manifest=JSON.parse(text(raw)),spec=JSON.parse(text(get(specPath)));
    assert.deepEqual(manifest.license,spec.license,'original producer license declaration');
    const license=manifest.license;assert.equal(license.schema,'wasmc.lib-license/v1');
    assert.equal(license.identifier,'WAsmC Research-Only Non-Commercial License 1.0');
    assert.ok(Array.isArray(license.files)&&license.files.length>1&&license.files.length<=32);
    assert.deepEqual(license.files[0],{path:'LICENSE',bytes:get('LICENSE').length,sha256:hash(get('LICENSE'))});
    let previous='',total=0;
    for(const pin of license.files){
      assert.deepEqual(Object.keys(pin).sort(),['bytes','path','sha256']);
      assert.ok(Number.isSafeInteger(pin.bytes)&&pin.bytes>0&&pin.bytes<=262144);assert.match(pin.sha256,/^[0-9a-f]{64}$/);
      if(pin.path!=='LICENSE')assert.match(pin.path,/^licenses\/DEPENDENCY-NOTICES-[0-9]{3}\.txt$/);
      assert.ok(pin.path>previous,'ordered unique original producer license files');previous=pin.path;total+=pin.bytes;
      const aliases=roots.map(root=>root+'/'+pin.path);
      const sourcePath=source.source_packet.root+'/'+pin.path;
      const sourcePin=source.source_packet.files.find(file=>file.path===sourcePath);
      if(sourcePin){assert.deepEqual(sourcePin,{path:sourcePath,bytes:pin.bytes,sha256:pin.sha256},'declared exact source notice alias');
        aliases.push(...packetPrefixes.map(prefix=>prefix+sourcePath));}
      for(const path of aliases){
        const bytes=get(path);assert.equal(bytes.length,pin.bytes);assert.equal(hash(bytes),pin.sha256);
        text(bytes);assert.ok(!bytes.includes(0),'notice text contains NUL');
        if(pin.path!=='LICENSE')result.set(path,{bytes:pin.bytes,sha256:pin.sha256,manifest_sha256:hash(raw),catalog_sha256:policy.catalog_sha256});
      }
    }
    assert.ok(total<=2097152);
    for(const key of ['rust_core','rust_component']){
      const sdk=manifest.bindings?.[key];if(!sdk)continue;assert.ok(sdk.cargo_toml&&typeof sdk.cargo_toml.path==='string');
      const bytes=get(row.root+'/'+sdk.cargo_toml.path);assert.equal(hash(bytes),sdk.cargo_toml.sha256);const cargo=text(bytes);
      assert.equal(cargo.match(/^license-file\s*=/gm)?.length,1);assert.match(cargo,/^license-file\s*=\s*"\.\.\/\.\.\/LICENSE"\s*$/m);
      assert.ok(!/^license\s*=/m.test(cargo));
    }
  }
  return result;
}

async function historicalNoticeContexts(current,read,baseGet){
  const contexts=[];
  for(const record of requiredHistoricalNoticeCompositions(current)){
    const raw=await read(record.cohort.path);assert.equal(raw.length,record.cohort.bytes);assert.equal(hash(raw),record.cohort.sha256,'independent historical composition identity');
    const historical=JSON.parse(text(raw)),carriers=historicalNoticeCarrierPins(record,historical);
    assert.equal(historical.fresh_full_q0,false);assert.equal(historical.public_admission,false);
    assert.deepEqual(historical.input_options.base,current.input_options.base,'same exact original full-base authority');
    const carrierPaths=new Set(carriers.map(pin=>pin.path)),snapshot=new Map();
    for(const pin of historical.input_files){
      const bytes=carrierPaths.has(pin.path)?await read(pin.path):baseGet(current.input_prefix+'/'+pin.path);
      assert.equal(bytes.length,pin.bytes);assert.equal(hash(bytes),pin.sha256,'historical original input bytes');snapshot.set(pin.path,bytes);
    }
    const get=path=>{assert.ok(snapshot.has(path),'historical composition input missing');return snapshot.get(path);};
    const input={read:get,paths:root=>[...snapshot.keys()].filter(path=>path.startsWith(root+'/')).sort()};
    const {composeCurrentLibData}=await import('./lib-current-composition-v1.mjs');
    assert.deepEqual(composeCurrentLibData(input,historical.input_options),historical.composition,'actual historical whole-Root composition');
    verifyCurrentCompositionLineageData(input,historical.input_options,historical.composition,historical.composition_sha256,
      historical.source_lineage,{checkedCurrentCatalog,verifyCurrentRelease});
    for(const {source} of historical.source_lineage.admitted_original_sources)
      contexts.push({source,row:{root:source.root.locator},read:get,specPath:source.source_spec.path,roots:[source.root.locator],packetPrefixes:[]});
  }
  return contexts;
}
