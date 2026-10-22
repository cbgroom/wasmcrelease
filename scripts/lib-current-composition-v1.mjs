// Verify a complete cohort assembled from immutable, already produced Roots.
// This receipt is deliberately not a lib-refresh-receipt/v2 or a fresh Q0 run.
// Catalog authoring, public admission, installation and release remain separate.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedCurrentCatalog,verifyCurrentRelease,currentProductReader,currentProductPaths} from './current-lib-release-v3.mjs';
import {sha,digest,verifyRoot,inventory} from './lib-refresh-cache-v2.mjs';
import {witModel,selectedWitRoutes} from './current-wit-routes-v3.mjs';
import {CurrentSearchCaller,currentIndexEntries} from './current-lib-search-v3.mjs';
import {verifyImportedProducerCustodyData as sourceCustody,buildCurrentCompositionLineageData} from './current-lib-source-custody-v1.mjs';

const sorted=values=>[...values].sort();
const exact=(value,keys)=>assert.deepEqual(Object.keys(value).sort(),sorted(keys),'closed composition input schema');
const pin=value=>assert.match(value,/^[0-9a-f]{64}$/,'independent SHA256 required');
const safe=value=>{assert.equal(typeof value,'string');assert.ok(value&&!value.startsWith('/')&&!value.includes('\\')&&
  value.split('/').every(p=>p&&p!=='.'&&p!=='..'),'safe composition input path');return value;};
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const parse=bytes=>JSON.parse(decode(bytes));
const readBytes=(input,path)=>{safe(path);const bytes=input.read(path);assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length>0&&bytes.length<=16777216,'bounded composition input');return bytes;};
const descriptor=(input,path)=>{const bytes=readBytes(input,path);return {path,bytes:bytes.length,sha256:sha(bytes)};};
function rootInventory(input,root){
  safe(root);const paths=input.paths(root);assert.ok(Array.isArray(paths)&&paths.length>0&&paths.length<=256);
  assert.deepEqual(paths,sorted(new Set(paths)),'complete ordered unique Root inventory');const files={};
  for(const path of paths){safe(path);assert.ok(path.startsWith(root+'/'),'Root inventory escaped locator');
    const bytes=readBytes(input,path);files[path.slice(root.length+1)]={bytes:bytes.length,sha256:sha(bytes)};}
  return files;
}
function pinnedFile(input,root,files,path){
  safe(path);assert.ok(files[path],'source packet file missing: '+path);const bytes=readBytes(input,root+'/'+path);
  assert.deepEqual({bytes:bytes.length,sha256:sha(bytes)},files[path],'source/Root changed during composition');return bytes;
}
function verifyLocalDescriptors(manifest,files){
  const visit=value=>{if(!value||typeof value!=='object')return;
    if(typeof value.path==='string'&&typeof value.sha256==='string'){
      safe(value.path);assert.ok(files[value.path],'missing descriptor file: '+value.path);
      assert.equal(files[value.path].sha256,value.sha256,'Root descriptor digest');
      if(value.bytes!==undefined)assert.equal(files[value.path].bytes,value.bytes,'Root descriptor size');
    }
    for(const child of Object.values(value))visit(child);
  };
  for(const key of ['artifact','component','core_abi','wit','bindings','agent','license'])visit(manifest[key]);
}
function importedRoot(input,replacement,baseLicense){
  exact(replacement,['id','version','profile','root','manifest_sha256','root_inventory_sha256','source']);
  assert.match(replacement.id,/^[a-z][a-z0-9-]*$/);assert.match(replacement.version,/^\d+\.\d+\.\d+$/);
  assert.equal(replacement.profile,'value','v1 imports only complete canonical value Roots');
  pin(replacement.manifest_sha256);pin(replacement.root_inventory_sha256);
  const files=rootInventory(input,replacement.root);
  assert.equal(digest(files),replacement.root_inventory_sha256,'independent imported whole-Root inventory');
  const get=path=>pinnedFile(input,replacement.root,files,path),manifest=parse(get('lib.json'));
  assert.equal(sha(get('lib.json')),replacement.manifest_sha256,'independent imported manifest');
  assert.equal(manifest.schema,'wasmc.lib/v2');assert.equal(manifest.id,replacement.id);assert.equal(manifest.version,replacement.version);
  assert.deepEqual(sorted(Object.keys(manifest.bindings)),['rust_component','rust_core'],'complete imported SDK views');
  assert.equal(manifest.bindings.rust_core.schema,'wasmc.lib-rust-canonical-core-sdk/v1');
  assert.equal(manifest.bindings.rust_component.schema,'wasmc.lib-rust-component-sdk/v0');
  for(const name of ['artifact.wasm','component.wasm','core-abi.json','lib.wit','LICENSE'])assert.ok(files[name],'complete imported Root: '+name);
  for(const binding of Object.values(manifest.bindings)){
    assert.ok(binding.cargo_toml?.path&&binding.source?.path,'complete generated SDK descriptors');
    const cargo=decode(get(binding.cargo_toml.path));assert.equal(cargo.match(/^license-file\s*=/gm)?.length,1);
    assert.match(cargo,/^license-file\s*=\s*"\.\.\/\.\.\/LICENSE"\s*$/m);assert.ok(!/^license\s*=/m.test(cargo));
  }
  verifyLocalDescriptors(manifest,files);
  assert.deepEqual(manifest.license,baseLicense,'exact original common license and notice snapshots');
  const custody=sourceCustody(input,replacement,files,manifest),model=witModel(get('lib.wit'));
  assert.ok(model.identity.endsWith('@'+replacement.version));assert.equal(model.dependencies.size,0,'v1 imported WIT has no external dependency');
  assert.equal(manifest.wit.package,model.identity);const world=manifest.wit.world;
  const selected=selectedWitRoutes(model,world,new Map([[model.identity,model]]));
  const apis=[...selected.routes.keys()].sort();
  assert.equal(custody.report.function_count,apis.length,'producer function count versus actual selected WIT');
  assert.equal(new Set(custody.spec.apis.map(row=>row.api)).size,custody.spec.apis.length,'duplicate producer API');
  assert.deepEqual(sorted(custody.spec.apis.map(row=>row.api)),apis.map(route=>route.split('#')[1]).sort(),'original source API set versus selected WIT');
  const module=new WebAssembly.Module(get('artifact.wasm')),abi=parse(get('core-abi.json'));
  assert.equal(abi.schema,'wasmc.lib-core-abi/v0');assert.equal(abi.artifact_sha256,files['artifact.wasm'].sha256);
  assert.deepEqual(abi.wit,{package:model.identity,sha256:files['lib.wit'].sha256,world});
  assert.deepEqual(WebAssembly.Module.imports(module),[],'pure imported value Root');assert.deepEqual(abi.imports,[]);
  assert.deepEqual(WebAssembly.Module.exports(module).map(row=>({name:row.name,kind:row.kind})),
    abi.exports.map(row=>({name:row.name,kind:row.kind==='function'?'function':row.kind})),'actual Core ABI exports');
  const [namespace,version]=model.identity.split('@');
  const expectedExports=apis.map(route=>namespace+'/'+route.slice(model.identity.length+1).replace('#','@'+version+'#'));
  const actualExports=WebAssembly.Module.exports(module).filter(row=>row.kind==='function'&&row.name.startsWith(namespace+'/')).map(row=>row.name).sort();
  assert.deepEqual(actualExports,expectedExports.sort(),'actual exported public Core API set');
  return {id:replacement.id,version:replacement.version,profile:replacement.profile,
    root:replacement.root,manifest_sha256:replacement.manifest_sha256,root_inventory_sha256:replacement.root_inventory_sha256,
    files,origin:custody.proof,wit:{identity:model.identity,world,sha256:files['lib.wit'].sha256,
      api_routes:apis,api_signatures:Object.fromEntries([...selected.routes].sort(([a],[b])=>a<b?-1:a>b?1:0))},
    discovery_metadata:{kind:'original-producer-build-spec',spec:descriptor(input,replacement.source.root+'/'+replacement.source.source_spec),
      description:custody.spec.skill.description,apis:custody.spec.apis},
    required_current_authoring_admission:true};
}

// A read/paths provider has the same trust boundary as verifyCurrentRelease's
// read provider. Production callers should use composeCurrentLibs below; tests
// can exercise byte changes without changing the immutable filesystem inputs.
export function composeCurrentLibData(input,options){
  exact(options,['schema','base','reused_ids','replacements']);assert.equal(options.schema,'wasmc.current-lib-composition-input/v1');
  exact(options.base,['catalog_path','catalog_sha256']);pin(options.base.catalog_sha256);
  assert.ok(Array.isArray(options.reused_ids)&&Array.isArray(options.replacements)&&options.replacements.length>0&&options.replacements.length<=64);
  const bytes=readBytes(input,options.base.catalog_path),catalog=checkedCurrentCatalog(bytes,options.base.catalog_sha256);
  const basePaths=input.paths('current-libs');
  const baseClosure=verifyCurrentRelease(bytes,options.base.catalog_sha256,input.read,basePaths);
  const cohort=parse(readBytes(input,catalog.cohort.path)),index=parse(readBytes(input,catalog.index.path));
  const ids=catalog.packages.map(row=>row.id),replaced=options.replacements.map(row=>row.id);
  assert.deepEqual(options.reused_ids,sorted(new Set(options.reused_ids)),'ordered unique explicit reused identities');
  assert.equal(new Set(replaced).size,replaced.length,'duplicate replacement identity');
  assert.deepEqual(sorted([...options.reused_ids,...replaced]),ids,'exact whole current cohort; no missing, duplicate or added identity');
  const baseLicense={schema:'wasmc.lib-license/v1',identifier:'WAsmC Research-Only Non-Commercial License 1.0',
    files:[descriptor(input,'LICENSE'),...cohort.release_notices.files]};
  const rows=[];
  for(const id of options.reused_ids){
    const row=catalog.packages.find(row=>row.id===id),spec=parse(readBytes(input,row.source.spec.path));
    assert.ok(!(spec.wit_dependencies??[]).some(dep=>replaced.includes(dep)),'reused Root depends on replaced WIT; rebuild/admit its dependency closure');
    const files=rootInventory(input,row.root);assert.equal(digest(files),row.root_inventory_sha256,'unchanged reused whole Root');
    rows.push({id,version:row.version,profile:row.profile,root:row.root,manifest_sha256:row.manifest_sha256,
      root_inventory_sha256:row.root_inventory_sha256,files,catalog_row:structuredClone(row),
      origin:{kind:'reused-public-root',catalog_sha256:options.base.catalog_sha256,
        original_receipt_sha256:cohort.refresh_receipt_sha256,producer_sha256:cohort.producer_sha256,
        original_q0_producer_pass:true,fresh_build_performed:false},
      wit:{identity:index.packages.find(p=>p.package_id===id).wit_route,world:row.wit_world,
        sha256:row.wit_sha256,api_routes:index.packages.find(p=>p.package_id===id).apis.map(p=>index.packages.find(v=>v.package_id===id).wit_route+'/'+p.route).sort()},
      required_current_authoring_admission:false});
  }
  for(const replacement of options.replacements){
    const row=importedRoot(input,replacement,baseLicense),previous=catalog.packages.find(p=>p.id===replacement.id);
    assert.notEqual(row.version,previous.version,'replacement requires a distinct explicit version');rows.push(row);
  }
  rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);assert.deepEqual(rows.map(row=>row.id),ids);
  // End-of-read fences cover the source packet, the replacement Root and every
  // reused Root. No earlier successful read can authorize a later changed byte.
  assert.equal(sha(readBytes(input,options.base.catalog_path)),options.base.catalog_sha256);
  assert.deepEqual(input.paths('current-libs'),basePaths,'base Root inventory changed during composition');
  for(const expected of [catalog.registry,catalog.index,catalog.cohort,...baseLicense.files,
    ...catalog.packages.flatMap(row=>[...Object.values(row.source),...row.files])])
    assert.deepEqual(descriptor(input,expected.path),expected,'base product input changed during composition');
  for(const row of rows){assert.deepEqual(rootInventory(input,row.root),row.files,'Root changed during composition');
    if(row.origin.kind==='imported-producer-root')assert.equal(digest(rootInventory(input,row.origin.source_root)),row.origin.source_inventory_sha256,'producer packet changed during composition');}
  const apis=rows.reduce((n,row)=>n+row.wit.api_routes.length,0);
  return {schema:'wasmc.current-lib-composition/v1',accepted:true,composition_complete:true,
    fresh_full_q0:false,public_admission:false,released:false,installation:false,
    base:{catalog:descriptor(input,options.base.catalog_path),cohort:catalog.cohort,index:catalog.index,
      original_closure:baseClosure},input_sha256:digest(options),rows,
    summary:{packages:rows.length,reused_roots:options.reused_ids.length,imported_roots:replaced.length,
      apis,entries:rows.length+apis,fresh_builds:0},
    remaining_gates:['current authoring identity admission for imported Roots','complete current WIT/index/catalog assembly',
      'independent assembled-product verification and actual Core Search','current resolve/install and ordinary App/SDK qualification',
      'release acceptance and immutable formal publication']};
}

export async function composeCurrentLibs(repo,options){
  repo=resolve(repo);const input={read:currentProductReader(repo),paths:prefix=>currentProductPaths(repo,prefix)};
  const receipt=composeCurrentLibData(input,options);
  // Reuse the existing physical Root verifier in addition to composition's
  // original-producer and actual-Core checks. It writes no files.
  for(const replacement of options.replacements){
    const verified=await verifyRoot(join(repo,safe(replacement.root)),replacement.id,replacement.version,replacement.profile);
    assert.equal(verified.manifest_sha256,replacement.manifest_sha256);
    assert.equal(digest(verified.files),replacement.root_inventory_sha256);
  }
  for(const row of receipt.rows)assert.deepEqual(await inventory(join(repo,row.root)),row.files,'physical end-of-read Root fence');
  return receipt;
}

function candidateFromComposition(input,options,composition){
  const catalog=parse(readBytes(input,options.base.catalog_path)),baseIndex=parse(readBytes(input,catalog.index.path));
  const originalSource={},selectedSource={};
  for(const row of catalog.packages){
    const directory=row.source.spec.path.slice(0,-'/lib.json'.length),files=rootInventory(input,directory);
    for(const [path,value]of Object.entries(files)){
      originalSource[directory+'/'+path]=value.sha256;
      if(options.reused_ids.includes(row.id))selectedSource[directory+'/'+path]=value.sha256;
    }
  }
  const ordered=map=>Object.fromEntries(Object.entries(map).sort(([a],[b])=>a<b?-1:a>b?1:0));
  assert.equal(digest(ordered(originalSource)),baseIndex.source_fingerprint,'original complete authoring fingerprint');
  const compositionSha=digest(composition),packages=[],roots=[],projectedSourceFiles=[];
  const sourceLineage=buildCurrentCompositionLineageData(input,options,composition,compositionSha);
  for(const row of composition.rows){
    const manifest=parse(readBytes(input,row.root+'/lib.json'));
    if(row.origin.kind==='reused-public-root')packages.push(structuredClone(baseIndex.packages.find(p=>p.package_id===row.id)));
    else{
      const replacement=options.replacements.find(p=>p.id===row.id),source=replacement.source;
      for(const [path,value]of Object.entries(rootInventory(input,source.root)))selectedSource[source.root+'/'+path]=value.sha256;
      packages.push({package_id:row.id,version:row.version,profile:row.profile,target:manifest.build.target,
        source_path:'libspec/'+row.id+'/lib.wit',wit_sha256:row.wit.sha256,
        delivery:{manifest_sha256:row.manifest_sha256,receipt_sha256:compositionSha,
          artifact_kind:'wasm-core-component',artifact_path:manifest.artifact.path,
          artifact_sha256:manifest.artifact.sha256,component_sha256:manifest.component.sha256},
        wit_route:row.wit.identity,description:row.discovery_metadata.description,
        apis:row.wit.api_routes.map(route=>({route:route.slice(row.wit.identity.length+1),
          description:row.discovery_metadata.apis.find(api=>api.api===route.split('#')[1]).delta}))});
      projectedSourceFiles.push({target_path:'libspec/'+row.id+'/lib.wit',
        source:descriptor(input,source.root+'/'+source.wit),
        current:descriptor(input,'libspec/'+row.id+'/lib.wit'),applied:false,
        mode:'byte-identical proposed current WIT materialization'});
    }
    roots.push({id:row.id,version:row.version,profile:row.profile,locator:row.root,
      proposed_current_root:'current-libs/'+row.id+'/'+row.version,
      manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256,
      files:Object.entries(row.files).map(([path,value])=>({path:row.root+'/'+path,...value})),
      source:row.origin.kind==='reused-public-root'?{kind:'current-authoring',...row.catalog_row.source}:
        {kind:'current-original-producer-source',spec:row.discovery_metadata.spec,
          wit:descriptor(input,options.replacements.find(p=>p.id===row.id).source.root+'/'+options.replacements.find(p=>p.id===row.id).source.wit),
          packet_root:row.origin.source_root,packet_inventory_sha256:row.origin.source_inventory_sha256,
          source_schema:'wasmc.current-original-producer-source/v1',
          source_admission:sourceLineage.admitted_original_sources.find(value=>value.source.id===row.id).admission},
      origin:row.origin,current_authoring_admitted:!row.required_current_authoring_admission,
      source_custody_admitted_for_current_composition:true});
  }
  // The wire order is the full package identity, including '@'. Bare IDs have
  // a different order at prefix collisions such as http1/http1-client.
  const bareIdOrder=structuredClone(packages);
  packages.sort((a,b)=>{const x=a.package_id+'@'+a.version,y=b.package_id+'@'+b.version;return x<y?-1:x>y?1:0;});
  const sourceInputs=ordered(selectedSource),index={schema:'wasmc.current-lib-search-index/v2',
    registry_sha256:catalog.registry.sha256,source_fingerprint:digest(sourceInputs),packages};
  const indexBytes=Buffer.from(JSON.stringify(index)+'\n'),indexPin={bytes:indexBytes.length,sha256:sha(indexBytes)};
  assert.ok(indexBytes.length<=2097152);const entries=currentIndexEntries(index);
  assert.equal(new Set(entries.map(row=>row.identity)).size,entries.length,'unique complete candidate identities');
  const search=composition.rows.find(row=>row.id==='wasmc-lib-search');
  const searchArtifact=readBytes(input,search.root+'/artifact.wasm'),searchAbi=readBytes(input,search.root+'/core-abi.json');
  assert.equal(sha(searchArtifact),search.files['artifact.wasm'].sha256);
  assert.equal(sha(searchAbi),search.files['core-abi.json'].sha256);
  const caller=new CurrentSearchCaller(indexBytes,searchArtifact,searchAbi);
  assert.deepEqual(caller.snapshot(),{tag:'ok',value:{entry_count:entries.length,package_count:packages.length,
    api_count:entries.length-packages.length,bound_package_count:packages.length,
    registry_sha256:catalog.registry.sha256,index_sha256:indexPin.sha256}});
  for(const entry of entries)assert.deepEqual(caller.lookup(entry.identity),{tag:'ok',value:entry});
  const all=[];let pages=0;
  for(let offset=0;offset<entries.length;offset+=64){
    const result=caller.search({text:'',package_id:null,profile:null,bound_only:true},offset,64);
    assert.equal(result.tag,'ok');all.push(...result.value);pages++;
  }
  assert.deepEqual(all,entries,'actual candidate Core Search full pagination');
  const replaced=[],rejectedSourcePathProbes=[],rejectedInitialProbes=[];
  for(const replacement of options.replacements){
    const expected=entries.filter(row=>row.package_id===replacement.id);
    assert.deepEqual(caller.search({text:'',package_id:replacement.id,profile:null,bound_only:true},0,64),{tag:'ok',value:expected});
    const old=catalog.packages.find(row=>row.id===replacement.id),oldIdentity=old.id+'@'+old.version;
    assert.deepEqual(caller.lookup(oldIdentity),{tag:'ok',value:null},'old replaced identity absent');
    replaced.push({id:replacement.id,old_identity:oldIdentity,new_identity:replacement.id+'@'+replacement.version,
      filtered_entries:expected.length,old_identity_absent:true});
    // Preserve the first real candidate failure as an executable contrast:
    // LibSearch0.5.0 requires the logical current-authoring path. The candidate
    // manifest explicitly projects original WIT bytes to that path without
    // writing them into the current product or claiming authoring admission.
    const probe=structuredClone(index),sourcePath=replacement.source.root+'/'+replacement.source.wit;
    probe.packages.find(row=>row.package_id===replacement.id).source_path=sourcePath;
    const probeBytes=Buffer.from(JSON.stringify(probe)+'\n');
    const observed=new CurrentSearchCaller(probeBytes,searchArtifact,searchAbi).snapshot();
    assert.deepEqual(observed,{tag:'err',value:'invalid-index'},'actual LibSearch rejects noncanonical authoring locator');
    rejectedSourcePathProbes.push({id:replacement.id,source_path:sourcePath,index_sha256:sha(probeBytes),observed,
      reason:'LibSearch0.5.0 requires libspec/<id>/lib.wit; current-source projection remains unapplied.'});
    const initial={...probe,packages:structuredClone(bareIdOrder)};
    initial.packages.find(row=>row.package_id===replacement.id).source_path=sourcePath;
    const initialBytes=Buffer.from(JSON.stringify(initial)+'\n');
    const initialObserved=new CurrentSearchCaller(initialBytes,searchArtifact,searchAbi).snapshot();
    assert.deepEqual(initialObserved,{tag:'err',value:'invalid-index'});
    rejectedInitialProbes.push({id:replacement.id,index_sha256:sha(initialBytes),observed:initialObserved,
      reason:'Original first candidate used a producer path and bare-ID package ordering; exact rejected input identity retained.'});
  }
  const orderProbe={...index,packages:bareIdOrder},orderProbeBytes=Buffer.from(JSON.stringify(orderProbe)+'\n');
  const orderObserved=new CurrentSearchCaller(orderProbeBytes,searchArtifact,searchAbi).snapshot();
  const differentOrder=JSON.stringify(bareIdOrder.map(row=>row.package_id))!==JSON.stringify(packages.map(row=>row.package_id));
  if(differentOrder)assert.deepEqual(orderObserved,{tag:'err',value:'invalid-index'},'actual Core Search rejects bare-ID ordering at prefix collisions');
  for(const root of roots)for(const expected of root.files)assert.deepEqual(descriptor(input,expected.path),expected,'candidate original Root end fence');
  for(const [path,expected]of Object.entries(sourceInputs))assert.equal(sha(readBytes(input,path)),expected,'candidate authoring end fence');
  return {schema:'wasmc.current-lib-admission-candidate/v1',accepted:true,candidate_verified:true,
    current_directory_admitted:false,public_admission:false,released:false,installation:false,fresh_full_q0:false,
    composition_sha256:compositionSha,index,index_pin:indexPin,index_source_paths:'proposed-current-product',source_lineage:sourceLineage,
    manifest:{schema:'wasmc.current-lib-composition-manifest/v1',base_catalog:composition.base.catalog,
      registry:catalog.registry,composition_sha256:compositionSha,index:indexPin,
      source_lineage_sha256:digest(sourceLineage),
      source_fingerprint_mode:'composition-selected-discovery-inputs/v1',source_inputs:sourceInputs,
      projected_source_files:projectedSourceFiles,packages:roots},
    verification:{actual_Core_Search_snapshot:true,actual_Core_Search_lookups:entries.length,
      actual_Core_Search_pages:pages,bound_packages:packages.length,replaced,rejected_source_path_probes:rejectedSourcePathProbes,
      original_first_candidate_probes:rejectedInitialProbes,
      bare_id_order_probe:{index_sha256:sha(orderProbeBytes),observed:orderObserved,rejected:differentOrder},
      search_core_sha256:sha(searchArtifact),search_abi_sha256:sha(searchAbi)},summary:composition.summary,
    exact_remaining_identity_gaps:[],
    pending_current_materializations:options.replacements.map(replacement=>({id:replacement.id,
      current_spec:descriptor(input,'libspec/'+replacement.id+'/lib.json'),
      proposed_source_spec:descriptor(input,replacement.source.root+'/'+replacement.source.source_spec),
      current_wit:descriptor(input,'libspec/'+replacement.id+'/lib.wit'),
      proposed_wit:descriptor(input,replacement.source.root+'/'+replacement.source.wit),
      admitted_source_schema:'wasmc.current-original-producer-source/v1',
      reason:'Source custody is admitted for the current composition; the physical current source registry, WIT projection and product lineage adapter remain unapplied.'})),
    remaining_gates:['connect admitted original-producer-source and strict composition lineage to current product assembler/verifier',
      'materialize complete current catalog/Roots, then actual resolve/install and App/SDK qualification',
      'release acceptance and immutable formal publication']};
}

export function buildCurrentCompositionCandidateData(input,options){
  return candidateFromComposition(input,options,composeCurrentLibData(input,options));
}
export async function buildCurrentCompositionCandidate(repo,options){
  repo=resolve(repo);const composition=await composeCurrentLibs(repo,options);
  return candidateFromComposition({read:currentProductReader(repo),paths:prefix=>currentProductPaths(repo,prefix)},options,composition);
}
export function verifyCurrentCompositionCandidateData(input,options,candidate){
  assert.deepEqual(candidate,buildCurrentCompositionCandidateData(input,options),'candidate must equal its independently verified source/Root composition');
  return {accepted:true,index_sha256:candidate.index_pin.sha256,composition_sha256:candidate.composition_sha256,
    current_directory_admitted:false,public_admission:false};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);assert.equal(args.length,4,'--input <pinned-input.json> --input-sha256 <sha256>');
  assert.equal(args[0],'--input');assert.equal(args[2],'--input-sha256');pin(args[3]);
  const bytes=await readFile(resolve(args[1]));assert.equal(sha(bytes),args[3],'independent composition input pin');
  console.log(JSON.stringify(await composeCurrentLibs(process.cwd(),parse(bytes))));
}
