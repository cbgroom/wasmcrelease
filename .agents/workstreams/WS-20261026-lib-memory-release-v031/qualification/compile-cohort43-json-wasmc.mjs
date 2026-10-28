// Compile the installed 43-cohort JSON Root with a previously qualified WAsmC
// Host contract, after rechecking WIT and all public Core signatures.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const [root,oldRoot,fixture,compilerDir,out]=process.argv.slice(2);
assert.ok([root,oldRoot,fixture,compilerDir,out].every(p=>isAbsolute(p??'')));
const read=readFileSync,sha=b=>createHash('sha256').update(b).digest('hex');
const manifestBytes=read(join(root,'lib.json')),manifest=JSON.parse(manifestBytes),wasm=read(join(root,'artifact.wasm')),wit=read(join(root,'lib.wit'));
assert.equal(manifest.id,'wasmc-json');assert.equal(manifest.version,'0.2.1');assert.equal(sha(wasm),manifest.artifact.sha256);
const oldTemplate=JSON.parse(read(join(fixture,'canonical-template.json'))),oldManifest=read(join(oldRoot,'lib.json'));
assert.equal(sha(oldManifest),oldTemplate.manifest_sha256);assert.equal(sha(wit),oldTemplate.wit_sha256);
assert.equal(sha(read(join(oldRoot,'artifact.wasm'))),oldTemplate.artifact_sha256);
const before=JSON.parse(read(join(oldRoot,'core-abi.json'))),after=JSON.parse(read(join(root,'core-abi.json')));
assert.equal(after.artifact_sha256,sha(wasm));assert.deepEqual(before.imports,after.imports);
const normalized=x=>Object.fromEntries(x.map(({index,...rest})=>[rest.name,rest])),a=normalized(before.exports),b=normalized(after.exports);
for(const [name,shape] of Object.entries(a)){if(name==='__data_end'||name==='__heap_base'||name.startsWith('cabi_realloc_wit_bindgen_'))continue;assert.deepEqual(b[name],shape,`changed Core export ${name}`);}
const template=Buffer.from(JSON.stringify({...oldTemplate,manifest_sha256:sha(manifestBytes),artifact_sha256:sha(wasm)})+'\n');
const source=read(join(fixture,'source.wasmc')).toString(),prep=JSON.parse(read(join(fixture,'prepared/merge-assets.json')));
const transfer=read(join(fixture,'transfer.rs')),cold=read(join(fixture,'prepared/prepared-transfer.wasm'));
assert.equal(sha(transfer),prep.cold_source_sha256);assert.equal(sha(cold),prep.prepared_cold.sha256);
assert.equal(sha(read(join(fixture,'prepared/prepared-lib-core.wasm'))),sha(read(join(oldRoot,'artifact.wasm'))));
const activation={schema:'wasmc.canonical-host-activation/v1',domain:17,source_sha256:sha(Buffer.from(source)),
  root:{manifest_sha256:sha(manifestBytes),artifact_sha256:sha(wasm),wit_sha256:sha(wit),template_sha256:sha(template)},
  entry_operation_selection:[],operation_selection:['service.invoke','table.response-len','table.response-drop'],
  cold_transfer:{sha256:sha(cold),source_sha256:sha(transfer)}};
const tuple=n=>Object.fromEntries([['wit','lib.wit'],['executionAbi','execution-abi.json'],['providerContract','provider-contract.json'],['binding','binding.json']].map(([k,p])=>[k,read(join(fixture,'host',n,p))]));
const compiler=read(join(compilerDir,'wasmc_compiler.wasm'));assert.equal(sha(compiler),'ac2f8ce5555d130d2f4dea9827cf7f1d06fdd080dc691bc310f10e10b9ac1c9e');
const {createCanonicalHostCompiler}=await import(pathToFileURL(join(compilerDir,'canonical-host.mjs')).href),c=await createCanonicalHostCompiler(compiler);let result;
try{result=await c.compile({source,activation:Buffer.from(JSON.stringify(activation)),entry:tuple('entry'),operations:tuple('operations'),libCore:wasm,libWit:wit,template});}finally{c.dispose();}
assert.equal(result.modules.size,8);mkdirSync(out);for(const [name,bytes] of result.modules){const dest=join(out,name);mkdirSync(resolve(dest,'..'),{recursive:true});writeFileSync(dest,bytes,{flag:'wx'});}
mkdirSync(join(out,'prepared'));writeFileSync(join(out,'prepared/prepared-transfer.wasm'),cold,{flag:'wx'});writeFileSync(join(out,'prepared/prepared-lib-core.wasm'),wasm,{flag:'wx'});
writeFileSync(join(out,'source.wasmc'),source,{flag:'wx'});writeFileSync(join(out,'frame.bin'),result.frame,{flag:'wx'});
const names=['prepared/prepared-transfer.wasm','caller.wasm','prepared/prepared-lib-core.wasm','lib-projection.wasm','lib-calls.wasm','canonical-entry.wasm','app-projection.wasm','host-entry.wasm','host-projection.wasm','host-calls.wasm'];
const modules=['wasmc-value-staging','wasmc-snapshot-caller','wasmc:lib/wasmc-json@0.2.1','wasmc-native-value-projection','wasmc-native-value-calls','wasmc-canonical-app-entry','wasmc-app-value-projection','wasmc-host-entry','wasmc-host-value-projection','wasmc-native-host-calls'];
const provider=read(join(compilerDir,'lib_core.wasm'));assert.equal(sha(provider),'62182db9d8859acfc79f0e9cebe960d90321829a96ea9d5a9fa041ca42f71c32');
const merge='/opt/homebrew/bin/wasm-merge';assert.equal(sha(read(merge)),'125a6252b0e60a9165612e151417bc2b7121868f734645ed28d6b94b8916995d');
const args=names.flatMap((name,i)=>[join(out,name),modules[i]]);args.push(join(compilerDir,'lib_core.wasm'),'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0','--rename-export-conflicts','--all-features','--quiet','-o',join(out,'app.wasm'));
const m=spawnSync(merge,args,{encoding:'utf8',timeout:120000});assert.equal(m.status,0,m.stderr);
const receipt={accepted:true,root_manifest_sha256:sha(manifestBytes),lib_sha256:sha(wasm),wit_sha256:sha(wit),compiler_sha256:sha(compiler),source_sha256:sha(Buffer.from(source)),frame_sha256:sha(result.frame),app_sha256:sha(read(join(out,'app.wasm'))),modules:8,
  scope:'controlled installed fixture; old transfer and template rebound after exact WIT and Core signature checks',formal_release:false};
writeFileSync(join(out,'compile-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
