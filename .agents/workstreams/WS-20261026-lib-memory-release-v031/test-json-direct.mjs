import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {CoreCaller,string,list,u8,u64,i64,bool,record,result,enumeration} from '../../../scripts/current-core-value-codec-v3.mjs';
const [wasmPath,watPath,out,expectedSha="8bf27c964cdf4d772ab9cd55d3d8d52631d6dd644f47651f2ebae41f1380a559"]=process.argv.slice(2);
const bytes=fs.readFileSync(wasmPath),wat=fs.readFileSync(watPath,'utf8');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expectedSha);
// Test ABI comes from wasm-tools' standard decoded module, not a guessed WIT signature.
const functions=new Map();
for(const line of wat.split('\n')){
  const m=line.match(/^  \(func (\S+) .*\(type \d+\)(.*)$/);if(!m)continue;
  const lanes=kind=>(m[2].match(new RegExp('\\('+kind+' ([^)]*)\\)'))?.[1]??'').split(' ').filter(Boolean);
  functions.set(m[1].startsWith('(;')?m[1].slice(2,-2):m[1],{params:lanes('param'),results:lanes('result')});
}
const exports=[];
for(const m of wat.matchAll(/^  \(export "([^"]+)" \(func (\S+)\)\)$/gm)){
  const f=functions.get(m[2]);assert(f,'decoded function absent '+m[2]);exports.push({kind:'function',name:m[1],...f});
}
const c=new CoreCaller(new WebAssembly.Module(bytes),{exports});
const errors=['invalid-json','invalid-pointer','missing-target','type-mismatch','invalid-index','out-of-range','invalid-operation','allocation-failed'];
const checks=[];
const check=(name,fn)=>{fn();checks.push(name);};
const raw=v=>Array.from(Buffer.from(v));
check('3MiB compact crosses document allocation and output ceilings',()=>{
 const input=JSON.stringify('x'.repeat(3*1024*1024));assert.deepEqual(c.call('compact',[string],[input],result(string,errors)),{tag:'ok',value:input});
});
check('70000 byte output crosses list and output-node ceilings',()=>assert.deepEqual(c.call('encode',[string],['x'.repeat(70000)],list(u8)),Array(70000).fill(120)));
check('70000 input parts cross input list ceiling',()=>assert.deepEqual(c.call('encode-parts',[list(string)],[Array(70000).fill('')],list(u8)),[]));
check('typed integer exactness and missing distinction',()=>{
 assert.deepEqual(c.call('read-u64',[list(u8),string],[raw('{"n":18446744073709551615}'),'/n'],result(record({present:bool,value:u64}),errors)),{tag:'ok',value:{present:true,value:18446744073709551615n}});
 assert.deepEqual(c.call('read-i64',[list(u8),string],[raw('{"n":-9223372036854775808}'),'/n'],result(record({present:bool,value:i64}),errors)),{tag:'ok',value:{present:true,value:-9223372036854775808n}});
});
check('atomic batch edits and later independent call',()=>{
 const edit=record({kind:enumeration(['set','remove']),path:string,'value-json':string});
 const v=c.call('edit-bytes',[list(u8),list(edit)],[raw('{"a":1,"b":[]}'),[{kind:'set',path:'/b/-','value-json':'true'},{kind:'remove',path:'/a','value-json':''}]],result(list(u8),errors));assert.equal(v.tag,'ok');assert.equal(Buffer.from(v.value).toString(),'{"b":[true]}');
 const fail=c.call('edit-bytes',[list(u8),list(edit)],[raw('{"a":1}'),[{kind:'set',path:'/a','value-json':'2'},{kind:'remove',path:'/missing','value-json':''}]],result(list(u8),errors));assert.deepEqual(fail,{tag:'err',value:'missing-target'});
 assert.deepEqual(c.call('compact',[string],['{"a":1}'],result(string,errors)),{tag:'ok',value:'{"a":1}'});
});
check('direct edit preserves exact atomic output and explicit fallback',()=>{
 const edit=record({kind:enumeration(['set','remove']),path:string,'value-json':string});
 const doEdit=(input,edits,fallback)=>c.call('edit-or-bytes',[list(u8),list(edit),string],[raw(input),edits,fallback],string);
 const edits=[{kind:'set',path:'/b/-','value-json':'true'},{kind:'remove',path:'/a','value-json':''}];
 assert.equal(doEdit('{"a":1,"b":[]}',edits,'fallback'),' {"b":[true]}'.trim());
 assert.equal(doEdit('{"a":1}',[{kind:'set',path:'/a','value-json':'2'},{kind:'remove',path:'/missing','value-json':''}],'unchanged'),'unchanged');
 assert.equal(doEdit('invalid',edits,'bad-json'),'bad-json');
 assert.equal(doEdit('{"a":1}',[{kind:'set',path:'/a','value-json':'42'}],'fallback'),'{"a":42}');
});
check('actual memory above64MiB remains usable',()=>{
 const memory=c.exports.memory;memory.grow(Math.max(0,Math.ceil((65*1024*1024-memory.buffer.byteLength)/65536)));
 assert(c.view.byteLength>64*1024*1024);
 assert.deepEqual(c.call('compact',[string],['true'],result(string,errors)),{tag:'ok',value:'true'});
});
check('actual out-of-memory range and invalid bool remain rejected',()=>{
 const p=c.alloc(8,4);c.view.setUint32(p,c.view.byteLength-1,true);c.view.setUint32(p+4,2,true);assert.throws(()=>c.read(string,p),/range/);
 c.view.setUint8(p,2);assert.throws(()=>c.read(bool,p),/discriminant/);c.exports.cabi_realloc(p,8,4,0);
});
fs.writeFileSync(out,JSON.stringify({accepted:true,raw_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),decoded_export_count:exports.length,checks,ordinary_wasmc_app:false,generated_sdk:false,scope:'actual Core Guest and shared canonical JS consumer; changed Rust CI and explicit fallback qualification separately pinned'},null,2)+'\n');
console.log(JSON.stringify({accepted:true,checks:checks.length}));
