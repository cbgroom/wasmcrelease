import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCanonicalHostCompiler} from './compiler/canonical-host.mjs';
const root=new URL('./',import.meta.url),enc=new TextEncoder(),dec=new TextDecoder();
const read=p=>new Uint8Array(readFileSync(new URL(p,root)));
const json=p=>JSON.parse(dec.decode(read(p)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=json('manifest.json');
const list=(dir='')=>readdirSync(new URL(dir||'.',root),{withFileTypes:true}).flatMap(x=>x.isDirectory()?list(dir+x.name+'/'):[dir+x.name]).sort();
assert.deepEqual(list(),[...manifest.files.map(r=>r.path),'manifest.json','SHA256SUMS'].sort());
for(const row of manifest.files){const bytes=read(row.path);assert.equal(bytes.length,row.bytes,row.path);assert.equal(hash(bytes),row.sha256,row.path);const stat=lstatSync(new URL(row.path,root));assert(stat.isFile()&&!stat.isSymbolicLink());if(process.platform!=='win32')assert.equal((stat.mode&0o777).toString(8).padStart(4,'0'),row.mode,row.path);}
for(const line of dec.decode(read('SHA256SUMS')).trim().split('\n')){const [expected,path]=line.split('  ');assert.equal(hash(read(path)),expected,path);}
const release=json('release.json'),profile=json('checked-chunk-profile.json');
assert.equal(release.version,'0.0.7');assert.equal(release.compatible_release,'v0.0.27');assert.equal(profile.version,'0.0.27');assert.equal(Object.keys(profile.assets).length,15);assert.equal(profile.input_slots,14);assert.equal(profile.module_count,8);
for(const row of [profile.compiler,...Object.values(profile.assets),release.SDK])assert.equal(hash(read(row.path)),row.sha256,row.path);
assert.equal(hash(read('root/lib.json')),release.root_manifest.sha256);assert.equal(json('root/lib.json').version,'0.0.7');
const tuple=name=>Object.fromEntries([['wit','lib.wit'],['executionAbi','execution-abi.json'],['providerContract','provider-contract.json'],['binding','binding.json']].map(([k,p])=>[k,read('host/'+name+'/'+p)]));
const source=dec.decode(read('app/source.wasmc'));const activation=json('app/activation.json');assert.equal(hash(enc.encode(source)),activation.source_sha256);
const input={source,activation:enc.encode(JSON.stringify(activation)),entry:tuple('entry'),operations:tuple('operations'),libCore:read('root/artifact.wasm'),libWit:read('root/lib.wit'),template:read('cold/canonical-template.json')};
const compiler=await createCanonicalHostCompiler(read('compiler/wasmc_compiler.wasm'));
let compiled=0;
try{
 const result=await compiler.compile(input);assert.equal(result.modules.size,8);assert.equal(hash(result.frame),hash(read('app/frame')));
 for(const [name,bytes] of result.modules)assert.equal(hash(bytes),hash(read('app/'+name)),name);compiled++;
 const bad=source+'\ninvalid source';const badActivation={...activation,source_sha256:hash(enc.encode(bad))};await assert.rejects(compiler.compile({...input,source:bad,activation:enc.encode(JSON.stringify(badActivation))}));
 const recovered=await compiler.compile(input);assert.equal(hash(recovered.frame),hash(result.frame));compiled++;
 const next=source+'\n';const nextActivation={...activation,source_sha256:hash(enc.encode(next))};const rebound=await compiler.compile({...input,source:next,activation:enc.encode(JSON.stringify(nextActivation))});assert.equal(rebound.descriptor.source_sha256,nextActivation.source_sha256);assert.notEqual(hash(rebound.frame),hash(result.frame));compiled++;
}finally{compiler.dispose();}
if(process.argv.includes('--compiler-only')){
 let supported=true,error=null;try{new WebAssembly.Module(read('app/app.wasm'));}catch(e){supported=false;error=e.message;}
 console.log(JSON.stringify({accepted:true,qualification:'integrity-and-compiler-only',runtime:globalThis.Bun?'bun':globalThis.Deno?'deno':'node',runtime_versions:process.versions,files:manifest.files.length+2,compiled_frames:compiled,compile_rejection_recovery:true,source_rebinding:true,merged_App_supported:supported,merged_App_error:error,Guest_execution:false,guest_cases:0,Root_manifest_sha256:release.root_manifest.sha256,compiler_sha256:release.compiler.sha256,SDK_sha256:release.SDK.sha256,CoreLib_sha256:release.CoreLib.sha256}));process.exit(0);
}
const module=new WebAssembly.Module(read('app/app.wasm')),imports=WebAssembly.Module.imports(module);
assert.equal(imports.length,13);assert(imports.every(x=>x.module==='mcpgit:http/v1'&&x.kind==='function'));
const expectedImports=json('app/descriptor.json').expected_final_host_imports.map(x=>x.module+'.'+x.function).sort();assert.deepEqual(imports.map(x=>x.module+'.'+x.name).sort(),expectedImports);
let instance,body=new Uint8Array(),path='/',calls=0;const responses=[],http={};
for(const field of ['method','path','parameters','query','headers','body']){
 const data=()=>field==='body'?body:['parameters','query','headers'].includes(field)?new Uint8Array(8):enc.encode(field==='method'?'POST':path);
 http['request-'+field+'-len']=()=>{calls++;return data().length;};
 http['request-'+field+'-read']=(offset,p,n)=>{calls++;const bytes=data();assert.equal(offset,0);assert.equal(n,bytes.length);new Uint8Array(instance.exports.memory.buffer,p,n).set(bytes);return n;};
}
http['response-canonical-write']=(status,p,n)=>{calls++;responses.push({status,body:dec.decode(new Uint8Array(instance.exports.memory.buffer,p,n))});return 0;};
instance=new WebAssembly.Instance(module,{'mcpgit:http/v1':http});
const cases=[
 {name:'new-number',input:'{"value":73}',body:'{"echo":73}'},
 {name:'unicode-nul-quote',input:JSON.stringify({value:'new-雪🦀\0"\n'}),body:'{"echo":'+JSON.stringify('new-雪🦀\0"\n')+'}'},
 {name:'object',input:'{"value":{"z":2,"a":1}}',body:'{"echo":{"a":1,"z":2}}'},
 {name:'empty-text',input:'{"value":""}',body:'{"echo":""}'},
 {name:'null',input:'{"value":null}',body:'{"echo":null}'},
 {name:'array',input:'{"value":[1,"雪",null]}',body:'{"echo":[1,"雪",null]}'},
 {name:'u64-exact-JSON',input:'{"value":18446744073709551615}',body:'{"echo":18446744073709551615}'},
 {name:'explicit-fallback',input:'{"value":73}',path:'/small',body:'{"error":"assembly_failed"}'},
 {name:'fresh-after-fallback',input:'{"value":91}',body:'{"echo":91}'},
 {name:'invalid-JSON',input:'{',status:400,body:'{"error":"invalid_input"}'},
 {name:'missing-value',input:'{}',status:400,body:'{"error":"missing_value"}'}
];
const rows=[];
for(const test of cases){body=enc.encode(test.input);path=test.path??'/';const before=calls;const responsesBefore=responses.length;assert.equal(instance.exports.handle(),0);assert.equal(calls-before,13);assert.equal(responses.length,responsesBefore+1);assert.deepEqual(responses.at(-1),{status:test.status??200,body:test.body});for(const n of ['__wasmc_app_input_pending','__wasmc_value_pending_allocations'])assert.equal(instance.exports[n](),0);rows.push({name:test.name,input_sha256:hash(body),response:responses.at(-1),Host_calls:13,pending_zero:2});}
console.log(JSON.stringify({accepted:true,runtime:globalThis.Deno?'deno':globalThis.Bun?'bun':'node',runtime_versions:process.versions,Root_manifest_sha256:release.root_manifest.sha256,compiler_sha256:release.compiler.sha256,SDK_sha256:release.SDK.sha256,CoreLib_sha256:release.CoreLib.sha256,files:manifest.files.length+2,compiled_frames:compiled,compile_rejection_recovery:true,source_rebinding:true,guest_cases:rows.length,same_instance:true,actual_Host_imports:13,Host_calls_per_request:13,pending_zero:2,Guest_uses_new_external_inputs:true,live_platform_effects:false,rows}));
