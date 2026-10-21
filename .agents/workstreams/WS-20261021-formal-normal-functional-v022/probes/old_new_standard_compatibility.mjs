import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [rootArg,outArg]=process.argv.slice(2),root=resolve(rootArg),out=resolve(outArg);
const read=p=>readFileSync(join(root,p)),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(read('current/wasmc_compiler.wasm')),'620a6b5f7b9a4565f14857975e37a03196f8f7e4279a2f4da388882638f2a658');
const {compileLib}=await import(pathToFileURL(join(root,'current/index.mjs')));
const provider=read('standard/corelib/4.9.0/corelib.wasm'),lib=read('standard/wasmc-std/1.4.1/artifact.wasm'),plan=read('standard/wasmc-std/1.4.1/typed-resource-plan.json');
assert.equal(sha(provider),'c3ac42b93f4c27e24065abe804b91f54761eff782e2971e947847b3d20ee7e00');
assert.equal(sha(lib),'b79a499c8300361125e7fcdae02170184b82d4bbeff4d8f24ed95f3fd4db8d3b');
assert.equal(sha(plan),'8be27de32e1e8dadcb997f2b886d0349531eb9448c1b7dd73a74a3d9e34f87b3');
const source=read('examples/current/standard.wasmc');assert.equal(sha(source),'9bf53362e8740426bdbe13a7e48d21c3e4143a7baefc170225136f72e5f18707');
const compiled=(await compileLib(source.toString('utf8'),{plan,libWasmBytes:lib})).appWasm;
const old=read('examples/current/standard-wasmc.wasm'),rust=read('examples/current/standard-rust.wasm');
assert.equal(sha(old),'21b6d7809c3325705e3d442aae909b7d337014189dbf355a0d72e54ad22f9dbd');
assert.equal(sha(rust),'24f573bf676327816d700778d80c26cc14406123406cf194a15d59ae22cdaa71');
assert.equal(sha(compiled),'f704d2c4d99f9efc97ef6d3c99bfd29c3987e1a96601ec7ff026dd0ac6e0581a');
const outputs=[];let calls=0;
for(const [name,bytes] of [['old',old],['new',compiled],['rust',rust]]){
 const p=new WebAssembly.Instance(new WebAssembly.Module(provider),{});assert.equal(p.exports.provider_domain_init(127,7),0);
 const l=new WebAssembly.Instance(new WebAssembly.Module(lib),{'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0':p.exports});assert.equal(l.exports.std_init(),0);
 const a=new WebAssembly.Instance(new WebAssembly.Module(bytes),{'wasmc:lib/wasmc.std@1.4.1':l.exports}),rows=[];
 for(let round=0;round<128;round++)for(const index of [0,1,2,99,4294967295])for(const item of [0,1,128,255]){
  const result=a.exports.run(index,item),value=Array.isArray(result)?result[0]:result;
  assert.equal(value,[-7,0,2147483647][index]??9);if(Array.isArray(result))assert.equal(result[1],0);rows.push(value);calls++;
 }
 outputs.push(rows);
}
assert.deepEqual(outputs[0],outputs[1]);assert.deepEqual(outputs[1],outputs[2]);
mkdirSync(out,{recursive:true});writeFileSync(join(out,'standard-new.wasm'),compiled,{flag:'wx'});
const report={accepted:true,host:globalThis.Bun?'Bun':globalThis.Deno?'Deno':'Node',compiler_sha256:'620a6b5f7b9a4565f14857975e37a03196f8f7e4279a2f4da388882638f2a658',old_app_sha256:sha(old),new_app_sha256:sha(compiled),old_app_bytes:old.length,new_app_bytes:compiled.length,unchanged_source_sha256:sha(source),Std:'1.4.1',Provider:'4.9.0',old_new_Rust_oracles_equal:true,actual_calls:calls,old_fixtures_unchanged:true,formal_release:false};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
