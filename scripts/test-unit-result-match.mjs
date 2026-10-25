import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>new Uint8Array(readFileSync(new URL(p,root))),enc=new TextEncoder(),dec=new TextDecoder(),hash=b=>createHash('sha256').update(b).digest(),fixture='examples/current/unit-result-match/';
const compilerBytes=read('current/wasmc_compiler.wasm'),compiler=new WebAssembly.Instance(new WebAssembly.Module(compilerBytes),{}).exports;
let sourceCases=0,guestCalls=0,hostEffects=0,errorDrops=0,traps=0,negativeSources=0;
for(const identity of ['conformance:unit','independent:cleanup']){
 const wit=enc.encode(dec.decode(read(fixture+'lib.wit')).replace('conformance:unit@',identity+'@'));
 const abi=read(fixture+'execution-abi.json'),provider=read(fixture+'provider-contract.json'),binding=JSON.parse(dec.decode(read(fixture+'binding.json')));binding.wit_sha256=hash(wit).toString('hex');const assets=[wit,abi,provider,enc.encode(JSON.stringify(binding))];
 const compile=source=>{const digests=new Uint8Array(128);assets.forEach((b,i)=>digests.set(hash(b),32*i));[...assets,digests].forEach((b,i)=>{const p=compiler.wasmc_wit_fastabi_artifact_alloc(i,b.length);new Uint8Array(compiler.memory.buffer,p,b.length).set(b);});const b=enc.encode(source),p=compiler.wasmc_alloc(b.length);new Uint8Array(compiler.memory.buffer,p,b.length).set(b);const status=compiler.wasmc_compile_wit_fastabi(p,b.length);const bytes=new Uint8Array(compiler.memory.buffer,status===0?compiler.wasmc_output_ptr():compiler.wasmc_error_ptr(),status===0?compiler.wasmc_output_len():compiler.wasmc_error_len()).slice();return{status,bytes};};
 for(const nested of [false,true]){
  const source=dec.decode(read(fixture+(nested?'continue.wasmc':'return.wasmc')));const result=compile(source);assert.equal(result.status,0,dec.decode(result.bytes));sourceCases++;
  let app,calls=0,drops=0;const live=new Set();const host={finish:mode=>{calls++;if(mode===0)return[0,0];if(mode===3)return[1,0];if(mode===5)return[-1,0];if(mode===6)return[-2147483648,0];if(mode===7)return[2147483647,0];const h=100+mode;assert(!live.has(h));live.add(h);return[0,h];},case:h=>h===101?0:h===102?1:9,len:h=>{assert(live.has(h));return 1;},read:(h,p,n)=>{assert(live.has(h));assert.equal(n,1);new Uint8Array(app.exports.memory.buffer,p,n).set([101]);return 0;},drop:h=>{assert(live.delete(h));drops++;return 0;}};
  app=new WebAssembly.Instance(new WebAssembly.Module(result.bytes),{'conformance:unit/v1':host});
  for(let round=0;round<32;round++)for(const mode of [0,1,2,3,4,5,6,7,0]){const before=calls,d=drops;let output,failed=false;try{output=app.exports.run(mode);}catch(e){assert(e instanceof WebAssembly.RuntimeError);failed=true;}assert.equal(failed,mode>=3);if(failed)traps++;else assert.equal(Array.isArray(output)?output[0]:output,mode===0?7:mode===1?19:23);assert.equal(calls-before,nested&&mode===0?2:1);assert.equal(drops-d,[1,2,4].includes(mode)?1:0);assert.equal(live.size,0);guestCalls++;}
  hostEffects+=calls;errorDrops+=drops;
 }
 const source=dec.decode(read(fixture+'return.wasmc'));
 for(const invalid of [source.replace('ok=>7','ok(unit)=>7'),source.replace(',retry(message)=>23',''),'invalid source']){assert.notEqual(compile(invalid).status,0);negativeSources++;}
 assert.equal(compile(source).status,0,'same compiler recovers after rejection');
}
compiler.wasmc_clear();
assert.equal(sourceCases,4);assert.equal(guestCalls,1152);assert.equal(hostEffects,1280);assert.equal(errorDrops,384);assert.equal(traps,640);assert.equal(negativeSources,6);
console.log(JSON.stringify({accepted:true,compiler_sha256:hash(compilerBytes).toString('hex'),source_cases:sourceCases,guest_calls:guestCalls,host_effects:hostEffects,error_handles_dropped:errorDrops,malformed_traps:traps,negative_sources_rejected:negativeSources,same_instance_recovery:true,live_handles:0,real_Host_effects:false}));
