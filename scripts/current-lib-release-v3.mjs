import assert from 'node:assert/strict';
import {readFileSync,lstatSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {witModel,selectedWitRoutes} from './current-wit-routes-v3.mjs';
import {currentIndexEntries as indexEntries,CurrentSearchCaller} from './current-lib-search-v3.mjs';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const commit = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const safe = path => typeof path === 'string' && path && !path.startsWith('/') &&
  !path.includes('\\') && path.split('/').every(x=>x&&x!=='.'&&x!=='..');
const sorted = values => [...values].sort();
const declarations=map=>[...map].map(([name,tokens])=>[name,tokens.map(t=>t.startsWith('%')?t.slice(1):t)]).sort(([a],[b])=>a<b?-1:a>b?1:0);
const decode = bytes => new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const fail = message => {throw Error('current product: '+message);};
const exactKeys = (value,keys) => assert.deepEqual(Object.keys(value).sort(),sorted(keys),'closed current schema');
export function checkedCurrentCatalog(bytes, expectedSha256) {
  assert.ok(digest(expectedSha256));assert.equal(hash(bytes),expectedSha256,'catalog independent pin');
  const catalog=JSON.parse(decode(bytes));
  exactKeys(catalog,['schema','version','package_authority_commit','registry','index','cohort','packages']);
  assert.equal(catalog.schema,'wasmc.public-lib-catalog/v2');
  assert.match(catalog.version,/^\d+\.\d+\.\d+$/);
  assert.ok(commit(catalog.package_authority_commit));
  assert.ok(Array.isArray(catalog.packages)&&catalog.packages.length>0&&catalog.packages.length<=64);
  for(const pin of [catalog.registry,catalog.index,catalog.cohort]){
    exactKeys(pin,['path','bytes','sha256']);assert.ok(safe(pin.path)&&digest(pin.sha256));
    assert.ok(Number.isSafeInteger(pin.bytes)&&pin.bytes>0&&pin.bytes<=2097152);
  }
  let previous='';
  for(const row of catalog.packages){
    exactKeys(row,['id','version','profile','target','root','manifest_sha256','root_inventory_sha256',
      'wit_sha256','wit_world','source','views','delivery','files']);
    assert.match(row.id,/^[a-z][a-z0-9-]*$/);assert.ok(row.id>previous);previous=row.id;
    assert.match(row.version,/^\d+\.\d+\.\d+$/);
    assert.ok(['value','resource','host','native'].includes(row.profile));
    assert.equal(row.root,'current-libs/'+row.id+'/'+row.version);assert.ok(safe(row.root));
    for(const key of ['manifest_sha256','root_inventory_sha256','wit_sha256'])assert.ok(digest(row[key]));
    assert.ok(typeof row.target==='string'&&row.target.length>0&&row.target.length<=128);assert.match(row.wit_world,/^[a-z][a-z0-9-]*$/);exactKeys(row.source,['spec','wit']);
    for(const [key,pin]of Object.entries(row.source)){
      exactKeys(pin,['path','bytes','sha256']);assert.equal(pin.path,'libspec/'+row.id+'/'+(key==='wit'?'lib.wit':'lib.json'));
      assert.ok(digest(pin.sha256)&&Number.isInteger(pin.bytes)&&pin.bytes>0&&pin.bytes<=2097152);
    }
    assert.ok(Array.isArray(row.views)&&row.views.length>0&&row.views.length<=3);
    assert.deepEqual(row.views,sorted(new Set(row.views)));
    exactKeys(row.delivery,['kind','artifact','component','native_status','device_qualified']);
    assert.ok(['wasm-core-component','native-binary','native-module','native-source'].includes(row.delivery.kind));
    assert.equal(row.delivery.device_qualified,false);
    assert.equal(row.profile==='native',row.delivery.kind!=='wasm-core-component');
    const seen=new Set();assert.ok(Array.isArray(row.files)&&row.files.length>0&&row.files.length<=256);
    let last='';
    for(const file of row.files){
      exactKeys(file,['path','bytes','sha256']);
      assert.ok(safe(file.path)&&file.path.startsWith(row.root+'/')&&file.path>last&&!seen.has(file.path));
      last=file.path;seen.add(file.path);assert.ok(digest(file.sha256));
      assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>0&&file.bytes<=16777216);
    }
    for(const name of ['lib.json','lib.wit','LICENSE'])assert.ok(seen.has(row.root+'/'+name),'complete package: '+name);
  }
  return catalog;
}
function pinned(pin,read) {
  assert.ok(safe(pin.path)&&digest(pin.sha256));const bytes=read(pin.path);
  assert.ok(bytes instanceof Uint8Array);assert.equal(bytes.length,pin.bytes);assert.equal(hash(bytes),pin.sha256);
  return bytes;
}
export function verifyCurrentRelease(catalogBytes,catalogSha256,read,productPaths=null) {
  const catalog=checkedCurrentCatalog(catalogBytes,catalogSha256);
  const registry=JSON.parse(decode(pinned(catalog.registry,read)));
  assert.equal(registry.schema,'wasmc.lib-refresh-registry/v2');
  const ids=sorted(registry.libs.map(row=>row.id));assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(catalog.packages.map(row=>row.id),ids,'whole current registry');
  const cohort=JSON.parse(decode(pinned(catalog.cohort,read)));
  assert.equal(cohort.schema,'wasmc.public-current-refresh-cohort/v1');
  assert.equal(cohort.q0_accepted,true);assert.ok(digest(cohort.refresh_receipt_sha256)&&digest(cohort.producer_sha256));
  assert.equal(cohort.public_admission,false);assert.deepEqual(cohort.selected,ids);
  assert.deepEqual(cohort.rows.map(row=>row.id),ids);
  const indexBytes=pinned(catalog.index,read),index=JSON.parse(decode(indexBytes));
  assert.equal(index.schema,'wasmc.current-lib-search-index/v2');
  assert.equal(index.registry_sha256,catalog.registry.sha256);
  assert.deepEqual(index.packages.map(row=>row.package_id).sort(),ids,'full normalized index');
  const maps=new Map(),allFiles=new Set(),models=new Map(),sourceModels=new Map(),specs=new Map();let apis=0;
  for(const row of catalog.packages){
    const model=witModel(read(row.root+'/lib.wit')),previous=models.get(model.identity);
    if(previous){
      assert.deepEqual(declarations(model.interfaces),declarations(previous.interfaces),'same WIT identity must have the same interfaces');
      assert.deepEqual(declarations(model.worlds),declarations(previous.worlds),'same WIT identity must have the same worlds');
    }else models.set(model.identity,model);
  }
  for(const model of models.values())for(const [id,dependency]of model.dependencies){
    const owner=models.get(id);assert.ok(owner,'selected WIT dependency required: '+id);
    assert.deepEqual([...dependency.interfaces.keys()].sort(),[...owner.interfaces.keys()].sort(),'embedded WIT dependency interface names');
    assert.deepEqual([...dependency.worlds.keys()].sort(),[...owner.worlds.keys()].sort(),'embedded WIT dependency world names');
    for(const world of dependency.worlds.keys())assert.deepEqual(
      [...selectedWitRoutes(dependency,world,models).routes].sort(),[...selectedWitRoutes(owner,world,models).routes].sort(),
      'embedded WIT dependency canonical API signatures');
  }
  assert.deepEqual(cohort.wit_normalizations.map(p=>p.id),ids,'complete Q0 WIT closure evidence');
  for(const row of catalog.packages){
    const spec=JSON.parse(decode(pinned(row.source.spec,read))),wit=pinned(row.source.wit,read);
    assert.equal(spec.schema,'wasmc.lib-refresh-source/v2');assert.equal(spec.id,row.id);
    assert.equal(spec.version,row.version);assert.equal(spec.profile,row.profile);assert.equal(spec.world,row.wit_world);
    for(const pin of Object.values(row.source))assert.equal(cohort.source_inputs[pin.path],pin.sha256,'Q0 source identity');
    specs.set(row.id,spec);sourceModels.set(row.id,witModel(wit));
    const proof=cohort.wit_normalizations.find(p=>p.id===row.id);
    assert.equal(proof.authored_sha256,row.source.wit.sha256);assert.equal(proof.delivered_sha256,row.wit_sha256);
    if(proof.mode==='exact-bytes'){assert.equal(proof.authored_sha256,proof.delivered_sha256);assert.equal(proof.normalized_sha256,null);}
    else{assert.equal(proof.mode,'standard-tool-normalization');assert.equal(proof.normalized_sha256,proof.delivered_sha256);assert.equal(proof.tool_sha256,cohort.wit_tool_sha256);}
    for(const dep of proof.dependencies){const selected=catalog.packages.find(p=>p.id===dep.id);assert.ok(selected);assert.equal(dep.sha256,selected.source.wit.sha256);}
  }
  const rootLicense=read('LICENSE'),licenseSha=hash(rootLicense);
  const noticeInput=cohort.release_notices;assert.ok(noticeInput,'explicit original dependency notices required');
  const noticeManifest=JSON.parse(decode(pinned(noticeInput.manifest,read)));
  assert.equal(noticeManifest.schema,'wasmc.release-notices-input/v1');
  assert.deepEqual(noticeInput.files,noticeManifest.files);assert.ok(noticeInput.files.length>0&&noticeInput.files.length<=31);
  assert.equal(cohort.source_inputs[noticeInput.manifest.path],noticeInput.manifest.sha256,'Q0 notice manifest source pin');
  let noticePrevious='',noticeTotal=rootLicense.length;
  for(const pin of noticeInput.files){
    assert.match(pin.path,/^licenses\/[A-Za-z0-9_.-]{1,128}$/);assert.ok(pin.path>noticePrevious);noticePrevious=pin.path;
    assert.ok(pin.bytes>0&&pin.bytes<=262144);pinned(pin,read);noticeTotal+=pin.bytes;
    assert.equal(cohort.source_inputs[pin.path],pin.sha256,'Q0 notice file source pin');
  }
  assert.ok(noticeTotal<=2097152);

  assert.equal(cohort.release_license_sha256,licenseSha);assert.equal(index.source_fingerprint,cohort.source_fingerprint);
  for(const row of catalog.packages){
    const output=new Map(),local={};
    for(const file of row.files){
      const bytes=pinned(file,read);output.set(file.path,bytes);
      local[file.path.slice(row.root.length+1)]={bytes:file.bytes,sha256:file.sha256};allFiles.add(file.path);
    }
    assert.equal(hash(JSON.stringify(local)),row.root_inventory_sha256,'whole root independently sealed');
    const proof=cohort.rows.find(v=>v.id===row.id);
    assert.equal(proof.version,row.version);assert.equal(proof.profile,row.profile);
    assert.equal(proof.manifest_sha256,row.manifest_sha256);
    assert.equal(proof.root_inventory_sha256,row.root_inventory_sha256,'Q0 whole-root pin');
    const manifestBytes=output.get(row.root+'/lib.json'),m=JSON.parse(decode(manifestBytes));
    assert.equal(hash(manifestBytes),row.manifest_sha256);
    assert.equal(m.id,row.id);assert.equal(m.version,row.version);
    assert.equal(m.schema,row.profile==='native'?'wasmc.lib-native/v2':'wasmc.lib/v2');
    assert.equal(m.wit.path,'lib.wit');assert.equal(m.wit.sha256,row.wit_sha256);
    assert.equal(hash(output.get(row.root+'/lib.wit')),row.wit_sha256);
    assert.deepEqual(sorted(Object.keys(m.bindings)),row.views);
    const license=m.license;assert.equal(license?.schema,'wasmc.lib-license/v1');
    assert.equal(license.identifier,'WAsmC Research-Only Non-Commercial License 1.0');
    assert.deepEqual(license.files,[{path:'LICENSE',bytes:rootLicense.length,sha256:licenseSha},...noticeInput.files]);
    assert.equal(hash(output.get(row.root+'/LICENSE')),licenseSha,'root license exact snapshot');
    for(const binding of Object.values(m.bindings)){
      if(!binding.cargo_toml)continue;
      const path=binding.cargo_toml.path;assert.match(path,/^bindings\/[^/]+\/Cargo\.toml$/);
      const cargo=output.get(row.root+'/'+path);assert.ok(cargo);
      assert.equal(hash(cargo),binding.cargo_toml.sha256,'actual SDK Cargo binding');
      const source=decode(cargo);
      assert.match(source,/^license-file\s*=\s*"\.\.\/\.\.\/LICENSE"\s*$/m);
      assert.ok(!/^license\s*=/m.test(source),'no contradictory SDK grant');
      assert.equal(source.match(/^license-file\s*=/gm)?.length,1);
    }
    const descriptor=(file,actual)=>{
      if(file==null){assert.equal(actual,null);return;}
      const bytes=output.get(row.root+'/'+file.path);assert.ok(bytes);
      assert.equal(hash(bytes),file.sha256);
      assert.equal(bytes.length,file.bytes);
      assert.deepEqual(actual,{path:file.path,bytes:file.bytes,sha256:file.sha256});
    };
    descriptor(m.artifact??null,row.delivery.artifact);descriptor(m.component??null,row.delivery.component);
    const p=index.packages.find(v=>v.package_id===row.id);
    assert.equal(p.version,row.version);assert.equal(p.profile,row.profile);assert.equal(p.target,row.target);
    assert.equal(p.wit_sha256,row.source.wit.sha256);const packageModel=witModel(output.get(row.root+'/lib.wit'));assert.equal(p.wit_route,packageModel.identity);if(m.wit.package!==undefined)assert.equal(m.wit.package,packageModel.identity);if(m.wit.world!==undefined)assert.equal(m.wit.world,row.wit_world);
    assert.equal(p.source_path,'libspec/'+row.id+'/lib.wit');
    const model=models.get(packageModel.identity);assert.ok(model&&model.identity.endsWith('@'+row.version));
    const routes=selectedWitRoutes(model,row.wit_world,models);
    const authored=sourceModels.get(row.id);assert.equal(authored.identity,model.identity);
    assert.deepEqual([...selectedWitRoutes(authored,row.wit_world,models).routes].sort(),[...routes.routes].sort(),'authored and delivered selected-world API signatures');
    assert.deepEqual(p.apis.map(x=>x.route).sort(),[...routes.routes.keys()].map(x=>x.slice(model.identity.length+1)).sort(),'exact selected-world WIT API routes');
    assert.equal(p.delivery.manifest_sha256,row.manifest_sha256);
    assert.equal(p.delivery.receipt_sha256,cohort.refresh_receipt_sha256);
    assert.equal(p.delivery.artifact_kind,row.delivery.kind);
    assert.equal(p.delivery.artifact_sha256,m.artifact?.sha256??null);
    assert.equal(p.delivery.artifact_path,m.artifact?.path??null);
    assert.equal(proof.artifact_sha256??null,m.artifact?.sha256??null);assert.equal(proof.component_sha256??null,m.component?.sha256??null);
    assert.equal(p.delivery.component_sha256,m.component?.sha256??null);
    if(row.profile==='native'){
      assert.equal(m.native.wasm_lowered,false);assert.equal(m.native.device_qualified,false);
      assert.equal(m.native.status,row.delivery.native_status);
      assert.equal(m.native.target,row.target);assert.equal(m.lifecycle.runtime_qualified,false);
      assert.equal(m.lifecycle.admitted,false);
    }else assert.equal(row.delivery.native_status,null);
    assert.ok(Array.isArray(p.apis));apis+=p.apis.length;
    maps.set(row.id,{row,manifest:m,bytes:output});
  }
  if(productPaths){
    const actual=sorted([...productPaths].filter(path=>path.startsWith('current-libs/')));
    assert.deepEqual(actual,sorted(allFiles),'no unselected or hidden current packages');
  }
  const entries=indexEntries(index);assert.equal(entries.length,ids.length+apis);
  const selected=maps.get('wasmc-lib-search');assert.ok(selected);
  const artifact=selected.bytes.get(selected.row.root+'/artifact.wasm');
  const abi=JSON.parse(decode(selected.bytes.get(selected.row.root+'/core-abi.json')));
  const caller=new CurrentSearchCaller(indexBytes,artifact,selected.bytes.get(selected.row.root+'/core-abi.json'));
  assert.deepEqual(caller.snapshot(),{tag:'ok',value:{entry_count:entries.length,package_count:ids.length,
    api_count:apis,bound_package_count:ids.length,registry_sha256:catalog.registry.sha256,index_sha256:catalog.index.sha256}});
  for(const entry of entries)assert.deepEqual(caller.lookup(entry.identity),{tag:'ok',value:entry});
  const pages=[];
  for(let offset=0;offset<entries.length;offset+=64){
    const page=caller.search({text:'',package_id:null,profile:null,bound_only:false},offset,64);
    assert.equal(page.tag,'ok');pages.push(...page.value);
  }
  assert.deepEqual(pages,entries);
  return {schema:'wasmc.current-release-closure/v3',catalog_sha256:catalogSha256,
    registry_sha256:catalog.registry.sha256,index_sha256:catalog.index.sha256,
    cohort_sha256:catalog.cohort.sha256,refresh_receipt_sha256:cohort.refresh_receipt_sha256,
    producer_sha256:cohort.producer_sha256,release_packages:ids.length,api_routes:apis,
    package_routes:ids.length,entries:entries.length,native_source_packages:catalog.packages.filter(r=>r.delivery.kind==='native-source').length,
    exact:true,candidate_extras:0,license_snapshots_exact:true,sdk_cargo_license_bound:true,original_dependency_notices_exact:true,
    actual_Core_Search_snapshot_lookup_pagination:true,device_qualified:false,
    public_release_admission:false};
}
export function selectCurrentPackage(bytes,catalogSha256,request) {
  const catalog=checkedCurrentCatalog(bytes,catalogSha256);
  assert.ok(request&&digest(request.manifest_sha256)&&digest(request.root_inventory_sha256));
  const rows=catalog.packages.filter(row=>row.id===request.id&&row.version===request.version);
  assert.equal(rows.length,1,'exact package id/version required');const row=rows[0];
  assert.equal(row.manifest_sha256,request.manifest_sha256);
  assert.equal(row.root_inventory_sha256,request.root_inventory_sha256);
  return {catalog,row};
}
export function resolveCurrentPackage(bytes,catalogSha256,request,read) {
  const {catalog,row}=selectCurrentPackage(bytes,catalogSha256,request);
  for(const file of row.files)pinned(file,read);
  return {schema:'wasmc.public-lib-lock/v2',catalog_sha256:catalogSha256,release_version:catalog.version,
    artifact_commit:catalog.package_authority_commit,id:row.id,version:row.version,
    profile:row.profile,target:row.target,manifest_sha256:row.manifest_sha256,
    root_inventory_sha256:row.root_inventory_sha256,root:row.root,delivery:row.delivery,
    files:row.files,verified:true,authority_granted:false,engine_admission:'separate'};
}

export function searchCurrentRelease(catalogBytes,catalogSha256,read,selection,offset=0,limit=64,productPaths=null){
  verifyCurrentRelease(catalogBytes,catalogSha256,read,productPaths);
  const catalog=checkedCurrentCatalog(catalogBytes,catalogSha256),row=catalog.packages.find(r=>r.id==='wasmc-lib-search');
  const caller=new CurrentSearchCaller(pinned(catalog.index,read),read(row.root+'/artifact.wasm'),read(row.root+'/core-abi.json'));
  return {schema:'wasmc.public-current-lib-search/v3',catalog_sha256:catalogSha256,index_sha256:catalog.index.sha256,
    selection_authority:false,offset,limit,result:caller.search(selection,offset,limit)};
}

export function currentProductReader(root){
  root=resolve(root);const info=lstatSync(root);assert.ok(info.isDirectory()&&!info.isSymbolicLink(),'regular product root');
  return path=>{
    assert.ok(safe(path),'safe product path');let current=root;
    for(const part of path.split('/')){current=join(current,part);assert.ok(!lstatSync(current).isSymbolicLink(),'linked product input');}
    const s=lstatSync(current);assert.ok(s.isFile()&&s.size>0&&s.size<=16777216,'bounded regular product input');return readFileSync(current);
  };
}
export function currentProductPaths(root,prefix='current-libs'){
  root=resolve(root);assert.ok(safe(prefix));let count=0;
  const walk=path=>{
    const info=lstatSync(join(root,path));assert.ok(!info.isSymbolicLink(),'linked product inventory');
    if(info.isDirectory())return readdirSync(join(root,path)).sort().flatMap(n=>walk(path+'/'+n));
    assert.ok(info.isFile()&&++count<=10000,'bounded regular product inventory');return[path];
  };
  return walk(prefix).sort();
}
