import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const [file,out]=process.argv.slice(2),bytes=fs.readFileSync(file);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(sha,'8231aba425ef1bb0aa07a760ff4c77917e247382ef73a41408db6b6b1cb40b1e');
const module=new WebAssembly.Module(bytes);assert.deepEqual(WebAssembly.Module.imports(module),[]);
const e=new WebAssembly.Instance(module,{}).exports;
const checks=[];
const check=(name,fn)=>{fn();checks.push(name);};
const handle=v=>{assert.equal(typeof v,'bigint');assert(v<0n,'unexpected Core status '+v);return v;};
const zero=v=>assert.equal(v,0);
function record(fields){const r=handle(e.type_record_begin(fields,fields*8,8));for(let n=0;n<fields;n++)zero(e.type_record_field(r,n,11,n*8,8));return handle(e.type_record_finish(r));}
zero(e.provider_domain_init(81,947));
let scalar;
check('512 fields and4096 record bytes cross former32fields128bytes',()=>{
 const ty=record(512),o=handle(e.object_new(ty));zero(e.object_set_scalar(o,ty,511,-1n));zero(e.object_get_scalar_status(o,ty,511));assert.equal(e.object_get_scalar_bits(o,ty,511),-1n);zero(e.object_drop(o,ty));
});
check('300 distinct descriptors cross former32types',()=>{for(let n=1;n<=300;n++){const ty=record(n);if(n===1)scalar=ty;}handle(scalar);});
check('4096 live owners preserve values and stale ownership',()=>{
 const owners=Array.from({length:4096},(_,n)=>{const o=handle(e.object_new(scalar));zero(e.object_set_scalar(o,scalar,0,BigInt(n+19)));return o;});
 for(let n=0;n<owners.length;n++)assert.equal(e.object_get_scalar_bits(owners[n],scalar,0),BigInt(n+19));
 for(const o of owners)zero(e.object_drop(o,scalar));assert.notEqual(e.object_get_scalar_status(owners[0],scalar,0),0);
});
const string=handle(e.type_string());
check('512 live lists and10000 nonpacked String elements',()=>{
 const lists=Array.from({length:512},()=>handle(e.list_new(string))),list=lists[511];
 for(let n=0;n<10000;n++){const o=handle(e.string_builder_new(string));zero(e.string_builder_finish(o,string));zero(e.list_push_move(list,o,string));}
 assert.equal(e.list_len(list,string),10000n);const b=handle(e.list_get_borrow(list,9999,string));assert.equal(e.string_len(b,string),0n);zero(e.borrow_drop(b,string));for(const list of lists)zero(e.list_drop(list,string));
});
check('2048 live read borrows remain visible and release correctly',()=>{
 const list=handle(e.list_new(scalar)),o=handle(e.object_new(scalar));zero(e.object_set_scalar(o,scalar,0,37n));zero(e.list_push_move(list,o,scalar));
 const borrows=Array.from({length:2048},()=>handle(e.list_get_borrow(list,0,scalar)));assert.equal(e.list_get_mut_borrow(list,0,scalar),0x105n);
 for(const b of borrows){assert.equal(e.object_get_scalar_bits(b,scalar,0),37n);zero(e.borrow_drop(b,scalar));}
 const b=handle(e.list_get_mut_borrow(list,0,scalar));zero(e.object_set_scalar(b,scalar,0,71n));zero(e.borrow_drop(b,scalar));zero(e.list_drop(list,scalar));
});
check('one million packed scalar values retain ordering and mutable borrow semantics',()=>{
 const list=handle(e.list_new(scalar));for(let n=0;n<1000000;n++){const o=handle(e.object_new(scalar));zero(e.object_set_scalar(o,scalar,0,BigInt(n)));zero(e.list_push_move(list,o,scalar));}
 assert.equal(e.list_len(list,scalar),1000000n);
 for(const n of [0,127,255,65536,999999]){const b=handle(e.list_get_borrow(list,n,scalar));assert.equal(e.object_get_scalar_bits(b,scalar,0),BigInt(n));zero(e.borrow_drop(b,scalar));}
 zero(e.list_drop(list,scalar));
});
check('5000-level owned tree drops without recursive stack limit',()=>{
 let ty=scalar,root=handle(e.object_new(ty));for(let n=0;n<5000;n++){const r=handle(e.type_record_begin(1,0,1));zero(e.type_record_child(r,0,ty));const nt=handle(e.type_record_finish(r)),next=handle(e.object_new(nt));zero(e.object_set_child_move(next,nt,0,root,ty));ty=nt;root=next;}
 zero(e.object_drop(root,ty));const next=handle(e.object_new(ty));zero(e.object_drop(next,ty));
});
const result={accepted:true,engine:'Node V8 actual Core Guest',artifact_sha256:sha,checks,final_linear_memory_bytes:e.memory.buffer.byteLength,ordinary_wasmc_app:false,full_std_core_root:false};fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({accepted:true,checks:checks.length,final_linear_memory_bytes:result.final_linear_memory_bytes}));
