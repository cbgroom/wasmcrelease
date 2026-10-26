import {builtProducerCustody,buildBuiltSource,reexportedProducerCustody,buildReexportedSource} from './current-built-lib-source-v1.mjs';
import {publishedProducerCustody,buildPublishedSource} from './current-published-lib-source-v1.mjs';
import {additive,checkCompositionOptions,importedSelections,registryProjection} from './current-lib-composition-input-v2.mjs';
// Closed original-producer source admission for a current composition.
// Existing full-refresh v2 authoring/receipts retain their separate validators.
// This imports exact completed producer evidence; it performs no new build.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sha,digest} from './lib-refresh-cache-v2.mjs';
import {witModel,selectedWitRoutes} from './current-wit-routes-v3.mjs';
const sorted=values=>[...values].sort();
const exact=(value,keys)=>assert.deepEqual(Object.keys(value).sort(),sorted(keys),'closed composition input schema');
const pin=value=>assert.match(value,/^[0-9a-f]{64}$/,'independent SHA256 required');
const commit=value=>assert.match(value,/^[0-9a-f]{40}$/,'full source identity required');
const safe=value=>{assert.equal(typeof value,'string');assert.ok(value&&!value.startsWith('/')&&!value.includes('\\')&&
  value.split('/').every(p=>p&&p!=='.'&&p!=='..'),'safe composition input path');return value;};
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const parse=bytes=>JSON.parse(decode(bytes));
const readBytes=(input,path)=>{safe(path);const bytes=input.read(path);assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length>0,'nonempty composition input');return bytes;};
const descriptor=(input,path)=>{const bytes=readBytes(input,path);return {path,bytes:bytes.length,sha256:sha(bytes)};};
function rootInventory(input,root){
  safe(root);const paths=input.paths(root);assert.ok(Array.isArray(paths)&&paths.length>0);
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
export function verifyImportedProducerCustodyData(input,replacement,files,manifest){
  if(replacement.source.schema==='wasmc.published-lib-source-input/v1')return publishedProducerCustody(input,replacement,files,manifest);
  if(replacement.source.schema==='wasmc.changed-rust-lib-source-input/v1')return builtProducerCustody(input,replacement,files,manifest);
  if(replacement.source.schema==='wasmc.reexported-rust-lib-source-input/v1')return reexportedProducerCustody(input,replacement,files,manifest);
  const source=replacement.source;
  exact(source,['root','inventory_sha256','producer_custody','materialization_custody','source_spec','materialized_spec',
    'generated_source','logic','cargo_manifest','cargo_lock','wit','authority']);
  pin(source.inventory_sha256);const packet=rootInventory(input,source.root);
  assert.equal(digest(packet),source.inventory_sha256,'independent source packet inventory');
  const get=path=>pinnedFile(input,source.root,packet,path);
  const producer=parse(get(source.producer_custody)),materialization=parse(get(source.materialization_custody));
  const authority=source.authority;
  exact(authority,['original_receipt_sha256','driver_sha256','original_source','canonical_source_commit','canonical_source_blob']);
  pin(authority.original_receipt_sha256);pin(authority.driver_sha256);
  for(const key of ['original_source','canonical_source_commit','canonical_source_blob'])commit(authority[key]);
  assert.equal(producer.schema,'wasmc.imported-lib-producer-custody/v1');
  assert.equal(producer.original_private_receipt_sha256,authority.original_receipt_sha256,'original receipt authority');
  assert.equal(producer.driver_sha256,authority.driver_sha256,'original producer authority');
  assert.equal(producer.original_source,authority.original_source,'observed build Source authority');
  assert.equal(producer.exit,0);assert.equal(producer.new_builds,0,'import is not a new producer build');
  assert.ok(Number.isFinite(producer.seconds)&&producer.seconds>0);
  assert.ok(Array.isArray(producer.actual_command)&&producer.actual_command.length>0&&producer.actual_command.every(x=>typeof x==='string'&&x));
  const report=producer.original_producer_report;
  assert.equal(report.schema,'wasmc.lib-build-receipt/v0');assert.equal(report.accepted,true);
  assert.equal(report.package,replacement.id);assert.equal(report.version,replacement.version);
  assert.equal(report.manifest_sha256,replacement.manifest_sha256,'producer manifest identity');
  for(const field of ['artifact','component','core_abi']){
    assert.deepEqual(report[field],{bytes:files[manifest[field].path].bytes,sha256:files[manifest[field].path].sha256},'original produced '+field);
  }
  assert.deepEqual(report.toolchain,manifest.build.toolchain,'original producer toolchain');
  const raw=get(source.source_spec),spec=parse(raw),materialized=parse(get(source.materialized_spec));
  assert.equal(spec.schema,'wasmc.lib-build/v0');assert.equal(spec.skill.name,replacement.id);
  assert.equal(spec.skill.version,replacement.version);assert.equal(producer.source_spec_sha256,sha(raw),'original source spec');
  assert.equal(materialization.schema,'wasmc.lib-source-spec-materialization-custody/v1');
  assert.equal(materialization.new_builds,0);assert.equal(materialization.only_changed_json_field,'/rust/crate_dir');
  assert.equal(materialization.source_file,source.source_spec);assert.equal(materialization.materialized_file,source.materialized_spec);
  const canonical=materialization.canonical_source_spec;
  assert.equal(canonical.source_commit,authority.canonical_source_commit,'canonical source commit');
  assert.equal(canonical.git_blob,authority.canonical_source_blob,'canonical source blob');safe(canonical.path);
  assert.equal(canonical.sha256,sha(raw));assert.equal(canonical.bytes,raw.length);
  assert.equal(createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex'),canonical.git_blob,'actual Git source blob');
  assert.equal(materialization.materialized_sha256,sha(get(source.materialized_spec)));
  assert.equal(materialization.source_value,spec.rust.crate_dir);assert.equal(materialization.materialized_value,materialized.rust.crate_dir);
  const originalShape=structuredClone(spec),materializedShape=structuredClone(materialized);
  delete originalShape.rust.crate_dir;delete materializedShape.rust.crate_dir;
  assert.deepEqual(originalShape,materializedShape,'only producer crate locator may be materialized');
  assert.equal(materialization.all_other_JSON_fields_equal,true);
  assert.equal(report.generated_source_sha256,sha(get(source.generated_source)),'actual generated Rust source');
  assert.equal(producer.logic_sha256,sha(get(source.logic)),'actual Lib implementation source');
  const cargo=decode(get(source.cargo_manifest));
  assert.ok(cargo.includes('version = '+JSON.stringify(replacement.version)),'source Cargo version');
  assert.ok(cargo.includes('name = '+JSON.stringify(spec.rust.artifact_name.replaceAll('_','-'))),'source Cargo package');
  const cargoHash=sha(get(source.cargo_lock));
  assert.ok(manifest.build.inputs.some(row=>row.kind==='cargo-lock'&&row.path===materialized.rust.crate_dir+'/Cargo.lock'&&row.sha256===cargoHash),'original locked Cargo input');
  assert.equal(sha(get(source.wit)),files['lib.wit'].sha256,'source and produced WIT must match');
  assert.equal(spec.wit,source.wit,'explicit producer WIT locator');
  return {spec,report,proof:{kind:'imported-producer-root',original_receipt_sha256:authority.original_receipt_sha256,
    producer_sha256:authority.driver_sha256,observed_build_source:authority.original_source,
    canonical_source_commit:authority.canonical_source_commit,canonical_source_blob:authority.canonical_source_blob,
    source_spec_sha256:sha(raw),materialized_spec_sha256:sha(get(source.materialized_spec)),
    source_root:source.root,source_inventory_sha256:source.inventory_sha256,
    producer_custody:descriptor(input,source.root+'/'+source.producer_custody),
    materialization_custody:descriptor(input,source.root+'/'+source.materialization_custody),
    original_q0_producer_pass:true,original_receipt_bytes_verified:false,
    evidence_mode:'independently-pinned imported custody and original producer report',fresh_build_performed:false}};
}

export function buildOriginalProducerSourceData(input,expected){
  if(expected.source.schema==='wasmc.published-lib-source-input/v1')return buildPublishedSource(input,expected);
  if(expected.source.schema==='wasmc.changed-rust-lib-source-input/v1')return buildBuiltSource(input,expected);
  if(expected.source.schema==='wasmc.reexported-rust-lib-source-input/v1')return buildReexportedSource(input,expected);
  exact(expected,['id','version','profile','root','manifest_sha256','root_inventory_sha256','source']);
  assert.match(expected.id,/^[a-z][a-z0-9-]*$/);assert.match(expected.version,/^\d+\.\d+\.\d+$/);
  assert.equal(expected.profile,'value','v1 admits complete canonical value producer sources');
  pin(expected.manifest_sha256);pin(expected.root_inventory_sha256);
  const files=rootInventory(input,expected.root);
  assert.equal(digest(files),expected.root_inventory_sha256,'independent original producer Root inventory');
  const get=path=>pinnedFile(input,expected.root,files,path),manifest=parse(get('lib.json'));
  assert.equal(sha(get('lib.json')),expected.manifest_sha256,'independent original producer manifest');
  assert.equal(manifest.schema,'wasmc.lib/v2');assert.equal(manifest.id,expected.id);assert.equal(manifest.version,expected.version);
  for(const path of ['artifact.wasm','component.wasm','core-abi.json','lib.wit','LICENSE'])assert.ok(files[path],'complete original producer Root');
  assert.deepEqual(sorted(Object.keys(manifest.bindings)),['rust_component','rust_core']);
  assert.equal(manifest.bindings.rust_core.schema,'wasmc.lib-rust-canonical-core-sdk/v1');
  assert.equal(manifest.bindings.rust_component.schema,'wasmc.lib-rust-component-sdk/v0');
  verifyLocalDescriptors(manifest,files);
  for(const binding of Object.values(manifest.bindings))assert.ok(binding.source?.path&&binding.cargo_toml?.path);
  const custody=verifyImportedProducerCustodyData(input,expected,files,manifest),source=expected.source;
  const packet=rootInventory(input,source.root),getSource=path=>pinnedFile(input,source.root,packet,path);
  const materialization=parse(getSource(source.materialization_custody));
  const producerFile=descriptor(input,source.root+'/'+source.producer_custody);
  const model=witModel(get('lib.wit'));assert.equal(model.dependencies.size,0);
  assert.equal(manifest.wit.package,model.identity);assert.ok(model.identity.endsWith('@'+expected.version));
  const routes=selectedWitRoutes(model,manifest.wit.world,new Map([[model.identity,model]]));
  assert.equal(routes.routes.size,custody.report.function_count,'producer function count versus actual selected WIT');
  assert.deepEqual(sorted(custody.spec.apis.map(row=>row.api)),sorted([...routes.routes.keys()].map(route=>route.split('#')[1])));
  const core=new WebAssembly.Module(get('artifact.wasm')),abi=parse(get('core-abi.json'));
  assert.deepEqual(WebAssembly.Module.imports(core),[],'original producer value Core imports');
  assert.equal(abi.artifact_sha256,files['artifact.wasm'].sha256);assert.equal(abi.wit.sha256,files['lib.wit'].sha256);
  const record={schema:'wasmc.current-original-producer-source/v1',id:expected.id,version:expected.version,
    profile:expected.profile,world:manifest.wit.world,description:custody.spec.skill.description,
    apis:custody.spec.apis,source_spec:descriptor(input,source.root+'/'+source.source_spec),
    source_packet:{root:source.root,inventory_sha256:source.inventory_sha256,
      files:Object.entries(packet).map(([path,value])=>({path:source.root+'/'+path,...value}))},
    canonical_source:materialization.canonical_source_spec,
    materialization:{custody:descriptor(input,source.root+'/'+source.materialization_custody),
      source_spec:descriptor(input,source.root+'/'+source.source_spec),
      materialized_spec:descriptor(input,source.root+'/'+source.materialized_spec),only_changed_json_field:'/rust/crate_dir'},
    producer:{custody:producerFile,
      report:{container:producerFile,json_pointer:'/original_producer_report',
        canonical_json_sha256:digest(custody.report),representation:'JSON pointer value; SHA256 of JSON.stringify(value), not raw original receipt bytes'},
      driver_sha256:custody.proof.producer_sha256,observed_build_source:custody.proof.observed_build_source,
      original_receipt_sha256:custody.proof.original_receipt_sha256,original_receipt_bytes_verified:false},
    root:{locator:expected.root,manifest_sha256:expected.manifest_sha256,inventory_sha256:expected.root_inventory_sha256,
      files:Object.entries(files).map(([path,value])=>({path:expected.root+'/'+path,...value}))},
    wit:descriptor(input,source.root+'/'+source.wit),
    source_mode:'original-completed-producer',fresh_build_performed:false,fresh_full_q0:false};
  assert.equal(digest(rootInventory(input,source.root)),source.inventory_sha256,'original producer packet end fence');
  assert.deepEqual(rootInventory(input,expected.root),files,'original producer Root end fence');
  return record;
}
export function verifyOriginalProducerSourceData(input,expected,source){
  if(expected.source.schema==='wasmc.reexported-rust-lib-source-input/v1'){
    assert.deepEqual(source,buildReexportedSource(input,expected),'complete reexported Rust Root/source identity');
    return {schema:'wasmc.current-source-custody-admission/v1',accepted:true,source_schema:source.schema,id:source.id,version:source.version,source_sha256:digest(source),source_spec:source.source_spec,root_manifest_sha256:source.root.manifest_sha256,root_inventory_sha256:source.root.inventory_sha256,source_custody_admitted_for_current_composition:true,current_directory_admitted:false,public_admission:false,original_receipt_bytes_verified:false,fresh_full_q0:false};
  }
  if(expected.source.schema==='wasmc.changed-rust-lib-source-input/v1'){
    assert.deepEqual(source,buildBuiltSource(input,expected),'complete changed Rust Root/source identity');
    return {schema:'wasmc.current-source-custody-admission/v1',accepted:true,source_schema:source.schema,id:source.id,version:source.version,source_sha256:digest(source),source_spec:source.source_spec,root_manifest_sha256:source.root.manifest_sha256,root_inventory_sha256:source.root.inventory_sha256,source_custody_admitted_for_current_composition:true,current_directory_admitted:false,public_admission:false,original_receipt_bytes_verified:false,fresh_full_q0:false};
  }
  if(expected.source.schema==='wasmc.published-lib-source-input/v1'){
    assert.deepEqual(source,buildPublishedSource(input,expected),'complete published Root/source identity');
    return {schema:'wasmc.current-source-custody-admission/v1',accepted:true,source_schema:source.schema,id:source.id,version:source.version,source_sha256:digest(source),source_spec:source.source_spec,publication:source.publication,root_manifest_sha256:source.root.manifest_sha256,root_inventory_sha256:source.root.inventory_sha256,source_custody_admitted_for_current_composition:true,current_directory_admitted:false,public_admission:false,original_receipt_bytes_verified:false,original_driver_identity_verified:false,fresh_full_q0:false};
  }
  exact(source,['schema','id','version','profile','world','description','apis','source_spec','source_packet','canonical_source',
    'materialization','producer','root','wit','source_mode','fresh_build_performed','fresh_full_q0']);
  assert.equal(source.schema,'wasmc.current-original-producer-source/v1');
  assert.deepEqual(source,buildOriginalProducerSourceData(input,expected),'closed original producer source identity');
  return {schema:'wasmc.current-source-custody-admission/v1',accepted:true,source_schema:source.schema,
    id:source.id,version:source.version,source_sha256:digest(source),source_spec:source.source_spec,
    producer_report:source.producer.report,producer_custody:source.producer.custody,
    root_manifest_sha256:source.root.manifest_sha256,root_inventory_sha256:source.root.inventory_sha256,
    source_custody_admitted_for_current_composition:true,current_directory_admitted:false,public_admission:false,
    original_receipt_bytes_verified:false,fresh_full_q0:false};
}
export function admitOriginalProducerSourceData(input,expected){
  const source=buildOriginalProducerSourceData(input,expected);
  return {source,admission:verifyOriginalProducerSourceData(input,expected,source)};
}

function buildLineage(input,options,composition,compositionSha256,baseVerification){
  assert.equal(typeof baseVerification?.checkedCurrentCatalog,'function');assert.equal(typeof baseVerification?.verifyCurrentRelease,'function');
  const {checkedCurrentCatalog,verifyCurrentRelease}=baseVerification;
  pin(compositionSha256);assert.equal(digest(composition),compositionSha256,'independent composition receipt pin');
  assert.ok(['wasmc.current-lib-composition-input/v1','wasmc.current-lib-composition-input/v2'].includes(options.schema));
  exact(options.base,['catalog_path','catalog_sha256']);
  assert.equal(composition.schema,'wasmc.current-lib-composition/v1');assert.equal(composition.accepted,true);
  assert.equal(composition.fresh_full_q0,false);assert.equal(composition.public_admission,false);
  assert.equal(composition.released,false);assert.equal(composition.installation,false);assert.equal(composition.composition_complete,true);
  assert.equal(composition.input_sha256,digest(options),'composition selected-source input');
  const catalogBytes=readBytes(input,options.base.catalog_path),catalog=checkedCurrentCatalog(catalogBytes,options.base.catalog_sha256);
  const baseClosure=verifyCurrentRelease(catalogBytes,options.base.catalog_sha256,input.read,input.paths('current-libs'));
  assert.equal(composition.base.catalog.sha256,options.base.catalog_sha256);
  const cohort=parse(readBytes(input,catalog.cohort.path)),ids=checkCompositionOptions(options,catalog.packages.map(row=>row.id));
  assert.deepEqual(composition.rows.map(row=>row.id),ids,'whole source lineage cohort');
  assert.equal(new Set(options.replacements.map(row=>row.id)).size,options.replacements.length);
  assert.deepEqual(sorted([...options.reused_ids,...importedSelections(options).map(row=>row.id)]),ids,'complete explicit lineage selection');
  const rows=[],sources=[];
  for(const row of composition.rows){
    const original=catalog.packages.find(value=>value.id===row.id);
    assert.deepEqual(rootInventory(input,row.root),row.files,'lineage Root exact bytes');
    assert.equal(row.root_inventory_sha256,digest(row.files),'lineage whole Root identity');
    if(options.reused_ids.includes(row.id)){
      assert.equal(row.origin.kind,'reused-public-root');assert.deepEqual(row.catalog_row,original,'unchanged original catalog authority');
      assert.equal(row.root,original.root);assert.equal(row.version,original.version);assert.equal(row.profile,original.profile);
      assert.equal(row.manifest_sha256,original.manifest_sha256);assert.equal(digest(row.files),original.root_inventory_sha256);
      assert.equal(row.origin.original_receipt_sha256,cohort.refresh_receipt_sha256);
      assert.equal(row.origin.producer_sha256,cohort.producer_sha256);
      const oldSpec=parse(readBytes(input,original.source.spec.path));assert.equal(oldSpec.schema,'wasmc.lib-refresh-source/v2');
      rows.push({id:row.id,version:row.version,kind:'reused-full-refresh-source',source_schema:oldSpec.schema,
        source_spec:original.source.spec,original_receipt_sha256:cohort.refresh_receipt_sha256,
        producer_sha256:cohort.producer_sha256,manifest_sha256:row.manifest_sha256,
        root_inventory_sha256:row.root_inventory_sha256,fresh_build_performed:false});
    }else{
      const expected=importedSelections(options).find(value=>value.id===row.id),admitted=admitOriginalProducerSourceData(input,expected);
      assert.equal(row.root,expected.root);assert.equal(row.profile,expected.profile);
      assert.equal(row.version,admitted.source.version);assert.equal(row.manifest_sha256,admitted.source.root.manifest_sha256);
      assert.equal(row.root_inventory_sha256,admitted.source.root.inventory_sha256);
      const manifest=parse(readBytes(input,row.root+'/lib.json'));
      const custody=verifyImportedProducerCustodyData(input,expected,row.files,manifest);
      assert.deepEqual(row.origin,custody.proof,'original producer composition lineage');sources.push(admitted);
      rows.push({id:row.id,version:row.version,kind:'original-producer-source',source_schema:admitted.source.schema,
        source_sha256:admitted.admission.source_sha256,source_spec:admitted.source.source_spec,
        original_receipt_sha256:admitted.source.producer.original_receipt_sha256,
        original_receipt_bytes_verified:false,producer_sha256:admitted.source.producer.driver_sha256,
        manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256,fresh_build_performed:false});
    }
  }
  return {schema:'wasmc.current-composition-lineage/v1',accepted:true,source_custody_admitted_for_current_composition:true,
    composition_sha256:compositionSha256,base_catalog_sha256:options.base.catalog_sha256,
    original_base_refresh_receipt_sha256:cohort.refresh_receipt_sha256,original_base_closure:baseClosure,
    selected:ids,rows,admitted_original_sources:sources,
    current_directory_admitted:false,public_admission:false,fresh_full_q0:false,fresh_builds:0};
}
export function buildCurrentCompositionLineageData(input,options,composition,compositionSha256,baseVerification){
  return buildLineage(input,options,composition,compositionSha256,baseVerification);
}
export function verifyCurrentCompositionLineageData(input,options,composition,compositionSha256,lineage,baseVerification){
  exact(lineage,['schema','accepted','source_custody_admitted_for_current_composition','composition_sha256',
    'base_catalog_sha256','original_base_refresh_receipt_sha256','original_base_closure','selected','rows','admitted_original_sources',
    'current_directory_admitted','public_admission','fresh_full_q0','fresh_builds']);
  assert.equal(lineage.schema,'wasmc.current-composition-lineage/v1');
  assert.deepEqual(lineage,buildLineage(input,options,composition,compositionSha256,baseVerification),'closed current composition lineage');
  return {accepted:true,lineage_sha256:digest(lineage),source_custody_admitted_for_current_composition:true,
    current_directory_admitted:false,public_admission:false,fresh_full_q0:false};
}

