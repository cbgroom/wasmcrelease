#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFileSync(resolve(root, p));
const sha = b => createHash('sha256').update(b).digest('hex');
const json = p => JSON.parse(read(p));
const put = (p, v) => writeFileSync(resolve(root, p), JSON.stringify(v, null, 2)+'\n');
const pin = '032a408b7435333f65f3bc80ef2f5646edf829698bc384a276076bff8d64666a';
const canonical = read('current/wasmc_compiler.wasm');
assert.equal(sha(canonical), pin);
assert.equal(canonical.length, 1442266);
assert.ok(canonical.length <= 2097152);
assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(canonical)), []);
const paths = [
  'AGENTS.md','README.md','LICENSE','license-policy.json','package/package.json',
  'current/index.mjs','current/cli.mjs','current/wasmc.mjs',
  'current/wasmc.global.js','current/wasmc_compiler.wasm','current/lib_core.wasm',
  'dist/wasmc.mjs','dist/wasmc.global.js','package/index.mjs','package/cli.mjs',
  'runtime/wasmc-runtime-v0/compiler.wasm','runtime/wasmc-runtime-v0/bootstrap.mjs',
  'runtime/wasmc-runtime-v0/host/common.mjs','runtime/wasmc-runtime-v0/host/node.mjs',
  'runtime/wasmc-runtime-v0/host/bun.mjs','runtime/wasmc-runtime-v0/host/deno.mjs',
  'runtime/wasmc-runtime-v0/manifest.json','runtime/wasmc-runtime-v0/receipts/compiler-wasm.json',
  'runtime/registry-v0/packages/wasmc-runtime/0.1.0-runtime-v0.json',
  'runtime/registry-v0/channels/dev.json',
  'examples/current/corpus.json','scripts/test-current-compiler.mjs',
  'scripts/test-current-compiler-integrity.mjs',
  'scripts/qualify-current-compiler.mjs',
  'examples/current/standard.mjs','examples/current/standard.wasmc',
  'examples/current/standard-wasmc.wasm','examples/current/standard-rust.wasm',
  'standard/wasmc-std/1.4.0/artifact.wasm','standard/wasmc-std/1.4.0/typed-resource-plan.json',
  'standard/corelib/4.8.0/corelib.wasm',
  'scripts/current-compiler-integrity.mjs'
].sort();
const row = path => {const b=read(path);assert.ok(lstatSync(resolve(root,path)).isFile());return {path,bytes:b.length,sha256:sha(b)};};
function walk(dir='') {
  return readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(e=>{
    if(['.git','target','.DS_Store'].includes(e.name))return [];
    const p=dir?`${dir}/${e.name}`:e.name;
    return e.isDirectory()?walk(p):e.isFile()?[p]:[];
  });
}
const binaries=[], embeddings=[];
for(const p of walk()) {
  if(p.endsWith('.wasm')) {
    const b=read(p);let m;try{m=new WebAssembly.Module(b);}catch{continue;}
    if(WebAssembly.Module.exports(m).some(x=>x.name==='wasmc_compile')) {
      assert.equal(sha(b),pin,`obsolete compiler: ${p}`);binaries.push(p);
    }
  } else if(/\.(mjs|js)$/.test(p)) {
    const source=read(p).toString();
    for(const m of source.matchAll(/function decodeEmbeddedCompiler\(\) \{\s*const binary = atob\("([A-Za-z0-9+/=]+)"\);/g)) {
      assert.equal(sha(Buffer.from(m[1],'base64')),pin,`obsolete embedding: ${p}`);embeddings.push(p);
    }
  }
}
assert.deepEqual(binaries.sort(),['current/wasmc_compiler.wasm','runtime/wasmc-runtime-v0/compiler.wasm']);
assert.deepEqual(embeddings.sort(),['current/wasmc.global.js','current/wasmc.mjs','dist/wasmc.global.js']);
if(process.argv.includes('--refresh')) {
  const runtime=json('runtime/wasmc-runtime-v0/manifest.json');
  runtime.compiler.file=row('runtime/wasmc-runtime-v0/compiler.wasm');
  runtime.compiler.file.path='compiler.wasm';
  runtime.files['compiler.wasm']=runtime.compiler.file;
  put('runtime/wasmc-runtime-v0/manifest.json',runtime);
  const receipt=json('runtime/wasmc-runtime-v0/receipts/compiler-wasm.json');
  receipt.compiler=runtime.compiler.file;
  receipt.manifest={...row('runtime/wasmc-runtime-v0/manifest.json'),path:'manifest.json'};
  receipt.current_compiler_authority='../../../current/compiler-release.json';
  put('runtime/wasmc-runtime-v0/receipts/compiler-wasm.json',receipt);
  const descriptor=json('runtime/registry-v0/packages/wasmc-runtime/0.1.0-runtime-v0.json');
  descriptor.compiler={...descriptor.compiler,...runtime.compiler.file};
  descriptor.manifest=receipt.manifest;
  delete descriptor.source.package_report_sha256;
  descriptor.source.current_compiler_authority='current/compiler-release.json';
  put('runtime/registry-v0/packages/wasmc-runtime/0.1.0-runtime-v0.json',descriptor);
  const channel=json('runtime/registry-v0/channels/dev.json');
  for(const p of channel.packages)if(p.id==='wasmc:runtime') {
    p.compiler_sha256=pin;p.manifest_sha256=receipt.manifest.sha256;
  }
  put('runtime/registry-v0/channels/dev.json',channel);
  const model={schema:'wasmc.current-compiler/v1',version:'0.0.21-compiler.1',
    scope:'Compiler-only current distribution, not a new whole-product or Lib release',
    source_commit:'e76c405f2e30af8bc113108af862637534773582',
    measured_source_commit:'6ef47df7d4cf3eadcae81db7cab06b9d52669a4b',
    source_inputs_equal:1259,source_build_receipt_sha256:'8c07771736fbfebfe08410ac63d9f6fe4e237c139b9da288e4fb61908587aa0d',
    cargo_lock_sha256:'6020cd42d0f5225c06ab5eaabb0e944d8e60a0e6e9b007707f7fc52719db2c92',
    compiler:row('current/wasmc_compiler.wasm'),imports:0,max_bytes:2097152,
    standard_app_sha256:'08a6cb5e7f19cc0f01ef8cc034da6834c8932adf1c3919eff5cc24ae4959ff32',
    active_compiler_versions:1,binary_paths:binaries,embedded_paths:embeddings,
    whole_product_release:{tag:'v0.0.20',commit:'4674d65c2650e6cbdddc3a4d0f4510911ae97ea3',unchanged:true},
    immutable_selection:'Pin this public Git commit and verify artifacts against this manifest; main is mutable discovery only',
    verify:'node scripts/current-compiler-integrity.mjs',
    artifacts:paths.map(row),
    nonclaims:['new Lib admission','whole-product release closure','cross-toolchain reproducible rebuilding','publisher signature','real browser or native SDK requalification']};
  put('current/compiler-release.json',model);
}
const model=json('current/compiler-release.json');
assert.equal(model.schema,'wasmc.current-compiler/v1');assert.equal(model.compiler.sha256,pin);
assert.equal(model.version,'0.0.21-compiler.1');
assert.equal(model.source_commit,'e76c405f2e30af8bc113108af862637534773582');
assert.equal(model.measured_source_commit,'6ef47df7d4cf3eadcae81db7cab06b9d52669a4b');
assert.deepEqual(model.compiler,row('current/wasmc_compiler.wasm'));
assert.equal(model.active_compiler_versions,1);
assert.deepEqual(model.artifacts,paths.map(row));
assert.deepEqual(model.binary_paths,binaries);assert.deepEqual(model.embedded_paths,embeddings);
const runtime=json('runtime/wasmc-runtime-v0/manifest.json');
assert.equal(runtime.compiler.file.sha256,pin);
const receipt=json('runtime/wasmc-runtime-v0/receipts/compiler-wasm.json');
assert.equal(receipt.compiler.sha256,pin);
assert.equal(receipt.manifest.sha256,sha(read('runtime/wasmc-runtime-v0/manifest.json')));
const descriptor=json('runtime/registry-v0/packages/wasmc-runtime/0.1.0-runtime-v0.json');
assert.equal(descriptor.compiler.sha256,pin);assert.equal(descriptor.manifest.sha256,receipt.manifest.sha256);
const channel=json('runtime/registry-v0/channels/dev.json');
assert.equal(channel.packages.find(x=>x.id==='wasmc:runtime').compiler_sha256,pin);
assert.equal(channel.packages.find(x=>x.id==='wasmc:runtime').manifest_sha256,receipt.manifest.sha256);
if(!process.argv.includes('--refresh')&&existsSync(resolve(root,'current/qualification.json'))) {
  const q=json('current/qualification.json');
  assert.equal(q.schema,'wasmc.current-compiler-qualification/v1');assert.equal(q.accepted,true);
  assert.equal(q.compiler_sha256,pin);
  assert.equal(q.product_manifest_sha256,sha(read('current/compiler-release.json')));
  assert.equal(q.source_free,true);
}
if(process.argv.includes('--require-qualification'))assert.ok(existsSync(resolve(root,'current/qualification.json')));
console.log(JSON.stringify({accepted:true,version:model.version,compiler_sha256:pin,active_compiler_versions:1,binaries:binaries.length,embeddings:embeddings.length,artifacts:model.artifacts.length}));
