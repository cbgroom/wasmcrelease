import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base='/Users/youxianshi/.local/state/wasmc-maintenance/20261026-lib-memory-json-32/wit-http-capability-scan-20261027/paired/';
const paths={rust:'/tmp/mcpgit-sdk213-parity-guest-v3.wasm',wasmc:base+'binary-header.wasm'};
let all={host:'simulated',engine:globalThis.Deno?'deno':'node',results:{}};
for(const [lang,path] of Object.entries(paths)){
 const bytes=readFileSync(path),mod=new WebAssembly.Module(bytes);let mem,fail=false,status=0,body=[],headers=[],control=0;
 const read=(p,n)=>new Uint8Array(mem.buffer,p,n).slice(), txt=(p,n)=>new TextDecoder().decode(read(p,n));
 const host={
 'exchange-request-method-write':()=>0,'exchange-request-path-write':()=>0,'exchange-phase':()=>1,'exchange-failed':()=>0,
 'exchange-request-header-set':()=>0,'exchange-request-header-append':()=>0,'exchange-request-header-remove':()=>0,
 'exchange-request-parameter-set':()=>0,'exchange-request-parameter-remove':()=>0,'exchange-request-query-append':()=>0,'exchange-request-query-remove':()=>0,
 'exchange-resource-select':()=>0,'exchange-request-body-write':()=>0,
 'exchange-response-header-append':(p,n,q,m)=>{if(fail)return -1;headers.push([txt(p,n),[...read(q,m)]]);return 0},
 'exchange-response-header-remove':()=>0,'exchange-response-headers-len':()=>3,'exchange-response-headers-read':(o,p,n)=>{let b=new TextEncoder().encode('hdr').slice(o,o+n);new Uint8Array(mem.buffer,p,b.length).set(b);return b.length},
 'exchange-response-status':n=>(status=n,0),'exchange-response-status-get':()=>status,'exchange-response-body-write':(p,n)=>(body=[...read(p,n)],0),
 'exchange-response-body-len':()=>body.length,'exchange-response-body-read':(o,p,n)=>{let b=body.slice(o,o+n);new Uint8Array(mem.buffer,p,b.length).set(b);return b.length},'exchange-control':n=>(control=n,0)};
 let imports={};for(const i of WebAssembly.Module.imports(mod)){imports[i.module]??={};assert.ok(host[i.name],i.name);imports[i.module][i.name]=host[i.name]}
 let inst=new WebAssembly.Instance(mod,imports);mem=inst.exports.memory;let cases=[];
 for(const failure of [false,true,false]){fail=failure;status=0;body=[];headers=[];control=0;let ret=inst.exports.handle();assert.equal(ret,failure?500:200);if(!failure){assert.equal(status,206);assert.deepEqual(body,[0,255,128]);assert.deepEqual(headers,[['x-reply',[98]]]);assert.equal(control,1)}for(const k of ['__wasmc_host_window_pending','__wasmc_app_input_pending','__wasmc_value_pending_allocations'])if(inst.exports[k])assert.equal(inst.exports[k](),0);cases.push({failure,ret,status,body,headers,control});}
 all.results[lang]={sha256:createHash('sha256').update(bytes).digest('hex'),imports:WebAssembly.Module.imports(mod),same_instance:true,cases};
}
writeFileSync(base+'pair-'+all.engine+'.json',JSON.stringify(all,null,2)+'\n');console.log(JSON.stringify(all));
