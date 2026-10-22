// Materialize a self-contained current Lib product, then use the original
// consumer entrypoints and installer. Transport is explicitly a staged fixture;
// no request is sent to a public mirror and no formal publication is claimed.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,realpath,readFile,writeFile,lstat,cp,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {assembleComposedCurrentProduct} from './current-lib-composition-release-v1.mjs';
import {verifyCurrentRelease,currentProductReader,resolveCurrentPackage} from './current-lib-release-v3.mjs';
import {currentCandidateArguments,verifyCurrentCandidateComposition} from './release-candidate.mjs';
import {installCurrentLib,artifactUrl} from './lib-install.mjs';
import {inventory,sha,digest} from './lib-refresh-cache-v2.mjs';
import {CoreCaller,string,list,u8,result} from './current-core-value-codec-v3.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url));
const stateParent=join(process.env.HOME,'.local/state/wasmcrelease');await mkdir(stateParent,{recursive:true});
const state=await realpath(await mkdtemp(join(stateParent,'composition-product-'))),product=join(state,'product');
console.log(JSON.stringify({stage_root:state,product,execution_started:true}));
try{
  const fixtureBytes=await readFile(join(repo,'admission/ordinary-canonical-host-v024/root-admission-next.json'));
  assert.equal(sha(fixtureBytes),'a38ca55e3029482811ae15ddd51409633c16db6e25d02f7436c6a1c8c8c212aa');
  const fixture=JSON.parse(fixtureBytes),options=fixture.composition_input;
  const artifactCommit=spawnSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).stdout.trim();
  const assembled=await assembleComposedCurrentProduct(repo,{compositionOptions:options,version:'0.0.24',artifactCommit,out:product});
  const reader=currentProductReader(product),files=await inventory(product),data=new Map();
  for(const path of Object.keys(files))data.set(path,reader(path));
  const catalogBytes=data.get('catalog/libs-current-v2.json'),catalog=JSON.parse(catalogBytes),results=[];
  const from=map=>path=>{assert.ok(map.has(path),'missing staged input '+path);return map.get(path);};
  const verify=(map=data,bytes=catalogBytes,pin=assembled.catalog_sha256)=>verifyCurrentRelease(bytes,pin,from(map),[...map.keys()]);
  const closure=verify();assert.equal(closure.release_packages,42);assert.equal(closure.package_routes,42);assert.equal(closure.api_routes,246);assert.equal(closure.entries,288);
  assert.equal(closure.original_base_closure.release_packages,42);assert.equal(closure.original_base_closure.api_routes,236);
  assert.equal(closure.original_receipt_bytes_verified,false);assert.equal(closure.fresh_full_q0,false);
  results.push({name:'actual staged42/246/288 closure plus actual original42/236 base verification',pass:true});
  const creationOptions={catalog_sha256:assembled.catalog_sha256,composition_cohort_sha256:catalog.cohort.sha256,
    source_lineage_sha256:assembled.source_lineage_sha256};
  const creationArgs=['--current-catalog-sha256',creationOptions.catalog_sha256,
    '--current-composition-cohort-sha256',creationOptions.composition_cohort_sha256,
    '--current-source-lineage-sha256',creationOptions.source_lineage_sha256];
  assert.deepEqual(await currentCandidateArguments(creationArgs),creationOptions);
  const creation=verifyCurrentCandidateComposition(product,creationOptions);assert.deepEqual(creation.closure,closure);
  assert.equal(creation.closure.fresh_full_q0,false);assert.equal(Object.hasOwn(creation.closure,'refresh_receipt_sha256'),false);
  assert.ok(creation.product_inputs.includes(catalog.cohort.path));
  assert.ok(creation.product_inputs.some(path=>path.startsWith('admission/current-composition-inputs-v1/')));
  const admitted=JSON.parse(reader(catalog.cohort.path)).source_lineage.admitted_original_sources[0].source;
  for(const pin of [...admitted.root.files,...admitted.source_packet.files]){
    assert.ok(creation.product_inputs.includes(pin.path),'direct original carrier is candidate-bound');
    assert.equal(sha(reader(pin.path)),pin.sha256);
  }
  results.push({name:'existing candidate creation dispatch independently pins and strictly verifies real composition graph',pass:true});
  for(const key of Object.keys(creationOptions)){
    assert.throws(()=>verifyCurrentCandidateComposition(product,{...creationOptions,[key]:'0'.repeat(64)}));
    results.push({name:'candidate creation rejects independent '+key+' drift',pass:true,rejected:true});
  }
  for(const args of [creationArgs.slice(0,4),[...creationArgs,'--current-run','/tmp/fake-full-q0'],
    [...creationArgs.slice(0,4),'--current-catalog-sha256',creationOptions.catalog_sha256]])
    await assert.rejects(()=>currentCandidateArguments(args));
  assert.throws(()=>verifyCurrentCandidateComposition(product,{...creationOptions,receipt_sha256:'0'.repeat(64)}));
  assert.deepEqual(await currentCandidateArguments(['--current-run','/tmp/original-run','--current-receipt-sha256','1'.repeat(64),
    '--current-producer-sha256','2'.repeat(64)]),{run_root:'/tmp/original-run',receipt_sha256:'1'.repeat(64),producer_sha256:'2'.repeat(64)});
  results.push({name:'closed composition arguments reject missing/duplicate/mixed fresh-Q0 pins; original parser retained',pass:true});
  const json=catalog.packages.find(p=>p.id==='wasmc-json');
  assert.equal(JSON.parse(data.get(json.source.spec.path)).schema,'wasmc.current-original-producer-source/v1');
  assert.equal(sha(data.get(json.source.wit.path)),'225b23395b09023305c0c6e24b0168af7847bfe72cfd9db18bb2b52a544038be');
  for(const id of options.reused_ids){const row=catalog.packages.find(p=>p.id===id),old=fixture.composition.rows.find(p=>p.id===id);
    assert.deepEqual(row,old.catalog_row);for(const file of row.files)assert.equal(sha(data.get(file.path)),file.sha256);}
  results.push({name:'actual current source is admitted original-producer schema and41 complete Roots remain exact',pass:true});
  const cli=(args)=>{const r=spawnSync(process.execPath,[join(product,'scripts/wasmc-lib.mjs'),...args],{cwd:product,encoding:'utf8',timeout:120000,maxBuffer:1048576});
    assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  const search=cli(['search','inspect-values-bytes','--package','wasmc-json','--catalog-sha256',assembled.catalog_sha256,'--limit','64']);
  assert.equal(search.result.tag,'ok');assert.equal(search.result.value.length,1);
  assert.equal(search.result.value[0].identity,'wasmc-json@0.0.5/document#inspect-values-bytes');
  const lock=cli(['resolve','wasmc-json','0.0.5','--catalog-sha256',assembled.catalog_sha256,
    '--manifest-sha256',json.manifest_sha256,'--root-inventory-sha256',json.root_inventory_sha256]);
  assert.deepEqual(lock,resolveCurrentPackage(catalogBytes,assembled.catalog_sha256,{id:json.id,version:json.version,
    manifest_sha256:json.manifest_sha256,root_inventory_sha256:json.root_inventory_sha256},reader));
  results.push({name:'original staged wasmc-lib CLI actual Core Search and source-bound resolve',pass:true});
  const lockBytes=Buffer.from(JSON.stringify(lock)+'\n'),destination=join(state,'installed-json005');let downloads=0;
  const transport=new Map(json.files.map(pin=>[artifactUrl('github',artifactCommit,pin.path),data.get(pin.path)]));
  const fetcher=async url=>{assert.ok(transport.has(url),'only exact staged transport URLs');downloads++;return new Response(transport.get(url),{status:200});};
  const installed=await installCurrentLib({catalogBytes,catalogSha256:assembled.catalog_sha256,lockBytes,lockSha256:sha(lockBytes),destination,mirror:'github'},fetcher);
  assert.equal(downloads,18);assert.equal(installed.files_verified,18);for(const pin of json.files)assert.equal(sha(await readFile(join(destination,pin.path))),pin.sha256);
  const installedCore=await readFile(join(destination,json.root,'artifact.wasm')),abi=JSON.parse(await readFile(join(destination,json.root,'core-abi.json')));
  const caller=new CoreCaller(new WebAssembly.Module(installedCore),abi),errors=['input-too-large','depth-limit','invalid-json','too-many-pointers','pointer-too-long','invalid-pointer','output-too-large'];
  assert.deepEqual(caller.call('compact',[string],[' {"new": [1, 2], "name":"新输入"} '],result(string,errors)),{tag:'ok',value:'{"name":"新输入","new":[1,2]}'});
  assert.deepEqual(caller.call('compact-bytes',[list(u8)],[[...new TextEncoder().encode('{"bytes":true}')]],result(string,errors)),{tag:'ok',value:'{"bytes":true}'});
  assert.deepEqual(caller.call('compact-bytes',[list(u8)],[[255]],result(string,errors)),{tag:'err',value:'invalid-json'});
  results.push({name:'original actual installer verifies18 staged downloads; installed Core executes new text/bytes and invalidUTF8',pass:true,transport:'controlled staged bytes',network:false});
  const reject=(name,mutate,pattern)=>{const map=new Map(data),c=structuredClone(catalog);mutate(map,c);
    const bytes=Buffer.from(JSON.stringify(c)+'\n');assert.throws(()=>verify(map,bytes,sha(bytes)),pattern,name);results.push({name,pass:true,rejected:true});};
  const jsonEdit=(map,path,action)=>{const value=JSON.parse(map.get(path));action(value);const b=Buffer.from(JSON.stringify(value)+'\n');map.set(path,b);return b;};
  const sealCohort=(map,c,cohort)=>{const b=Buffer.from(JSON.stringify(cohort)+'\n');map.set(c.cohort.path,b);c.cohort={path:c.cohort.path,bytes:b.length,sha256:sha(b)};};
  assert.throws(()=>verify(data,catalogBytes,'0'.repeat(64)));results.push({name:'independent new catalog pin required',pass:true,rejected:true});
  reject('actual current Root byte drift',(map)=>{const path=json.root+'/artifact.wasm',b=Buffer.from(map.get(path));b[b.length-1]^=1;map.set(path,b);});
  reject('actual hidden current Root file',(map)=>map.set(json.root+'/hidden.bin',Buffer.from('extra')),/no unselected current Roots/);
  reject('self-rehashed current source cannot claim raw receipt read',(map,c)=>{
    const row=c.packages.find(p=>p.id==='wasmc-json'),b=jsonEdit(map,row.source.spec.path,s=>s.producer.original_receipt_bytes_verified=true);
    row.source.spec={path:row.source.spec.path,bytes:b.length,sha256:sha(b)};
  },/admitted original producer source record/);
  reject('self-rehashed new index cannot omit actual WIT API',(map,c)=>{
    const b=jsonEdit(map,c.index.path,i=>i.packages.find(p=>p.package_id==='wasmc-json').apis.pop());c.index={path:c.index.path,bytes:b.length,sha256:sha(b)};
  },/complete current source\/WIT\/index binding/);
  reject('forged composition/WIT assertions cannot override actual source WIT',(map,c)=>{
    const co=JSON.parse(map.get(c.cohort.path));co.composition.rows.find(p=>p.id==='wasmc-json').wit.api_routes.pop();
    co.composition_sha256=digest(co.composition);co.source_lineage.composition_sha256=co.composition_sha256;co.source_lineage_sha256=digest(co.source_lineage);
    const b=jsonEdit(map,c.index.path,i=>{const p=i.packages.find(p=>p.package_id==='wasmc-json');p.apis.pop();p.delivery.receipt_sha256=co.composition_sha256;});
    c.index={path:c.index.path,bytes:b.length,sha256:sha(b)};sealCohort(map,c,co);
  },/complete current source\/WIT\/index binding/);
  reject('actual original base input byte drift',(map,c)=>{
    const co=JSON.parse(map.get(c.cohort.path)),path=co.input_prefix+'/catalog/current-index-v2.json';map.set(path,Buffer.concat([map.get(path),Buffer.from('changed')]));
  });
  for(const pin of [admitted.root.files[0],admitted.source_packet.files[0]]){
    reject('actual original public carrier byte drift '+pin.path,map=>{const b=Buffer.from(map.get(pin.path));b[0]^=1;map.set(pin.path,b);});
    reject('missing original public carrier '+pin.path,map=>map.delete(pin.path));
  }
  reject('hidden original source packet file',map=>map.set(admitted.source_packet.root+'/hidden.txt',Buffer.from('extra')),/complete original public carrier inventory/);
  reject('self-rehashed original base still requires full old WIT verification',(map,c)=>{
    const co=JSON.parse(map.get(c.cohort.path)),prefix=co.input_prefix,basePath=co.input_options.base.catalog_path;
    const base=JSON.parse(map.get(prefix+'/'+basePath)),indexPath=base.index.path;
    const indexBytes=jsonEdit(map,prefix+'/'+indexPath,i=>i.packages[0].apis.pop());base.index={path:indexPath,bytes:indexBytes.length,sha256:sha(indexBytes)};
    const baseBytes=Buffer.from(JSON.stringify(base)+'\n');map.set(prefix+'/'+basePath,baseBytes);co.input_options.base.catalog_sha256=sha(baseBytes);
    for(const [path,b]of [[indexPath,indexBytes],[basePath,baseBytes]])Object.assign(co.input_files.find(pin=>pin.path===path),{bytes:b.length,sha256:sha(b)});
    sealCohort(map,c,co);
  },/exact selected-world WIT API routes/);
  reject('new cohort cannot impersonate old full Q0',(map,c)=>{const co=JSON.parse(map.get(c.cohort.path));co.schema='wasmc.public-current-refresh-cohort/v1';sealCohort(map,c,co);});
  reject('new closed cohort rejects extra flags',(map,c)=>{const co=JSON.parse(map.get(c.cohort.path));co.q0_accepted=true;sealCohort(map,c,co);},/closed composition product schema/);
  const failedDestination=join(state,'failed-install');
  await assert.rejects(()=>installCurrentLib({catalogBytes,catalogSha256:assembled.catalog_sha256,lockBytes,lockSha256:sha(lockBytes),destination:failedDestination,mirror:'github'},
    async url=>{const b=Buffer.from(transport.get(url));b[0]^=1;return new Response(b,{status:200});}),/install.digest_mismatch/);
  await assert.rejects(()=>lstat(failedDestination),{code:'ENOENT'});
  results.push({name:'actual installer rejects altered staged transport and publishes no destination',pass:true,rejected:true});
  // Fill only absent supporting public files in the owned product fixture.
  // Selected Roots/source/index stay exactly those already checked above.
  for(const name of await readdir(repo)){
    if(['.git','.agents','target','current-libs','libspec'].includes(name))continue;
    await cp(join(repo,name),join(product,name),{recursive:true,force:false});
  }
  const compiler=JSON.parse(await readFile(join(product,'current/compiler-release.json')));
  const protocol=JSON.parse(await readFile(join(product,'agent-evaluation/fresh-agent-learning-v3.json'))),prior=structuredClone(protocol.release_binding);
  Object.assign(protocol.release_binding,{version:compiler.version,compiler_sha256:compiler.compiler.sha256,
    facade_sha256:sha(await readFile(join(product,'current/wasmc.mjs'))),catalog_sha256:assembled.catalog_sha256});
  const replacements=new Map([['v'+prior.version,'v'+compiler.version],
    ...['compiler_sha256','facade_sha256','catalog_sha256'].map(key=>[prior[key],protocol.release_binding[key]])]);
  for(const row of protocol.cases)for(const key of ['required_literals','allowed_sha256'])
    if(row.answer_contract?.[key])row.answer_contract[key]=row.answer_contract[key].map(value=>replacements.get(value)??value);
  await writeFile(join(product,'agent-evaluation/fresh-agent-learning-v3.json'),JSON.stringify(protocol,null,2)+'\n');
  await writeFile(join(product,'docs/RELEASE_V024.md'),'# Unpublished v024 candidate wiring fixture\n');
  const candidatePath=join(state,'candidate-fixture.json');
  const candidateCli=args=>{const invocation=[join(product,'scripts/release-candidate.mjs'),...args],r=spawnSync(process.execPath,invocation,{cwd:product,encoding:'utf8',timeout:120000,maxBuffer:2097152});
    return {invocation,exit:r.status,stdout:r.stdout,stderr:r.stderr};};
  const created=candidateCli(['create-current',candidatePath,compiler.source_commit,compiler.source_commit,compiler.version,...creationArgs]);
  await writeFile(join(state,'candidate-create.json'),JSON.stringify(created,null,2)+'\n');assert.equal(created.exit,0,created.stderr);
  const candidateBytes=await readFile(candidatePath),candidate=JSON.parse(candidateBytes);
  assert.equal(candidate.current_release_closure.package_routes,42);assert.equal(candidate.current_release_closure.api_routes,246);
  assert.equal(candidate.current_release_closure.fresh_full_q0,false);assert.equal(Object.hasOwn(candidate.current_release_closure,'refresh_receipt_sha256'),false);
  assert.ok(candidate.product_files.some(pin=>pin.path.startsWith('admission/current-composition-inputs-v1/')));
  const reopened=candidateCli(['verify',candidatePath,'--candidate-sha256',sha(candidateBytes)]);
  await writeFile(join(state,'candidate-reopen.json'),JSON.stringify(reopened,null,2)+'\n');assert.equal(reopened.exit,0,reopened.stderr);
  const omitted=structuredClone(candidate);omitted.product_files=omitted.product_files.filter(pin=>!pin.path.startsWith('admission/current-composition-inputs-v1/'));
  omitted.product_set_sha256=sha(JSON.stringify(omitted.product_files));const omittedPath=join(state,'candidate-omitted-inputs.json'),omittedBytes=Buffer.from(JSON.stringify(omitted)+'\n');
  await writeFile(omittedPath,omittedBytes);const refused=candidateCli(['verify',omittedPath,'--candidate-sha256',sha(omittedBytes)]);
  await writeFile(join(state,'candidate-omitted-inputs-reopen.json'),JSON.stringify(refused,null,2)+'\n');assert.notEqual(refused.exit,0);
  results.push({name:'actual existing create-current and independently pinned reopen execute for complete composed product fixture',pass:true,formal_release:false});
  results.push({name:'actual candidate reopen rejects self-rehashed omission of original full-base graph',pass:true,rejected:true});
  const report={schema:'wasmc.current-composition-product-controls/v1',accepted:true,tests:results.length,state_root:state,product,
    catalog_sha256:assembled.catalog_sha256,index_sha256:assembled.index_sha256,source_lineage_sha256:assembled.source_lineage_sha256,
    closure,installed,installed_path:destination,network_installation:false,formal_release:false,
    public_artifact_commit_paths_readback_required:true,fresh_builds:0,results};
  await writeFile(join(state,'controls.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(report));
}catch(error){await writeFile(join(state,'failure.json'),JSON.stringify({accepted:false,message:error.message,stack:error.stack},null,2)+'\n',{flag:'wx'});throw error;}
