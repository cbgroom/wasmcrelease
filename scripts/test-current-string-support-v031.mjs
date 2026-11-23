import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createCanonicalHostCompiler} from '../current/canonical-host.mjs';
const root=new URL('../',import.meta.url),fixture='examples/current/string-support-v2/',read=p=>fs.readFileSync(new URL(p,root)),sha=b=>createHash('sha256').update(b).digest('hex');const profile=JSON.parse(read(fixture+'profile.json'));
assert.equal(profile.schema,'wasmc.current-string-profile/v2');assert.equal(profile.version,'0.0.31');assert.equal(profile.CoreLib_version,'4.12.0-candidate.1');
for(const p of [profile.compiler,profile.facade,profile.CoreLib,profile.Root,profile.Root_core,profile.Root_wit,...profile.fixture_files]){const b=read(p.path);assert.equal(b.length,p.bytes,p.path);assert.equal(sha(b),p.sha256,p.path);}
const core=new WebAssembly.Module(read(profile.CoreLib.path));assert.equal(WebAssembly.Module.imports(core).length,0);assert.equal(WebAssembly.Module.exports(core).length,51);
const source=read(fixture+'source.wasmc').toString(),activation=JSON.parse(read(fixture+'activation.json')),descriptor=JSON.parse(read(fixture+'modules/descriptor.json'));
const tuple=n=>Object.fromEntries([['wit','lib.wit'],['executionAbi','execution-abi.json'],['providerContract','provider-contract.json'],['binding','binding.json']].map(([k,p])=>[k,read(fixture+'host/'+n+'/'+p)]));
const input=s=>({source:s,activation:Buffer.from(JSON.stringify({...activation,source_sha256:sha(Buffer.from(s))})),entry:tuple('entry'),operations:tuple('operations'),libCore:read(profile.Root_core.path),libWit:read(profile.Root_wit.path),template:read(fixture+'cold/canonical-template.json')});
let frames=0;const compiler=await createCanonicalHostCompiler(read(profile.compiler.path));
try{
 const check=async s=>{const r=await compiler.compile(input(s));assert.equal(r.modules.size,8);for(const row of descriptor.modules)assert.equal(sha(r.modules.get(row.path)),row.sha256,row.path);frames++;return r;};
 await check(source);await assert.rejects(compiler.compile(input(source+'\ninvalid source')));await check(source);const changed=await check(source+'\n');assert.equal(changed.descriptor.source_sha256,sha(Buffer.from(source+'\n')));assert.notEqual(sha(changed.frame),sha(read(fixture+'modules/frame')));await check(source);
}finally{compiler.dispose();}
let module;try{module=new WebAssembly.Module(read(fixture+'app.wasm'));}catch(error){assert(globalThis.Bun);assert(error instanceof WebAssembly.CompileError);assert.match(error.message,/Memory section has more than one memory/);console.log(JSON.stringify({accepted:true,host:'bun',CoreLib_version:profile.CoreLib_version,CoreLib_sha256:profile.CoreLib.sha256,compiler_sha256:profile.compiler.sha256,Root_APIs:30,compiled_frames:frames,modules_per_frame:8,candidate_profile:true,Guest_calls:0,execution_profile:'compiler-frames-only',unsupported_feature:'multi-memory',Source_rejection_recovery:true,business_effects:false}));process.exit(0);}
const imports=WebAssembly.Module.imports(module);assert.equal(imports.length,13);assert(imports.every(i=>i.module==='mcpgit:http/v1'&&i.kind==='function'));
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});let instance,body=new Uint8Array(),path='/',calls=0,responses=[],rejectWrite=false;const http={};
for(const field of ['method','path','parameters','query','headers','body']){
 const data=()=>field==='body'?body:['parameters','query','headers'].includes(field)?new Uint8Array(8):enc.encode(field==='method'?'POST':path);
 http['request-'+field+'-len']=()=>{calls++;return data().length;};
 http['request-'+field+'-read']=(offset,p,n)=>{calls++;assert.equal(offset,0);assert.equal(n,data().length);new Uint8Array(instance.exports.memory.buffer,p,n).set(data());return n;};
}
http['response-canonical-write']=(status,p,n)=>{calls++;if(rejectWrite)return 1;responses.push({status,body:dec.decode(new Uint8Array(instance.exports.memory.buffer,p,n))});return 0;};
instance=new WebAssembly.Instance(module,{'mcpgit:http/v1':http});const pending=()=>{for(const name of ['__wasmc_app_input_pending','__wasmc_value_pending_allocations'])assert.equal(instance.exports[name](),0,name);};let guestCalls=0;
const run=test=>{body=test.bytes?Uint8Array.from(test.bytes):enc.encode(test.input);path=test.path;const before=calls,count=responses.length;assert.equal(instance.exports.handle(),0,path);assert.equal(calls-before,13);assert.equal(responses.length,count+1);assert.deepEqual(responses.at(-1),{status:200,body:test.expected},path);pending();guestCalls++;};
const cases=JSON.parse(read(fixture+'cases.json'));assert.equal(cases.length,34);for(let round=0;round<16;round++)for(const c of cases)run(c);const basic=guestCalls;
const large=[];for(const n of [131072,262144,524288,1048576,1200000,1500000]){run({path:'/to_uppercase',input:'a'.repeat(n-7)+'雪🦀',expected:'A'.repeat(n-7)+'雪🦀'});large.push(n);}
run({path:'/to_lowercase',input:'İ'.repeat(76800),expected:'i\u0307'.repeat(76800)});
// The fixture Host contract explicitly bounds body bytes to 1,500,000.
body=enc.encode('a'.repeat(1500001));path='/to_uppercase';let count=responses.length;assert.equal(instance.exports.handle(),1);assert.equal(responses.length,count);pending();
for(let i=0;i<32;i++){const fresh='never-compiled-'+i+'-雪\0🦀';run({path:'/echo',input:fresh,expected:fresh});}
body=enc.encode('normal-after-response-failure');path='/echo';count=responses.length;rejectWrite=true;assert.equal(instance.exports.handle(),1);assert.equal(responses.length,count);pending();rejectWrite=false;run({path:'/echo',input:'fresh-after-failure-雪',expected:'fresh-after-failure-雪'});
console.log(JSON.stringify({accepted:true,host:globalThis.Deno?'deno':'node',CoreLib_version:profile.CoreLib_version,CoreLib_sha256:profile.CoreLib.sha256,compiler_sha256:profile.compiler.sha256,Root_APIs:30,compiled_frames:frames,modules_per_frame:8,candidate_profile:true,basic_Guest_calls:basic,Guest_calls:guestCalls,large_input_bytes:large,Unicode_case_expansion:true,explicit_host_limit_rejected:true,same_instance_recovery:true,pending_counters_zero:2,Host_imports:13,Host_calls_per_success:13,Source_rejection_recovery:true,business_effects:false}));
