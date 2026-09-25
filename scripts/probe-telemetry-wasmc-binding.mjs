// Diagnose the published compiler route, without modifying compiler bytes.
// A successful scalar control is NOT a successful telemetry consumer.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const load=p=>readFileSync(fileURLToPath(new URL('../'+p,import.meta.url)));
const digest=b=>createHash('sha256').update(b).digest();
const compiler=load('runtime/wasmc-runtime-v0/compiler.wasm');
const module=new WebAssembly.Module(compiler);
assert.deepEqual(WebAssembly.Module.imports(module),[]);
const api=new WebAssembly.Instance(module,{}).exports;
const encode=s=>Buffer.from(s,'utf8');
const execution=encode('{"purpose":"pure local qualification probe"}\n');
const provider=encode('{"host_authorities":[]}\n');
function compile(wit,source,resultAdapter,params=['i32']) {
  const w=encode(wit);
  const binding=encode(JSON.stringify({
    schema:'wasmc.wit-fastabi-execution-binding.v2',
    wit_sha256:digest(w).toString('hex'),
    execution_abi_sha256:digest(execution).toString('hex'),
    provider_contract_sha256:digest(provider).toString('hex'),
    world:'app',resources:[],
    guest_memory:{export:'memory',maximum_static_utf8_bytes:256},
    operations:[{id:1,wit_operation:'api.probe',receiver:'none',argument_adapters:['identity'],
      result_adapter:resultAdapter,
      core:{module:'qualification:pure-lib/v1',function:'probe',params,results:['i32'],host_authorities:[]}}],
  }));
  const artifacts=[w,execution,provider,binding];
  const all=[...artifacts,Buffer.concat(artifacts.map(digest))];
  api.wasmc_clear();
  try {
    all.forEach((b,i)=>{
      const p=api.wasmc_wit_fastabi_artifact_alloc(i,b.length);
      assert.notEqual(p,0);new Uint8Array(api.memory.buffer,p,b.length).set(b);
    });
    const input=encode(source),p=api.wasmc_alloc(input.length);
    new Uint8Array(api.memory.buffer,p,input.length).set(input);
    const status=api.wasmc_compile_wit_fastabi(p,input.length);
    const text=()=>Buffer.from(new Uint8Array(api.memory.buffer,api.wasmc_error_ptr(),api.wasmc_error_len())).toString('utf8');
    if(status!==0)return {status,error:text()};
    return {status,wasm:Buffer.from(new Uint8Array(api.memory.buffer,api.wasmc_output_ptr(),api.wasmc_output_len()))};
  } finally {api.wasmc_clear();}
}
const scalarWit='package qualification:scalar@0.0.1; interface api { enum failure { rejected } probe: func(value: u32) -> result<u32,failure>; } world app { import api; }';
const scalarSource='package local:caller; interface facade { enum failure { rejected } run: func(value:u32)->result<u32,failure> { return api::probe(value); } } world app { export facade; }';
const scalar=compile(scalarWit,scalarSource,'checked-u32-i32-status');
assert.equal(scalar.status,0,scalar.error);
const caller=new WebAssembly.Instance(new WebAssembly.Module(scalar.wasm),{'qualification:pure-lib/v1':{probe:v=>v}});
for(const value of [0,1,15,1000])assert.deepEqual(caller.exports.run(value),[value,0]);
const recordWit='package qualification:record-probe@0.0.1; interface api { enum failure { rejected } record frame { sequence:u64, cpu:option<u32>, freshness:u32 } probe: func(value:u32)->result<frame,failure>; } world app { import api; }';
const recordSource='package local:caller; interface facade { enum failure { rejected } record frame { sequence:u64, cpu:option<u32>, freshness:u32 } run: func(value:u32)->result<frame,failure> { return api::probe(value); } } world app { export facade; }';
const value=compile(recordWit,recordSource,'canonical-abi-v0');
assert.notEqual(value.status,0,'route has changed: review and replace this negative characterization');
assert.match(value.error,/binding result adapter is unsupported/);
console.log(JSON.stringify({
  schema:'wasmc.telemetry-binding-route-probe/v1',
  compiler_sha256:digest(compiler).toString('hex'),scalar_control:{compiled:true,executed:4},
  record_result_route:{adapter:'canonical-abi-v0',status:value.status,error:value.error},
  scope:'published WIT FastABI route only; does not rule out a producer-owned mixed adapter',
  full_wasmc_consumer_qualified:false,prod_release_qualified:false,
}));
