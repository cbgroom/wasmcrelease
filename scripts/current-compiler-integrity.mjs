#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,lstatSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(resolve(root,p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(read(p));
const put=(p,v)=>writeFileSync(resolve(root,p),JSON.stringify(v,null,2)+'\n');
const row=p=>{assert.ok(lstatSync(resolve(root,p)).isFile());const b=read(p);return{path:p,bytes:b.length,sha256:sha(b)};};
function walk(d=''){return readdirSync(resolve(root,d),{withFileTypes:true}).flatMap(e=>{
 if(['.git','target','.DS_Store'].includes(e.name))return[];
 const p=d?d+'/'+e.name:e.name;assert.ok(!lstatSync(resolve(root,p)).isSymbolicLink(),p);
 return e.isDirectory()?walk(p):e.isFile()?[p]:[];
});}
const refresh=process.argv[2]==='--refresh';
const options={};
if(refresh){const args=process.argv.slice(3);assert.equal(args.length,14);
 for(let i=0;i<args.length;i+=2){assert.ok(!Object.hasOwn(options,args[i]));options[args[i]]=args[i+1];}
 for(const k of ['--compiler-sha256','--build-receipt-sha256','--cargo-lock-sha256','--standard-app-sha256'])assert.match(options[k]??'',/^[a-f0-9]{64}$/);
 assert.match(options['--source-commit']??'',/^[a-f0-9]{40}$/);assert.equal(options['--version'],'0.0.21');assert.ok(options['--source-branch']);
}
const prior=refresh?null:json('current/compiler-release.json');
const pin=refresh?options['--compiler-sha256']:prior.compiler.sha256;
const canonical=read('current/wasmc_compiler.wasm');
assert.equal(sha(canonical),pin);assert.ok(canonical.length<=2097152);
const cm=new WebAssembly.Module(canonical);assert.deepEqual(WebAssembly.Module.imports(cm),[]);
for(const name of ['memory','wasmc_alloc','wasmc_compile','wasmc_output_ptr','wasmc_output_len','wasmc_error_ptr','wasmc_error_len','wasmc_clear'])assert.ok(WebAssembly.Module.exports(cm).some(e=>e.name===name));
const binaries=[],embeddings=[];
for(const p of walk()){
 if(p.endsWith('.wasm')){let m;const b=read(p);try{m=new WebAssembly.Module(b);}catch{continue;}
  if(WebAssembly.Module.exports(m).some(e=>e.name==='wasmc_compile')){assert.equal(sha(b),pin,'obsolete compiler '+p);binaries.push(p);}
 }else if(/\.(mjs|js)$/.test(p)){
  for(const m of read(p).toString().matchAll(/function decodeEmbeddedCompiler\(\) \{\s*const binary = atob\("([A-Za-z0-9+/=]+)"\);/g)){assert.equal(sha(Buffer.from(m[1],'base64')),pin,'obsolete embedding '+p);embeddings.push(p);}
 }
}
assert.deepEqual(binaries.sort(),['current/wasmc_compiler.wasm','runtime/wasmc-runtime-v0/compiler.wasm']);
assert.deepEqual(embeddings.sort(),['current/wasmc.global.js','current/wasmc.mjs','dist/wasmc.global.js']);
if(refresh){
 const runtime=json('runtime/wasmc-runtime-v0/manifest.json');runtime.compiler.file={...row('runtime/wasmc-runtime-v0/compiler.wasm'),path:'compiler.wasm'};runtime.files['compiler.wasm']=runtime.compiler.file;put('runtime/wasmc-runtime-v0/manifest.json',runtime);
 const receipt=json('runtime/wasmc-runtime-v0/receipts/compiler-wasm.json');receipt.compiler=runtime.compiler.file;receipt.manifest={...row('runtime/wasmc-runtime-v0/manifest.json'),path:'manifest.json'};receipt.current_compiler_authority='../../../current/compiler-release.json';put('runtime/wasmc-runtime-v0/receipts/compiler-wasm.json',receipt);
 const descriptor=json('runtime/registry-v0/packages/wasmc-runtime/0.1.0-runtime-v0.json');descriptor.compiler={...descriptor.compiler,...runtime.compiler.file};descriptor.manifest=receipt.manifest;delete descriptor.source.package_report_sha256;descriptor.source.current_compiler_authority='current/compiler-release.json';put('runtime/registry-v0/packages/wasmc-runtime/0.1.0-runtime-v0.json',descriptor);
 const channel=json('runtime/registry-v0/channels/dev.json');for(const p of channel.packages)if(p.id==='wasmc:runtime'){p.compiler_sha256=pin;p.manifest_sha256=receipt.manifest.sha256;}put('runtime/registry-v0/channels/dev.json',channel);
 const paths=[...walk('current').filter(p=>!['current/compiler-release.json','current/qualification.json'].includes(p)),
 ...walk('dist'),...walk('package'),...walk('examples/current'),...walk('standard'),
 'compatibility/core-artifacts-v021.json','scripts/core-compatibility.mjs','scripts/test-current-lib-api-v021.mjs','scripts/current-compiler-integrity.mjs','scripts/test-current-compiler-integrity.mjs','scripts/test-current-compiler.mjs','scripts/qualify-current-compiler.mjs',
 'runtime/wasmc-runtime-v0/compiler.wasm','runtime/wasmc-runtime-v0/manifest.json','runtime/wasmc-runtime-v0/receipts/compiler-wasm.json','runtime/registry-v0/packages/wasmc-runtime/0.1.0-runtime-v0.json','runtime/registry-v0/channels/dev.json'].sort();
 put('current/compiler-release.json',{schema:'wasmc.current-compiler/v2',version:options['--version'],source_commit:options['--source-commit'],source_branch:options['--source-branch'],source_build_receipt_sha256:options['--build-receipt-sha256'],cargo_lock_sha256:options['--cargo-lock-sha256'],compiler:row('current/wasmc_compiler.wasm'),imports:0,max_bytes:2097152,standard_app_sha256:options['--standard-app-sha256'],active_compiler_versions:1,binary_paths:binaries,embedded_paths:embeddings,artifacts:paths.map(row),immutable_selection:'Use the whole product candidate digest and fixed public commit; mutable main is discovery.',scope:'Current compiler identity and carrier integrity; whole product and publication require independent release admission'});
}
const model=json('current/compiler-release.json');assert.equal(model.schema,'wasmc.current-compiler/v2');assert.equal(model.version,'0.0.21');assert.match(model.source_commit,/^[a-f0-9]{40}$/);assert.match(model.source_build_receipt_sha256,/^[a-f0-9]{64}$/);assert.match(model.cargo_lock_sha256,/^[a-f0-9]{64}$/);
assert.deepEqual(model.compiler,row('current/wasmc_compiler.wasm'));assert.equal(model.active_compiler_versions,1);assert.deepEqual(model.binary_paths,binaries);assert.deepEqual(model.embedded_paths,embeddings);
assert.equal(new Set(model.artifacts.map(r=>r.path)).size,model.artifacts.length);for(const v of model.artifacts)assert.deepEqual(v,row(v.path));
const runtime=json('runtime/wasmc-runtime-v0/manifest.json'),receipt=json('runtime/wasmc-runtime-v0/receipts/compiler-wasm.json'),descriptor=json('runtime/registry-v0/packages/wasmc-runtime/0.1.0-runtime-v0.json'),channel=json('runtime/registry-v0/channels/dev.json');
assert.equal(runtime.compiler.file.sha256,pin);assert.equal(receipt.compiler.sha256,pin);assert.equal(receipt.manifest.sha256,sha(read('runtime/wasmc-runtime-v0/manifest.json')));assert.equal(descriptor.compiler.sha256,pin);assert.equal(descriptor.manifest.sha256,receipt.manifest.sha256);
assert.equal(channel.packages.find(p=>p.id==='wasmc:runtime').compiler_sha256,pin);assert.equal(channel.packages.find(p=>p.id==='wasmc:runtime').manifest_sha256,receipt.manifest.sha256);
if(!refresh&&existsSync(resolve(root,'current/qualification.json'))){const q=json('current/qualification.json');assert.equal(q.accepted,true);assert.equal(q.compiler_sha256,pin);assert.equal(q.product_manifest_sha256,sha(read('current/compiler-release.json')));assert.equal(q.source_free,true);}
if(process.argv.includes('--require-qualification'))assert.ok(existsSync(resolve(root,'current/qualification.json')));
console.log(JSON.stringify({accepted:true,version:model.version,compiler_sha256:pin,active_compiler_versions:1,binaries:binaries.length,embeddings:embeddings.length,artifacts:model.artifacts.length}));
