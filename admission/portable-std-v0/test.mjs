import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {packageReader, sha256} from '../../scripts/lib-catalog.mjs';

const root=fileURLToPath(new URL('./',import.meta.url));
const repository=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('manifest.json',import.meta.url)));
const read=packageReader(root), repoRead=packageReader(repository);
const fail=code=>{throw new Error(code);};
function preflight(m, readCandidate=read, readRepo=repoRead, validate=b=>WebAssembly.validate(b)) {
  if(m.schema!=='wasmc.portable-std-admission/v0'||m.package?.version!=='1.4.1'||m.package.wit_package!=='wasmc:std@1.4.1'||!Array.isArray(m.files)||m.files.length!==12)fail('portable.contract_invalid');
  const data=new Map();
  for(const row of m.files){
    if(typeof row.path!=='string'||row.path.startsWith('/')||row.path.includes('\\')||row.path.split('/').some(v=>!v||v==='.'||v==='..')||data.has(row.path))fail('portable.path_invalid');
    const bytes=readCandidate(row.path);
    if(bytes.length!==row.bytes||sha256(bytes)!==row.sha256)fail('artifact.identity_mismatch');
    data.set(row.path,bytes);
  }
  if(m.corelib?.path!=='standard/corelib/4.8.0/corelib.wasm')fail('portable.corelib_invalid');
  const provider=readRepo(m.corelib.path);
  if(provider.length!==m.corelib.bytes||sha256(provider)!==m.corelib.sha256)fail('artifact.identity_mismatch');
  data.set('provider.wasm',provider);
  const metadata=JSON.parse(data.get('package/lib.json'));
  assert.equal(metadata.version,m.package.version);
  assert.equal(metadata.wit.package,m.package.wit_package);
  assert.equal(metadata.bindings.rust_core.import_module,'wasmc:lib/wasmc.std@1.4.1');
  assert.equal(metadata.bindings.rust_core.functions,73);
  assert.equal(metadata.artifact.sha256,sha256(data.get('package/artifact.wasm')));
  assert.equal(metadata.wit.sha256,sha256(data.get('package/lib.wit')));
  assert.match(data.get('package/lib.wit').toString(),/^package wasmc:std@1\.4\.1;/);
  for(const name of ['provider.wasm','package/artifact.wasm','rust.wasm','wasmc.wasm']){
    if(!validate(data.get(name)))fail('engine.artifact_unsupported');
  }
  return data;
}
const data=preflight(manifest);
let negative=0;
const reject=(change,reader=read,repoReader=repoRead,validator=b=>WebAssembly.validate(b))=>{
  const m=structuredClone(manifest);change(m);
  assert.throws(()=>preflight(m,reader,repoReader,validator));negative++;
};
reject(m=>m.package.version='1.4.0');
reject(m=>m.package.wit_package='wasmc:std@1.4.0');
reject(m=>m.files[0].path='../outside');
reject(m=>m.files[1]=m.files[0]);
reject(m=>m.files[1].sha256='0'.repeat(64));
reject(m=>m.files[1].bytes++);
reject(()=>{},path=>{const b=read(path);return path==='package/artifact.wasm'?b.subarray(1):b;});
reject(()=>{},path=>{if(path==='rust.wasm')fail('fixture.missing');return read(path);});
reject(m=>m.corelib.sha256='0'.repeat(64));
reject(()=>{},read,repoRead,()=>false);
const providerModule=new WebAssembly.Module(data.get('provider.wasm'));
assert.equal(WebAssembly.Module.imports(providerModule).length,0);
const libModule=new WebAssembly.Module(data.get('package/artifact.wasm'));
for(const x of WebAssembly.Module.imports(libModule)){
  assert.equal(x.module,'wasmc:lib/wasmc.lib_managed_object_heap@4.8.0');assert.equal(x.kind,'function');
}
const consumers=[];
for(const file of ['rust.wasm','wasmc.wasm']){
  const provider=new WebAssembly.Instance(providerModule,{});
  assert.equal(provider.exports.provider_domain_init(127,7),0);
  const lib=new WebAssembly.Instance(libModule,{'wasmc:lib/wasmc.lib_managed_object_heap@4.8.0':provider.exports});
  assert.equal(lib.exports.std_init(),0);
  const module=new WebAssembly.Module(data.get(file));
  for(const x of WebAssembly.Module.imports(module)){assert.equal(x.module,'wasmc:lib/wasmc.std@1.4.1');assert.equal(x.kind,'function');}
  assert.throws(()=>new WebAssembly.Instance(module,{'wasmc:lib/wasmc.std@1.4.0':lib.exports}));negative++;
  const app=new WebAssembly.Instance(module,{'wasmc:lib/wasmc.std@1.4.1':lib.exports});
  let calls=0;
  for(let round=0;round<128;round++)for(const index of [0,1,2,99,4294967295])for(const byte of [0,1,128,255]){
    const result=app.exports.run(index,byte);
    assert.equal(Array.isArray(result)?result[0]:result,[-7,0,2147483647][index]??9);
    if(Array.isArray(result))assert.equal(result[1],0);
    calls++;
  }
  consumers.push({file,calls});
}
const frozen=JSON.parse(repoRead('channels/candidates/0.0.10.json'));
for(const row of frozen.product_files){const b=repoRead(row.path);assert.equal(b.length,row.bytes);assert.equal(sha256(b),row.sha256);}
const original=repoRead('standard/wasmc-std/1.4.0/artifact.wasm');
const legacy=process.versions.node?.startsWith('18.')&&!globalThis.Bun&&!globalThis.Deno;
if(legacy)assert.equal(WebAssembly.validate(original),false);
// Actions checks its checkout SHA before this runner; local runs have no CI SHA.
const commit=process.env.GITHUB_SHA??null;
console.log(JSON.stringify({accepted:true,public_commit:commit,private_source_revision:manifest.private_source_revision,engine:globalThis.Bun?'bun':globalThis.Deno?'deno':'node',version:globalThis.Bun?.version??globalThis.Deno?.version.deno??process.version,functions:73,rounds:128,vectors:20,consumers,negative_tests:negative,legacy_original_rejected:!!legacy,frozen_products_verified:frozen.product_files.length,release_promoted:false}));
