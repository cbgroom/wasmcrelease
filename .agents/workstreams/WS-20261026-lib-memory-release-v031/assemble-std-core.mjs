import fs from 'node:fs';
import cp from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const [raw,out]=process.argv.slice(2);assert(raw&&out);fs.mkdirSync(out,{recursive:false});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline='standard/wasmc-std/1.4.1/artifact.wasm',old=fs.readFileSync(baseline),fresh=fs.readFileSync(raw);
assert.equal(sha(old),'b79a499c8300361125e7fcdae02170184b82d4bbeff4d8f24ed95f3fd4db8d3b');
const names=new Set(WebAssembly.Module.exports(new WebAssembly.Module(old)).map(x=>x.name));
const newNames=new Set(WebAssembly.Module.exports(new WebAssembly.Module(fresh)).filter(x=>x.kind==='function'&&names.has(x.name)&&/std_(structured_|base64_|hex_|integer_text_|bytes_)/.test(x.name)).map(x=>x.name));
function tool(exe,args){const p=cp.spawnSync(exe,args,{encoding:'utf8'});assert.equal(p.status,0,p.stderr);return p.stdout;}
for(const [name,bytes]of[['old',old],['new',fresh]]){
 fs.writeFileSync(path.join(out,name+'.wasm'),bytes);
 tool('wasm-tools',['print',path.join(out,name+'.wasm'),'-o',path.join(out,name+'.wat')]);
 let wat=fs.readFileSync(path.join(out,name+'.wat'),'utf8');
 wat=wat.replace(/\(export "([^"]+)" \((func|memory|global|table) [^)]*\)\)/g,(all,n,kind)=>{
  if(name==='old'&&n==='std_init')return all.replace('"std_init"','"predecessor_init"');
  if(name==='old')return newNames.has(n)?'':all;
  return newNames.has(n)||n==='std_structured_text_init'?all:'';
 });
 fs.writeFileSync(path.join(out,name+'.wat'),wat);tool('wasm-tools',['parse',path.join(out,name+'.wat'),'-o',path.join(out,name+'-selected.wasm')]);
}
const wrapper=`(module
(import "predecessor" "predecessor_init" (func $old (result i32)))
(import "successor" "std_structured_text_init" (func $new (result i32)))
(func (export "std_init") (result i32) (local $status i32)
 call $old local.tee $status if local.get $status return end call $new))`;
fs.writeFileSync(path.join(out,'init.wat'),wrapper);tool('wasm-tools',['parse',path.join(out,'init.wat'),'-o',path.join(out,'init.wasm')]);
tool('/opt/homebrew/bin/wasm-merge',[path.join(out,'init.wasm'),'initializer',path.join(out,'new-selected.wasm'),'successor',path.join(out,'old-selected.wasm'),'predecessor','--all-features','-o',path.join(out,'merged.wasm')]);
tool('wasm-tools',['print',path.join(out,'merged.wasm'),'-o',path.join(out,'merged.wat')]);
let wat=fs.readFileSync(path.join(out,'merged.wat'),'utf8');wat=wat.replace(/\(export "([^"]+)" \((func|memory|global|table) [^)]*\)\)/g,(all,n)=>names.has(n)?all:'');fs.writeFileSync(path.join(out,'artifact.wat'),wat);tool('wasm-tools',['parse',path.join(out,'artifact.wat'),'-o',path.join(out,'artifact.wasm')]);tool('wasm-tools',['validate',path.join(out,'artifact.wasm')]);
const artifact=fs.readFileSync(path.join(out,'artifact.wasm')),mod=new WebAssembly.Module(artifact);
assert.deepEqual(WebAssembly.Module.exports(mod).map(x=>x.name).sort(),[...names].sort());
assert(WebAssembly.Module.imports(mod).every(x=>x.module==='wasmc:lib/wasmc.lib_managed_object_heap@4.9.0'&&x.kind==='function'));
const receipt={schema:'wasmc.std-memory-core-candidate/v1',baseline_sha256:sha(old),changed_rust_raw_sha256:sha(fresh),artifact_sha256:sha(artifact),artifact_bytes:artifact.length,unchanged_baseline_exports:names.size-newNames.size-1,replaced_rust_exports:[...newNames].sort(),exports:names.size,core_root_packaged:false,current_catalog_admission:false};fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
