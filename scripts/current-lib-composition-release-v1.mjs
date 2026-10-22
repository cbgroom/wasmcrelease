// A separate closed cohort for original-producer composition. The legacy
// full-refresh branch is supplied explicitly and is never replaced by trust
// in a composition receipt. No compiler or unchanged Root is rebuilt here.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readdir,readFile} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {sha,digest,inventory} from './lib-refresh-cache-v2.mjs';
import {verifyCurrentCompositionLineageData} from './current-lib-source-custody-v1.mjs';
import {CurrentSearchCaller,currentIndexEntries} from './current-lib-search-v3.mjs';
import {witModel,selectedWitRoutes} from './current-wit-routes-v3.mjs';
const prefix='admission/current-composition-inputs-v1';
const sorted=values=>[...values].sort();
const exact=(value,keys)=>assert.deepEqual(Object.keys(value).sort(),sorted(keys),'closed composition product schema');
const safe=p=>typeof p==='string'&&p&&!p.startsWith('/')&&!p.includes('\\')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
const parse=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
const jsonBytes=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const checkPin=pin=>{exact(pin,['path','bytes','sha256']);assert.ok(safe(pin.path));assert.match(pin.sha256,/^[0-9a-f]{64}$/);assert.ok(Number.isInteger(pin.bytes)&&pin.bytes>0&&pin.bytes<=16777216);};
const readPin=(pin,read)=>{checkPin(pin);const b=read(pin.path);assert.ok(b instanceof Uint8Array);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256);return b;};
const pinFor=(path,b)=>({path,bytes:b.length,sha256:sha(b)});
function graphReader(cohort,read,productPaths){
  assert.equal(cohort.input_prefix,prefix);assert.ok(Array.isArray(cohort.input_files)&&cohort.input_files.length>0&&cohort.input_files.length<=10000);
  const pins=new Map();let previous='';
  for(const pin of cohort.input_files){checkPin(pin);assert.ok(pin.path>previous);previous=pin.path;pins.set(pin.path,pin);readPin({...pin,path:prefix+'/'+pin.path},read);}
  if(productPaths?.some(p=>p.startsWith(prefix+'/')))assert.deepEqual(sorted(productPaths.filter(p=>p.startsWith(prefix+'/'))),cohort.input_files.map(p=>prefix+'/'+p.path));
  return {read:path=>{assert.ok(pins.has(path),'undeclared original input');return readPin({...pins.get(path),path:prefix+'/'+path},read);},
    paths:root=>[...pins.keys()].filter(p=>p.startsWith(root+'/')).sort()};
}
function expectedIndex(input,catalog,lineage,composition,options){
  const index=parse(input.read(catalog.index.path)),selected={};
  const packages=index.packages.map(row=>structuredClone(row));
  for(const original of catalog.packages){
    if(options.reused_ids.includes(original.id)){
      const directory=original.source.spec.path.slice(0,-'/lib.json'.length);
      for(const path of input.paths(directory))selected[path]=sha(input.read(path));
    }
  }
  for(const admitted of lineage.admitted_original_sources){
    const s=admitted.source,root=composition.rows.find(row=>row.id===s.id),manifest=parse(input.read(root.root+'/lib.json'));
    const model=witModel(input.read(s.wit.path)),routes=selectedWitRoutes(model,s.world,new Map([[model.identity,model]]));
    for(const pin of s.source_packet.files)selected[pin.path]=pin.sha256;
    const p=packages.findIndex(row=>row.package_id===s.id);
    packages[p]={package_id:s.id,version:s.version,profile:s.profile,target:manifest.build.target,
      source_path:'libspec/'+s.id+'/lib.wit',wit_sha256:s.wit.sha256,
      delivery:{manifest_sha256:s.root.manifest_sha256,receipt_sha256:digest(composition),artifact_kind:'wasm-core-component',
        artifact_path:manifest.artifact.path,artifact_sha256:manifest.artifact.sha256,component_sha256:manifest.component.sha256},
      wit_route:model.identity,description:s.description,
      apis:[...routes.routes.keys()].sort().map(route=>({route:route.slice(model.identity.length+1),description:s.apis.find(api=>api.api===route.split('#')[1]).delta}))};
  }
  packages.sort((a,b)=>(a.package_id+'@'+a.version)<(b.package_id+'@'+b.version)?-1:1);
  return {schema:'wasmc.current-lib-search-index/v2',registry_sha256:catalog.registry.sha256,
    source_fingerprint:digest(Object.fromEntries(Object.entries(selected).sort(([a],[b])=>a<b?-1:1))),packages};
}
export function verifyComposedCurrentRelease(catalogBytes,catalogSha256,read,productPaths,baseVerification){
  assert.equal(typeof baseVerification?.verifyCurrentRelease,'function');
  const catalog=baseVerification.checkedCurrentCatalog(catalogBytes,catalogSha256);
  const cohort=parse(readPin(catalog.cohort,read));
  exact(cohort,['schema','accepted','input_prefix','input_files','input_options','composition','composition_sha256',
    'source_lineage','source_lineage_sha256','fresh_full_q0','public_admission']);
  assert.equal(cohort.schema,'wasmc.public-current-composition-cohort/v1');assert.equal(cohort.accepted,true);
  assert.equal(cohort.fresh_full_q0,false);assert.equal(cohort.public_admission,false);
  const input=graphReader(cohort,read,productPaths),options=cohort.input_options,composition=cohort.composition;
  const base=baseVerification.checkedCurrentCatalog(input.read(options.base.catalog_path),options.base.catalog_sha256);
  assert.equal(parse(input.read(base.cohort.path)).schema,'wasmc.public-current-refresh-cohort/v1','original full-refresh base required');
  const baseClosure=baseVerification.verifyCurrentRelease(input.read(options.base.catalog_path),options.base.catalog_sha256,input.read,input.paths('current-libs'));
  assert.equal(digest(cohort.source_lineage),cohort.source_lineage_sha256,'independent current source lineage pin');
  verifyCurrentCompositionLineageData(input,options,composition,cohort.composition_sha256,cohort.source_lineage,baseVerification);
  const registry=readPin(catalog.registry,read);assert.deepEqual(registry,input.read(base.registry.path),'current identity registry is unchanged');
  const ids=base.packages.map(row=>row.id);assert.deepEqual(catalog.packages.map(row=>row.id),ids);
  const indexBytes=readPin(catalog.index,read),index=parse(indexBytes);
  assert.deepEqual(index,expectedIndex(input,base,cohort.source_lineage,composition,options),'complete current source/WIT/index binding');
  const currentFiles=[];let rootFiles=0;
  for(const row of catalog.packages){
    const original=base.packages.find(p=>p.id===row.id),source=cohort.source_lineage.admitted_original_sources.find(p=>p.source.id===row.id);
    const composed=composition.rows.find(p=>p.id===row.id),local={};
    if(!source){assert.deepEqual(row,original,'unchanged complete published Root row');
      const directory=original.source.spec.path.slice(0,-'/lib.json'.length);
      for(const path of input.paths(directory)){assert.deepEqual(read(path),input.read(path),'unchanged complete current authoring');currentFiles.push(path);}
    }else{
      assert.equal(row.version,source.source.version);assert.equal(row.profile,source.source.profile);
      assert.deepEqual(readPin(row.source.spec,read),jsonBytes(source.source),'admitted original producer source record');
      assert.deepEqual(readPin(row.source.wit,read),input.read(source.source.wit.path),'actual current WIT materialization');
      currentFiles.push(row.source.spec.path,row.source.wit.path);
      assert.equal(row.manifest_sha256,source.source.root.manifest_sha256);assert.equal(row.root_inventory_sha256,source.source.root.inventory_sha256);
      const manifest=parse(input.read(composed.root+'/lib.json'));
      assert.equal(row.wit_sha256,manifest.wit.sha256);assert.equal(row.wit_world,manifest.wit.world);
      assert.equal(row.target,manifest.build.target);assert.deepEqual(row.views,Object.keys(manifest.bindings).sort());
      assert.deepEqual(row.delivery,{kind:'wasm-core-component',artifact:manifest.artifact,component:manifest.component,native_status:null,device_qualified:false});
    }
    assert.equal(row.root_inventory_sha256,digest(composed.files),'original whole Root authority');
    assert.deepEqual(row.files,Object.entries(composed.files).map(([path,pin])=>({path:row.root+'/'+path,...pin})),'complete Root files');
    for(const pin of row.files){const b=readPin(pin,read),path=pin.path.slice(row.root.length+1);assert.deepEqual(b,input.read(composed.root+'/'+path),'exact original Root bytes');local[path]={bytes:b.length,sha256:sha(b)};rootFiles++;}
    assert.equal(digest(local),row.root_inventory_sha256);
  }
  for(const path of ['LICENSE',...input.paths('licenses')])assert.deepEqual(read(path),input.read(path),'exact original common license/notice bytes');
  if(productPaths){assert.deepEqual(sorted(productPaths.filter(p=>p.startsWith('current-libs/'))),catalog.packages.flatMap(row=>row.files.map(pin=>pin.path)).sort(),'no unselected current Roots');
    const authored=productPaths.filter(p=>p.startsWith('libspec/')&&!['libspec/registry.json','libspec/rust-policy.json','libspec/Cargo.lock'].includes(p));
    if(authored.length)assert.deepEqual(authored.sort(),currentFiles.sort(),'complete selected current source inventory');}
  const search=catalog.packages.find(row=>row.id==='wasmc-lib-search'),caller=new CurrentSearchCaller(indexBytes,read(search.root+'/artifact.wasm'),read(search.root+'/core-abi.json'));
  const entries=currentIndexEntries(index),apis=entries.length-ids.length;
  assert.deepEqual(caller.snapshot(),{tag:'ok',value:{entry_count:entries.length,package_count:ids.length,api_count:apis,bound_package_count:ids.length,registry_sha256:catalog.registry.sha256,index_sha256:catalog.index.sha256}});
  for(const entry of entries)assert.deepEqual(caller.lookup(entry.identity),{tag:'ok',value:entry});
  const pages=[];for(let offset=0;offset<entries.length;offset+=64){const page=caller.search({text:'',package_id:null,profile:null,bound_only:true},offset,64);assert.equal(page.tag,'ok');pages.push(...page.value);}
  assert.deepEqual(pages,entries);
  return {schema:'wasmc.current-composition-release-closure/v1',accepted:true,catalog_sha256:catalogSha256,
    original_base_catalog_sha256:options.base.catalog_sha256,original_base_closure:baseClosure,
    source_lineage_sha256:cohort.source_lineage_sha256,release_packages:ids.length,api_routes:apis,entries:entries.length,root_files_verified:rootFiles,
    exact:true,actual_Core_Search_snapshot_lookup_pagination:true,current_source_custody_verified:true,
    original_receipt_bytes_verified:false,fresh_full_q0:false,fresh_builds:0,public_release_admission:false};
}

export async function assembleComposedCurrentProduct(repo,{compositionOptions,version,artifactCommit,out}){
  assert.ok(isAbsolute(repo)&&isAbsolute(out));assert.match(version,/^\d+\.\d+\.\d+$/);assert.match(artifactCommit,/^[0-9a-f]{40}$/);
  const api=await import('./current-lib-release-v3.mjs'),generator=await import('./lib-current-composition-v1.mjs');
  const read=api.currentProductReader(repo),paths=p=>api.currentProductPaths(repo,p);
  const composition=await generator.composeCurrentLibs(repo,compositionOptions),candidate=await generator.buildCurrentCompositionCandidate(repo,compositionOptions);
  const base=api.checkedCurrentCatalog(read(compositionOptions.base.catalog_path),compositionOptions.base.catalog_sha256);
  const inputPaths=new Set(['LICENSE',compositionOptions.base.catalog_path,base.registry.path,base.index.path,base.cohort.path,...paths('licenses')]);
  for(const row of base.packages){for(const p of paths(row.root))inputPaths.add(p);for(const p of paths(row.source.spec.path.slice(0,-'/lib.json'.length)))inputPaths.add(p);}
  for(const row of compositionOptions.replacements){for(const p of paths(row.root))inputPaths.add(p);for(const p of paths(row.source.root))inputPaths.add(p);}
  await mkdir(out,{recursive:false});
  const put=async(path,b)=>{assert.ok(safe(path));await mkdir(join(out,path,'..'),{recursive:true});await writeFile(join(out,path),b,{flag:'wx'});};
  const inputFiles=[];for(const path of [...inputPaths].sort()){const b=read(path);await put(prefix+'/'+path,b);inputFiles.push(pinFor(path,b));}
  for(const path of ['LICENSE',base.registry.path,...paths('licenses')])await put(path,read(path));
  for(const path of ['libspec/rust-policy.json','libspec/Cargo.lock'])await put(path,read(path));
  const packages=[];
  for(const row of composition.rows){
    const target='current-libs/'+row.id+'/'+row.version;
    for(const path of Object.keys(row.files))await put(target+'/'+path,read(row.root+'/'+path));
    const original=base.packages.find(p=>p.id===row.id),admitted=candidate.source_lineage.admitted_original_sources.find(p=>p.source.id===row.id);
    if(!admitted){for(const path of paths(original.source.spec.path.slice(0,-'/lib.json'.length)))await put(path,read(path));packages.push(structuredClone(original));}
    else{
      const specPath='libspec/'+row.id+'/lib.json',witPath='libspec/'+row.id+'/lib.wit',specBytes=jsonBytes(admitted.source),witBytes=read(admitted.source.wit.path);
      await put(specPath,specBytes);await put(witPath,witBytes);const m=parse(read(row.root+'/lib.json'));
      packages.push({id:row.id,version:row.version,profile:row.profile,target:m.build.target,root:target,
        manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256,wit_sha256:m.wit.sha256,wit_world:m.wit.world,
        source:{spec:pinFor(specPath,specBytes),wit:pinFor(witPath,witBytes)},views:Object.keys(m.bindings).sort(),
        delivery:{kind:'wasm-core-component',artifact:m.artifact,component:m.component,native_status:null,device_qualified:false},
        files:Object.entries(row.files).map(([path,pin])=>({path:target+'/'+path,...pin}))});
    }
  }
  const indexBytes=Buffer.from(JSON.stringify(candidate.index)+'\n');await put('catalog/current-index-v2.json',indexBytes);
  const cohort={schema:'wasmc.public-current-composition-cohort/v1',accepted:true,input_prefix:prefix,input_files:inputFiles,
    input_options:compositionOptions,composition,composition_sha256:digest(composition),source_lineage:candidate.source_lineage,
    source_lineage_sha256:digest(candidate.source_lineage),fresh_full_q0:false,public_admission:false};
  const cohortBytes=jsonBytes(cohort),cohortPath='admission/current-composition-cohort-v1.json';await put(cohortPath,cohortBytes);
  const catalog={schema:'wasmc.public-lib-catalog/v2',version,package_authority_commit:artifactCommit,
    registry:base.registry,index:pinFor('catalog/current-index-v2.json',indexBytes),cohort:pinFor(cohortPath,cohortBytes),packages};
  const catalogBytes=jsonBytes(catalog);await put('catalog/libs-current-v2.json',catalogBytes);
  // Original consumer entrypoints run from this self-contained staging root.
  for(const name of (await readdir(join(repo,'scripts'))).filter(n=>n.endsWith('.mjs')))await put('scripts/'+name,await readFile(join(repo,'scripts',name)));
  const fileInventory=await inventory(out),checked=api.verifyCurrentRelease(catalogBytes,sha(catalogBytes),api.currentProductReader(out),Object.keys(fileInventory));
  const receipt={schema:'wasmc.current-composition-assembly/v1',accepted:true,out:resolve(out),catalog_sha256:sha(catalogBytes),
    index_sha256:sha(indexBytes),source_lineage_sha256:digest(candidate.source_lineage),closure:checked,
    fresh_builds:0,original_receipt_bytes_verified:false,formal_release:false,network_installation:false,
    actual_public_artifact_commit_paths_readback_required:true,artifact_commit:artifactCommit};
  await put('admission/current-composition-assembly-v1.json',jsonBytes(receipt));return receipt;
}
