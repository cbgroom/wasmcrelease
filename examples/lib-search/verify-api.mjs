// Test-only Canonical ABI decoder. Applications use the typed WIT/SDK boundary.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const [indexPath,libRoot,referencePath,compilerFacade,sourceSha]=process.argv.slice(2);
const b=fs.readFileSync(indexPath), manifest=JSON.parse(fs.readFileSync(`${libRoot}/lib.json`));
const bytes=fs.readFileSync(`${libRoot}/artifact.wasm`);
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.artifact.sha256);
const m=new WebAssembly.Module(bytes);assert.equal(WebAssembly.Module.imports(m).length,0);
const api=new WebAssembly.Instance(m).exports;
const wit=/^wasmc:lib-search@(\d+\.\d+\.\d+)$/.exec(manifest.wit.package);
assert.ok(wit,'exact LibSearch WIT package required');
const prefix=`wasmc:lib-search/catalog@${wit[1]}#`;
const view=()=>new DataView(api.memory.buffer);
const u32=p=>view().getUint32(p,true);
const str=p=>new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(api.memory.buffer,u32(p),u32(p+4)));
const hit=p=>Object.fromEntries(['identity','signature','skill_path','wit_path','artifact_path'].map((k,i)=>[k,str(p+i*8)]));
const invoke=(name,args,decode)=>{
  const ptr=api[prefix+name](...args);
  try{return decode(ptr);}finally{api['cabi_post_'+prefix+name](ptr);}
};
const input=s=>{const data=new TextEncoder().encode(s);const p=api.cabi_realloc(0,0,1,data.length);new Uint8Array(api.memory.buffer,p,data.length).set(data);return [p,data.length];};
const search=(text,historical,offset,limit)=>invoke('search',[...input(text),historical,offset,limit],p=>{
  if(u32(p)!==0)return {error:view().getUint8(p+4)};
  const base=u32(p+4),n=u32(p+8);assert.ok(n<=64);
  return Array.from({length:n},(_,i)=>hit(base+i*40));
});
const lookup=text=>invoke('lookup',input(text),p=>view().getUint8(p)===0?null:hit(p+4));
const info=invoke('snapshot',[],p=>({format_version:u32(p),entry_count:u32(p+4),index_sha256:str(p+8)}));
assert.equal(info.index_sha256,createHash('sha256').update(b).digest('hex'));
const strings=b.readUInt16LE(4),count=b.readUInt16LE(6),rows=8+(strings+1)*4,pool=rows+count*15;
const string=id=>b.subarray(pool+b.readUInt32LE(8+id*4),pool+b.readUInt32LE(12+id*4)).toString('utf8');
const entries=Array.from({length:count},(_,i)=>{
 const fields=Array.from({length:6},(_,f)=>string(b.readUInt16LE(rows+i*15+3+f*2)));
 return {historical:!!(b[rows+i*15]&2),bytes:new TextEncoder().encode(fields[2]),text:fields[2],hit:{identity:fields[0],signature:fields[1],skill_path:fields[3],wit_path:fields[4],artifact_path:fields[5]}};
});
assert.equal(info.entry_count,count);
let query=new Uint8Array();
const reference=compilerFacade
 ? await (await import(pathToFileURL(resolve(compilerFacade)).href)).compile(fs.readFileSync(referencePath,'utf8'))
 : fs.readFileSync(referencePath);
const refModule=new WebAssembly.Module(reference);
const allowed=['entry_count','entry_length','entry_byte','entry_historical','query_length','query_byte'];
assert.deepEqual(WebAssembly.Module.imports(refModule).map(i=>`${i.module}.${i.name}`),allowed.map(i=>`corpus.${i}`));
const ref=new WebAssembly.Instance(refModule,{corpus:{entry_count:()=>count,entry_length:e=>entries[e].bytes.length,entry_byte:(e,i)=>entries[e].bytes[i],entry_historical:e=>+entries[e].historical,query_length:()=>query.length,query_byte:i=>query[i]}}).exports;
let checks=0;
const fold=text=>text.replace(/[A-Z]/g,c=>String.fromCharCode(c.charCodeAt(0)+32));
for(const text of ['','base64','base64 decode','does-not-exist','BASE64',' string ','map','wasmc:std','bytes push','\tlist\n','é','🙂','\v','base64\vdecode','base64\u00a0decode']) {
 query=new TextEncoder().encode(text);
 for(const historical of [0,1]) for(const offset of [0,1,64,0xffffffff]) for(const limit of [0,1,8,64]) {
  const tokens=fold(text).split(/[\t\n\r\f ]+/).filter(Boolean);
  const ids=entries.map((e,i)=>i).filter(i=>(historical||!entries[i].historical)&&tokens.every(t=>fold(entries[i].text).includes(t))).slice(offset,offset+limit);
  assert.deepEqual(search(text,historical,offset,limit),ids.map(i=>entries[i].hit));
  assert.equal(ref.run(offset,limit,historical,-1),ids.length);
  for(let i=0;i<ids.length;i++)assert.equal(ref.run(offset,limit,historical,i),ids[i]);
  assert.equal(ref.run(offset,limit,historical,ids.length),-1);checks++;
 }
}
for(const e of entries){assert.deepEqual(lookup(e.hit.identity),e.hit);checks++;}
assert.equal(lookup('not-found'),null);
assert.deepEqual(search('x'.repeat(257),0,0,1),{error:0});
assert.deepEqual(search('a '.repeat(17),0,0,1),{error:0});
assert.deepEqual(search('',0,0,65),{error:1});
query=new TextEncoder().encode('x'.repeat(257));assert.equal(ref.run(0,1,0,-1),-2);
query=new TextEncoder().encode('a '.repeat(17));assert.equal(ref.run(0,1,0,-1),-2);
query=new Uint8Array();assert.equal(ref.run(0,65,0,-1),-3);
for(let i=0;i<1000;i++)search('base64',0,0,8);
const pages=api.memory.buffer.byteLength;
for(let i=0;i<10000;i++)search('base64',0,0,8);
assert.equal(api.memory.buffer.byteLength,pages,'post-return cleanup must prevent linear page growth');
const runtimeVersion=typeof Bun!=='undefined'?`Bun ${Bun.version}`:typeof Deno!=='undefined'?`Deno ${Deno.version.deno}`:process.version;
console.log(JSON.stringify({accepted:true,source_commit:sourceSha??null,engine:runtimeVersion,artifact_sha256:manifest.artifact.sha256,formal_core_bytes:bytes.length,index_bytes:b.length,entries:count,comparison_cases:checks+7,resident_calls:11000,memory_pages:pages/65536,reference:'independent WAsmC algorithm; Host supplies read-only bytes, not matching logic'}));
