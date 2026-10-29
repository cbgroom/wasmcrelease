import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=process.argv[2];const module=new WebAssembly.Module(readFileSync(path));assert.deepEqual(WebAssembly.Module.imports(module),[]);
const e=new WebAssembly.Instance(module,{}).exports,encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true}),prefix='wasmc:json/document@0.2.3#';
function compact(input){const b=encoder.encode(input),p=e.cabi_realloc(0,0,1,b.length);new Uint8Array(e.memory.buffer,p,b.length).set(b);const ret=e[prefix+'compact-bytes'](p,b.length);const view=new DataView(e.memory.buffer);const tag=view.getUint8(ret);let answer;
 if(tag===0){const ptr=view.getUint32(ret+4,true),len=view.getUint32(ret+8,true);answer=decoder.decode(new Uint8Array(e.memory.buffer,ptr,len));}else answer={error:view.getUint8(ret+4)};
 e['cabi_post_'+prefix+'compact-bytes'](ret);return answer;}
for(const input of ['{"雪":"🦀","n":1}','[1, 2, {"v":true}]','{}'])assert.deepEqual(JSON.parse(compact(input)),JSON.parse(input));
assert.deepEqual(compact('[1,]'),{error:0});assert.equal(compact('{"next":2}'),'{"next":2}');
const depth=20_000,deep='['.repeat(depth)+'0'+']'.repeat(depth);assert.equal(compact(deep),deep);
console.log(JSON.stringify({status:'PASS',engine:globalThis.Bun?'Bun WebAssembly Core':globalThis.Deno?'Deno WebAssembly Core':'Node WebAssembly Core',identity:'wasmc-json@0.2.3',imports:0,unicode:true,invalid_input:true,same_instance_recovery:true,depth}));
