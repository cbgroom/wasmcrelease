// Current compiler boundary characterization, not a passing Host v1 SDK gate.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compile} from '../../current/wasmc.mjs';
import {compileLib} from '../../current/index.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const compiler=await readFile('current/wasmc_compiler.wasm');
assert.equal(sha(compiler),'93d946c544975a6e7642ff1f5890e09d3bfb9924d0256ffcfebcf07485597c90');
const planBytes=await readFile('standard/wasmc-std/1.4.0/typed-resource-plan.json');
const plan=JSON.parse(planBytes);
const options={compilerWasmBytes:compiler,libWasmBytes:await readFile('standard/wasmc-std/1.4.0/artifact.wasm')};
const synchronous=await compileLib(await readFile('examples/current/standard.wasmc','utf8'),plan,options);
assert.equal(synchronous.appWasm.length,2580);
assert(WebAssembly.Module.imports(new WebAssembly.Module(synchronous.appWasm)).length>0);
const scalar=await compile(await readFile('host/scenarios/file-async-app.wasmc','utf8'));
assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(scalar)),[]);
const cases=[
  {name:'owned-local-before-await',source:`package local:owned_local_task;
interface io {read: async func(value: own<byte_buffer>)->s32;}
interface app {run: async func(limit:s32)->s32 {
  let buffer: own<byte_buffer> = bytes::new();
  let length:s32 = read(buffer).await;
  return length;
}}
world app {import io;export app;}`},
  {name:'owned-await-result',source:`package local:owned_result_task;
interface io {read: async func(limit:s32)->own<byte_buffer>;}
interface app {run: async func(limit:s32)->s32 {
  let buffer: own<byte_buffer> = read(limit).await;
  return 0;
}}
world app {import io;export app;}`},
];
const boundaries=[];
for(const test of cases){
  let diagnostic;
  try{await compileLib(test.source,plan,options);}catch(error){diagnostic=error.message;}
  assert.equal(typeof diagnostic,'string',`${test.name}: behavior changed; review closure, do not silently preserve the old boundary`);
  assert.match(diagnostic,/typed-resource ordinary AST: async function .* must bind each sequential `.await` result to an s32 local/);
  boundaries.push({name:test.name,source_sha256:sha(test.source),diagnostic});
}
console.log(JSON.stringify({characterization_pass:true,accepted:false,
  scope:'admitted-compiler-owned-async-source-boundary',positive_compile_controls:2,
  synchronous_owned_compile:true,scalar_async_compile:true,typed_owned_async_supported:false,
  uniform_core_abi_accepted:false,compiler_sha256:sha(compiler),plan_sha256:sha(planBytes),boundaries}));
