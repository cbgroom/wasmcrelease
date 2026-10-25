import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createCanonicalHostCompiler} from '../current/canonical-host.mjs';
const root=new URL('../',import.meta.url),fixture='examples/current/canonical-checked-results-v1/',kit='lib-releases/wasmc-json/0.0.7/';
const read=p=>fs.readFileSync(new URL(p,root)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const proof=JSON.parse(read(fixture+'expected.json'));assert.equal(proof.version,'0.0.29');
const check=row=>{const b=read(row.path);assert.equal(b.length,row.bytes,row.path);assert.equal(hash(b),row.sha256,row.path);return b;};
for(const row of [...proof.files,proof.Root,...Object.values(proof.Host_contracts).flatMap(Object.values),...proof.composition.inputs])check(row);
const bytes=read('current/wasmc_compiler.wasm');assert.equal(hash(bytes),proof.compiler_sha256);
const tuple=n=>Object.fromEntries([['wit','lib.wit'],['executionAbi','execution-abi.json'],['providerContract','provider-contract.json'],['binding','binding.json']].map(([key,p])=>[key,read(kit+'host/'+n+'/'+p)]));
const source=read(fixture+'ordinary.wasmc').toString(),activation=JSON.parse(read(fixture+'activation.json'));
const input=source=>({...{source,entry:tuple('entry'),operations:tuple('operations'),libCore:read(kit+'root/artifact.wasm'),libWit:read(kit+'root/lib.wit'),template:read(kit+'cold/canonical-template.json')},activation:Buffer.from(JSON.stringify({...activation,source_sha256:hash(Buffer.from(source))}))});
const compiler=await createCanonicalHostCompiler(bytes);let frames=0;
const checkFrame=r=>{assert.equal(hash(r.frame),proof.frame_sha256);assert.equal(r.modules.size,8);for(const row of proof.modules)assert.equal(hash(r.modules.get(row.path)),row.sha256,row.path);frames++;};
try{checkFrame(await compiler.compile(input(source)));await assert.rejects(compiler.compile(input(source.replace('body:body','body:req.body'))),/cannot move a projected owner/);checkFrame(await compiler.compile(input(source)));const changed=source+'\n';const r=await compiler.compile(input(changed));assert.equal(r.descriptor.source_sha256,hash(Buffer.from(changed)));assert.notEqual(hash(r.frame),proof.frame_sha256);for(const row of proof.modules)assert.equal(hash(r.modules.get(row.path)),row.sha256);frames++;}finally{compiler.dispose();}
const app=check(proof.complete_App);let module;
try{module=new WebAssembly.Module(app);}catch(error){
 assert(globalThis.Bun,'Node/Deno must admit this executed multi-memory profile');assert(error instanceof WebAssembly.CompileError);assert.match(error.message,/Memory section has more than one memory/);
 console.log(JSON.stringify({accepted:true,runtime:'bun',compiler_sha256:hash(bytes),compiled_frames:frames,modules_per_frame:8,guest_calls:0,app_engine_admitted:false,execution_profile:'compiler-frames-only',unsupported_feature:'multi-memory',rejection_then_recovery:true,real_Host_effects:false,business_Guest_executed:false}));process.exit(0);
}
const imports={};let instance;
const state={mode:0,case:0,handle:0,body:Buffer.alloc(0),path:Buffer.alloc(0),replyLive:false,errorLive:false,invokes:0,lengths:0,retires:0,drops:0,responses:[]};
const memory=()=>instance.exports.memory;
const get=(p,n)=>Buffer.from(new Uint8Array(memory().buffer,p>>>0,n>>>0));
const put=(p,b)=>new Uint8Array(memory().buffer,p>>>0,b.length).set(b);
for(const row of WebAssembly.Module.imports(module)){
 assert.equal(row.kind,'function');imports[row.module]??={};if(Object.hasOwn(imports[row.module],row.name))continue;
 imports[row.module][row.name]=(...p)=>{
  const name=row.name,u=i=>p[i]>>>0;let status=0;
  const field=name.startsWith('request-')?name.replace(/^request-/,'').replace(/-(len|read)$/,''):null;
  if(field){const b=field==='method'?Buffer.from('POST'):field==='path'?state.path:field==='body'?state.body:['parameters','query','headers'].includes(field)?Buffer.alloc(8):assert.fail('unknown field');
   if(name.endsWith('-len'))return b.length;assert.equal(u(0),0);assert.equal(u(2),b.length);put(u(1),b);return b.length;}
  if(name==='response-canonical-write'){state.responses.push([p[0],get(u(1),u(2))]);return 0;}
  if(name==='wit-service-invoke'){assert.deepEqual(get(u(0),u(1)),state.path);assert.deepEqual(get(u(2),u(3)),state.body);state.invokes++;assert(!state.replyLive&&!state.errorLive);
   if(state.mode===1||(state.mode>=6&&state.mode<=15)){state.errorLive=true;return[state.mode===13?1:0,31];}state.replyLive=true;return[state.handle,0];}
  if(name==='wit-table-response-len'){assert.equal(p[0],state.handle);state.lengths++;if(!state.replyLive&&state.mode===20)return[0,0];if(!state.replyLive||state.mode===2){state.errorLive=true;return[0,31];}return[-1,0];}
  if(name==='wit-table-response-drop'){assert.equal(p[0],state.handle);assert(state.replyLive);state.replyLive=false;state.retires++;if(state.mode===3){state.errorLive=true;return[0,31];}return[state.mode===4?1:0,0];}
  assert.equal(u(0),31);assert(state.errorLive);
  if(name==='error-case')return state.mode>=16&&state.mode<=19?state.mode-15:state.mode===6?5:state.mode===14?-1:state.mode===0?0:state.case;
  if(name==='error-message-len')return state.mode===7?65537:state.mode===15?-1:state.mode===10?1:state.mode===11?0:state.mode===12?65536:Buffer.byteLength('拒绝🦀');
  if(name==='error-message-read'){const b=state.mode===10?Buffer.from([255]):state.mode===11?Buffer.alloc(0):state.mode===12?Buffer.alloc(65536,120):Buffer.from('拒绝🦀');assert.equal(u(2),b.length);put(u(1),b);return state.mode===8?1:0;}
  if(name==='error-drop'){state.errorLive=false;state.drops++;return state.mode===9?1:0;}
  assert.fail('unexpected import '+name);
 };
}
instance=new WebAssembly.Instance(module,imports);const pending=['__wasmc_app_input_pending','__wasmc_host_window_pending','__wasmc_value_pending_allocations'];for(const key of pending)assert.equal(typeof instance.exports[key],'function');
let calls=0,rejections=0;const modes=[0,1,2,3,4,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
for(let round=0;round<4;round++)for(const selected of modes)for(let which=0;which<5;which++)for(const mode of[selected,0]){
 Object.assign(state,{mode,case:which,handle:[0,1,-2147483647,-1][round],body:Buffer.from(JSON.stringify({round,value:'雪🦀'})),path:Buffer.from(`route.雪\0${round}.${mode}.${which}`)});const before=state.invokes;let result,error;
 try{result=instance.exports.handle();}catch(e){error=e;assert(e instanceof WebAssembly.RuntimeError);}
 assert.equal(state.invokes,before+1);assert(!state.replyLive&&!state.errorLive);for(const key of pending)assert.equal(instance.exports[key](),0,key);
 if([4,6,7,8,9,10,13,14,15].includes(mode)){assert(error||result!==0);rejections++;}else{assert.equal(error,undefined);assert.equal(result,0);const expected=mode>=16&&mode<=20?597:mode===0?201:mode===1||mode>=6?503:502;assert.deepEqual(state.responses.at(-1),[expected,state.body]);}calls++;
}
assert.equal(calls,800);assert.equal(rejections,180);
console.log(JSON.stringify({accepted:true,runtime:globalThis.Deno?'deno':globalThis.Bun?'bun':'node',compiler_sha256:hash(bytes),compiled_frames:frames,modules_per_frame:8,app_engine_admitted:true,execution_profile:'canonical-app-multi-memory',guest_calls:calls,same_instance:true,service_calls:state.invokes,response_drops:state.retires,owned_error_drops:state.drops,malformed_rejections:rejections,pending_counters_zero:3,fresh_dynamic_inputs:true,exact_error_case_decisions:5,rejection_then_recovery:true,real_Host_effects:false,business_Guest_executed:false}));
