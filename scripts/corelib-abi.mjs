import assert from 'node:assert/strict';
// The current CoreLib is import-free and exposes numeric function signatures.
// Fail closed on an unrecognized type rather than guessing compatibility.
export function corelibFunctionSignatures(bytes){
 const m=new WebAssembly.Module(bytes);assert.deepEqual(WebAssembly.Module.imports(m),[],'CoreLib imports must be empty');
 const b=new Uint8Array(bytes);let p=8,types=[],functions=[],exports=[];
 const u=()=>{let n=0,shift=0;for(let i=0;i<5;i++){assert.ok(p<b.length,'truncated LEB');let x=b[p++];n+=(x&127)*2**shift;if(!(x&128)){assert.ok(n<=0xffffffff);return n}shift+=7}throw Error('invalid LEB')};
 const vector=()=>{const n=u(),a=[];for(let i=0;i<n;i++){assert.ok(p<b.length);const x=b[p++];assert.ok([0x7f,0x7e,0x7d,0x7c,0x7b,0x70,0x6f].includes(x),'unsupported CoreLib value type');a.push(x)}return a};
 while(p<b.length){const id=b[p++],size=u(),end=p+size;assert.ok(end<=b.length,'truncated section');if(id===1){const count=u();for(let i=0;i<count;i++){assert.equal(b[p++],0x60,'unsupported CoreLib type');types.push({params:vector(),results:vector()})}}else if(id===3){const count=u();for(let i=0;i<count;i++)functions.push(u())}else if(id===7){const count=u();for(let i=0;i<count;i++){const len=u();assert.ok(p+len<=end);const name=new TextDecoder('utf-8',{fatal:true}).decode(b.slice(p,p+len));p+=len;assert.ok(p<end);const kind=b[p++],index=u();if(kind===0)exports.push({name,index})}}assert.ok(p<=end,'invalid section payload');p=end;}
 const result={};for(const {name,index} of exports){assert.ok(index<functions.length,'invalid function export');const type=types[functions[index]];assert.ok(type,'invalid function type');assert.ok(!Object.hasOwn(result,name));result[name]=type}return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
}
