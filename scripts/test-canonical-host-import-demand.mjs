import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCanonicalHostCompiler} from '../current/canonical-host.mjs';
const read=p=>new Uint8Array(readFileSync(new URL('../'+p,import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const f='examples/canonical-host/',encode=new TextEncoder();
const tuple=n=>Object.fromEntries([['wit','lib.wit'],['executionAbi','execution-abi.json'],['providerContract','provider-contract.json'],['binding','binding.json']].map(([k,p])=>[k,read(f+'host/'+n+'/'+p)]));
const proof=JSON.parse(new TextDecoder().decode(read(f+'import-demand-proof.json')));
const active=JSON.parse(new TextDecoder().decode(read('current/compiler-release.json')));
assert.equal(sha(read('current/wasmc_compiler.wasm')),active.compiler.sha256);
const compiler=await createCanonicalHostCompiler(read('current/wasmc_compiler.wasm'));
let cases=0;
try {
 for(const row of proof.cases) {
  const path=row.name==='table_control'?'ordinary':row.name==='json_read'?'json-read':'static';
  const source=new TextDecoder().decode(read(f+'app/'+path+'.wasmc'));
  assert.equal(sha(encode.encode(source)),row.source_sha256);
  const activation=JSON.parse(new TextDecoder().decode(read(f+'app/activation.json')));
  activation.source_sha256=row.source_sha256;
  const result=await compiler.compile({source,activation:encode.encode(JSON.stringify(activation)),entry:tuple('entry'),operations:tuple('operations'),libCore:read('standard/wasmc-json/0.0.6/artifact.wasm'),libWit:read('standard/wasmc-json/0.0.6/lib.wit'),template:read(f+'producer-assets/canonical-template.json')});
  assert.equal(sha(result.frame),row.frame_sha256);assert.equal(result.modules.size,8);
  const imports=[];
  for(const bytes of result.modules.values())imports.push(...WebAssembly.Module.imports(new WebAssembly.Module(bytes)).filter(i=>i.module.startsWith('mcpgit:')));
  assert.deepEqual(imports.map(i=>i.module+'.'+i.name).sort(),row.after_imports.map(i=>i.module+'.'+i.name).sort());
  assert.deepEqual(result.descriptor.expected_final_host_imports.map(i=>i.module+'.'+i.function).sort(),imports.map(i=>i.module+'.'+i.name).sort());
  const optionalCalls=WebAssembly.Module.imports(new WebAssembly.Module(result.modules.get('caller.wasm'))).filter(i=>i.module==='wasmc-native-host-calls');
  if(row.name==='table_control') {assert.equal(imports.length,18);assert.equal(optionalCalls.length,1);assert.equal(result.descriptor.native_host_projection.length,1);}
  else {assert.equal(imports.length,13);assert.equal(optionalCalls.length,0);assert.equal(result.descriptor.native_host_projection.length,0);for(const p of ['host-calls.wasm','host-projection.wasm'])assert.deepEqual([...result.modules.get(p)],[0,97,115,109,1,0,0,0]);}
  cases++;
 }
} finally {compiler.dispose();}
assert.equal(cases,3);
console.log(JSON.stringify({accepted:true,runtime:globalThis.Deno?'deno':globalThis.Bun?'bun':'node',compiler_sha256:active.compiler.sha256,baseline_producer_compiler_sha256:proof.compiler_sha256,cases,static_imports:13,json_read_imports:13,table_imports:18,modules_per_frame:8,exact_frame_pins:true,real_Host_invocation:false,actual_merged_execution_evidence:f+'import-demand-proof.json'}));
