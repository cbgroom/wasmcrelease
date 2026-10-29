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
const template=read(join('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-duplicate-seal-20261029/portable-typed-preparation','template.json'));
const source=read(join(compilerDir,'../route-typed-fixture/source.wasmc')).toString(),prep=JSON.parse(read(join(fixture,'prepared/merge-assets.json')));
const transfer=read(join('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-duplicate-seal-20261029/portable-typed-preparation','transfer.rs')),cold=read(join('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-duplicate-seal-20261029/portable-typed-preparation','prepared-transfer.wasm'));
assert.equal(sha(read(join('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-duplicate-seal-20261029/portable-typed-preparation','prepared-lib.wasm'))),sha(wasm));
const activation={schema:'wasmc.canonical-host-activation/v1',domain:17,source_sha256:sha(Buffer.from(source)),
  root:{manifest_sha256:sha(manifestBytes),artifact_sha256:sha(wasm),wit_sha256:sha(wit),template_sha256:sha(template)},
  entry_operation_selection:[],operation_selection:['table.transact'],
  cold_transfer:{sha256:sha(cold),source_sha256:sha(transfer)}};
const tuple=n=>Object.fromEntries([['wit','lib.wit'],['executionAbi','execution-abi.json'],['providerContract','provider-contract.json'],['binding','binding.json']].map(([k,p])=>[k,read(join(fixture,'host',n,p))]));
const compiler=read(join(compilerDir,'wasmc_compiler.wasm'));assert.equal(sha(compiler),'30171c7589a96f565212336a64c429ad0b1b64487288a05fce09828bb028718e');
const {createCanonicalHostCompiler}=await import(pathToFileURL(join(compilerDir,'canonical-host.mjs')).href),c=await createCanonicalHostCompiler(compiler);let result;
try{result=await c.compile({source,activation:Buffer.from(JSON.stringify(activation)),entry:tuple('entry'),operations:tuple('operations'),libCore:wasm,libWit:wit,template});}finally{c.dispose();}
assert.equal(result.modules.size,8);mkdirSync(out);for(const [name,bytes] of result.modules){const dest=join(out,name);mkdirSync(resolve(dest,'..'),{recursive:true});writeFileSync(dest,bytes,{flag:'wx'});}
mkdirSync(join(out,'prepared'));writeFileSync(join(out,'prepared/prepared-transfer.wasm'),cold,{flag:'wx'});writeFileSync(join(out,'prepared/prepared-lib-core.wasm'),read(join('/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-duplicate-seal-20261029/portable-typed-preparation','prepared-lib.wasm')),{flag:'wx'});
writeFileSync(join(out,'source.wasmc'),source,{flag:'wx'});writeFileSync(join(out,'frame.bin'),result.frame,{flag:'wx'});
const names=['prepared/prepared-transfer.wasm','caller.wasm','prepared/prepared-lib-core.wasm','lib-projection.wasm','lib-calls.wasm','canonical-entry.wasm','app-projection.wasm','host-entry.wasm','host-projection.wasm','host-calls.wasm'];
const modules=['wasmc-value-staging','wasmc-snapshot-caller','wasmc:lib/wasmc-json@0.2.1','wasmc-native-value-projection','wasmc-native-value-calls','wasmc-canonical-app-entry','wasmc-app-value-projection','wasmc-host-entry','wasmc-host-value-projection','wasmc-native-host-calls'];
const provider=read(join(compilerDir,'lib_core.wasm'));assert.equal(sha(provider),'62182db9d8859acfc79f0e9cebe960d90321829a96ea9d5a9fa041ca42f71c32');
const merge='/opt/homebrew/bin/wasm-merge';assert.equal(sha(read(merge)),'125a6252b0e60a9165612e151417bc2b7121868f734645ed28d6b94b8916995d');
const args=names.flatMap((name,i)=>[join(out,name),modules[i]]);args.push(join(compilerDir,'lib_core.wasm'),'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0','--rename-export-conflicts','--all-features','--quiet','-o',join(out,'app.wasm'));
const m=spawnSync(merge,args,{encoding:'utf8',timeout:120000});assert.equal(m.status,0,m.stderr);
const receipt={accepted:true,root_manifest_sha256:sha(manifestBytes),lib_sha256:sha(wasm),wit_sha256:sha(wit),compiler_sha256:sha(compiler),source_sha256:sha(Buffer.from(source)),frame_sha256:sha(result.frame),app_sha256:sha(read(join(out,'app.wasm'))),modules:8,
  scope:'controlled installed fixture; new Root prepared directly from portable-profile sealed package, test-only wrapper',formal_release:false};
writeFileSync(join(out,'compile-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
