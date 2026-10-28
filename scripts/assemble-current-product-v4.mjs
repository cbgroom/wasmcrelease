import assert from 'node:assert/strict';
import {cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentReleasePreflight} from './lib-current-release-preflight.mjs';
import {inventory,digest,sha,atomicJson} from './lib-refresh-cache-v2.mjs';
import {verifyCurrentReleaseV4} from './current-lib-release-v3.mjs';
export async function assembleCurrentProductV4(repo,{runRoot,receiptSha256,producerSha256,indexPath,indexSha256,
  version,artifactCommit,out,witTool,witToolSha256}) {
  for(const pin of [receiptSha256,producerSha256,indexSha256,witToolSha256])assert.match(pin,/^[0-9a-f]{64}$/);
  assert.match(artifactCommit,/^[0-9a-f]{40}$/);assert.match(version,/^\d+\.\d+\.\d+$/);
  assert.ok(isAbsolute(runRoot)&&isAbsolute(indexPath)&&isAbsolute(out)&&isAbsolute(witTool));
  const preflight=await currentReleasePreflight(repo,{run_root:runRoot,receipt_sha256:receiptSha256,
    producer_sha256:producerSha256,wit_tool:witTool,wit_tool_sha256:witToolSha256});
  assert.equal(preflight.accepted,true,JSON.stringify(preflight.blockers));
  const receiptBytes=await readFile(join(runRoot,'refresh-receipt.json'));assert.equal(sha(receiptBytes),receiptSha256);
  const receipt=JSON.parse(receiptBytes);assert.ok(isAbsolute(receipt.release_license_input?.path??''));
  const license=await readFile(receipt.release_license_input.path);assert.equal(sha(license),receipt.release_license_input.sha256);
  const inputPin=path=>path.startsWith(repo+'/')?receipt.source_digests[path.slice(repo.length+1)]:receipt.producer_input_digests[path];
  assert.equal(inputPin(receipt.release_license_input.path),sha(license),'explicit Q0 license input');
  const indexBytes=await readFile(indexPath);assert.equal(sha(indexBytes),indexSha256);
  assert.equal(preflight.index.index_sha256,indexSha256,'independently generated complete current index');
  const index=JSON.parse(indexBytes),registryBytes=await readFile(join(repo,'libspec/registry.json'));
  assert.equal(index.registry_sha256,sha(registryBytes));
  await mkdir(out,{recursive:true});assert.deepEqual(await readdir(out),[],'new isolated product output required');
  await mkdir(join(out,'catalog'));await mkdir(join(out,'libspec'));await mkdir(join(out,'admission'));
  await writeFile(join(out,'LICENSE'),license);await writeFile(join(out,'libspec/registry.json'),registryBytes);
  await writeFile(join(out,'catalog/current-index-v2.json'),indexBytes);
  const packages=[];const publicSourceInputs={};
  for(const row of receipt.rows){
    const before=await inventory(row.package_root);assert.equal(digest(before),row.root_inventory_sha256);
    const root='current-libs/'+row.id+'/'+row.version;
    await cp(row.package_root,join(out,root),{recursive:true,errorOnExist:true,force:false});
    const files=await inventory(join(out,root));assert.deepEqual(files,before);
    const manifest=JSON.parse(await readFile(join(out,root,'lib.json')));
    const selected=index.packages.find(p=>p.package_id===row.id);assert.ok(selected);
    const sourcePath='libspec/'+row.id;await mkdir(join(out,sourcePath),{recursive:true});
    const source={};
    for(const name of ['lib.json','lib.wit']){
      const b=await readFile(join(repo,sourcePath,name)),path=sourcePath+'/'+name;
      assert.equal(sha(b),receipt.source_digests[path],'independent Q0 authored input');
      await writeFile(join(out,path),b);source[name==='lib.json'?'spec':'wit']={path,bytes:b.length,sha256:sha(b)};
      publicSourceInputs[path]=sha(b);
    }
    const spec=JSON.parse(await readFile(join(out,sourcePath,'lib.json')));assert.equal(spec.version,row.version);assert.equal(spec.profile,row.profile);
    const copy=file=>file?{path:file.path,bytes:file.bytes,sha256:file.sha256}:null;
    packages.push({id:row.id,version:row.version,profile:row.profile,target:selected.target,root,
      manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256,
      wit_sha256:manifest.wit.sha256,wit_world:spec.world,source,views:Object.keys(manifest.bindings).sort(),
      delivery:{kind:selected.delivery.artifact_kind,artifact:copy(manifest.artifact),
        component:copy(manifest.component),native_status:manifest.native?.status??null,device_qualified:false},
      files:Object.entries(files).map(([path,pin])=>({path:root+'/'+path,...pin}))});
  }
  const noticePath='licenses/dependency-notices-v4.json';
  const inputPath=receipt.release_notices_input?.path;assert.ok(isAbsolute(inputPath??''));
  const noticeBytes=await readFile(inputPath);assert.equal(sha(noticeBytes),receipt.release_notices_input.sha256);
  assert.equal(inputPin(inputPath),sha(noticeBytes),'explicit Q0 notices input');
  const noticeManifest=JSON.parse(noticeBytes);assert.equal(noticeManifest.schema,'wasmc.release-notices-input/v1');
  await mkdir(join(out,'licenses'));await writeFile(join(out,noticePath),noticeBytes);publicSourceInputs[noticePath]=sha(noticeBytes);
  for(const pin of noticeManifest.files){
    assert.match(pin.path,/^licenses\/[A-Za-z0-9_.-]{1,128}$/);
    const input=join(dirname(inputPath),pin.path.slice('licenses/'.length));
    const b=await readFile(input);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256);
    assert.equal(inputPin(input),pin.sha256,'independent Q0 notice input');
    await writeFile(join(out,pin.path),b);publicSourceInputs[pin.path]=sha(b);
  }
  const releaseNotices={manifest:{path:noticePath,bytes:noticeBytes.length,sha256:sha(noticeBytes)},files:noticeManifest.files};
  const cohort={schema:'wasmc.public-current-refresh-cohort/v2',q0_accepted:true,
    refresh_receipt_sha256:receiptSha256,producer_sha256:producerSha256,
    source_fingerprint:index.source_fingerprint,source_inputs:publicSourceInputs,release_notices:releaseNotices,
    wit_tool_sha256:witToolSha256,wit_normalizations:preflight.wit_normalizations.map(p=>({id:p.id,mode:p.mode,
      authored_sha256:p.authored_sha256,delivered_sha256:p.delivered_sha256,normalized_sha256:p.normalized_sha256??null,
      tool_sha256:p.tool?.sha256??null,dependencies:p.dependencies??[]})),
    generator_digests:receipt.generator_digests,
    cargo_lock_sha256:receipt.cargo_lock_sha256,release_license_sha256:sha(license),
    selected:receipt.selected,rows:receipt.rows.map(row=>({id:row.id,version:row.version,profile:row.profile,
      manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256,
      artifact_sha256:row.artifact_sha256,component_sha256:row.component_sha256})),
    public_admission:false,scope:'Exact complete source/Q0 outputs; runtime, device, install, Pi and whole release gates remain independent'};
  await atomicJson(join(out,'admission/current-refresh-cohort-v2.json'),cohort);
  const descriptor=async path=>{const b=await readFile(join(out,path));return {path,bytes:b.length,sha256:sha(b)};};
  const catalog={schema:'wasmc.public-lib-catalog/v2',version,package_authority_commit:artifactCommit,
    registry:await descriptor('libspec/registry.json'),index:await descriptor('catalog/current-index-v2.json'),
    cohort:await descriptor('admission/current-refresh-cohort-v2.json'),packages};
  await atomicJson(join(out,'catalog/libs-current-v2.json'),catalog);
  const catalogBytes=await readFile(join(out,'catalog/libs-current-v2.json'));
  const all=await inventory(out),data=new Map();
  for(const path of Object.keys(all))data.set(path,await readFile(join(out,path)));
  const read=path=>{assert.ok(data.has(path),'missing public package input: '+path);return data.get(path);};
  const checked=verifyCurrentReleaseV4(catalogBytes,sha(catalogBytes),read,Object.keys(all));
  const frozenNotices=await readFile(new URL('../catalog/frozen-v030-notices-v1.json',import.meta.url));
  assert.equal(sha(frozenNotices),'1aac7ddafa47bd0a5497202ce95d1fa8cfba759cdb15a1a570f479d2f422ea58','immutable historical notice inventory');
  await writeFile(join(out,'catalog/frozen-v030-notices-v1.json'),frozenNotices,{flag:'wx'});
  await atomicJson(join(out,'catalog/current-v4-license-policy.json'),{
    schema:'wasmc.current-license-policy/v2',version,catalog_sha256:sha(catalogBytes),
    package_authority_commit:artifactCommit,current_packages:packages.length,standard_root_mirrors:[],
  });
  assert.equal(sha(await readFile(join(runRoot,'refresh-receipt.json'))),receiptSha256);
  for(const row of receipt.rows)assert.equal(digest(await inventory(row.package_root)),row.root_inventory_sha256);
  await atomicJson(join(out,'admission/current-product-v4.json'),checked);
  return {accepted:true,out,catalog_sha256:sha(catalogBytes),closure:checked,
    actual_artifact_commit_readback_required:true,source_private_payload_published:false,public_admission:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const names={'--run-root':'runRoot','--receipt-sha256':'receiptSha256','--producer-sha256':'producerSha256',
    '--index':'indexPath','--index-sha256':'indexSha256','--version':'version',
    '--artifact-commit':'artifactCommit','--out':'out','--wit-tool':'witTool','--wit-tool-sha256':'witToolSha256'};
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i+=2){assert.ok(names[args[i]]&&!options[names[args[i]]]&&args[i+1]);options[names[args[i]]]=args[i+1];}
  assert.deepEqual(Object.keys(options).sort(),Object.values(names).sort(),'all independent assembly inputs required');
  console.log(JSON.stringify(await assembleCurrentProductV4(process.cwd(),options)));
}
