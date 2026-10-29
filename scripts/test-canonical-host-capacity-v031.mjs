#!/usr/bin/env node
// Exercise the actual candidate compiler and wrapper with an existing pinned fixture.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);assert.ok(args.length===0||args.length===4,'optional --compiler PATH --wrapper PATH');
let compilerPath=join(root,'current/wasmc_compiler.wasm'),wrapperPath=join(root,'current/canonical-host.mjs');
if(args.length){assert.equal(args[0],'--compiler');assert.equal(args[2],'--wrapper');compilerPath=resolve(args[1]);wrapperPath=resolve(args[3]);}
const read=p=>new Uint8Array(readFileSync(join(root,p))), hash=b=>createHash('sha256').update(b).digest('hex');
const f='examples/canonical-host/';
const tuple=n=>Object.fromEntries([['wit','lib.wit'],['executionAbi','execution-abi.json'],['providerContract','provider-contract.json'],['binding','binding.json']].map(([k,p])=>[k,read(f+'host/'+n+'/'+p)]));
const original=read(f+'app/ordinary.wasmc'), max=16*1024*1024;assert.ok(original.length<max);
const sourceBytes=new Uint8Array(max);sourceBytes.fill(32);sourceBytes.set(original);const source=new TextDecoder('utf-8',{fatal:true}).decode(sourceBytes);
const activation=JSON.parse(new TextDecoder().decode(read(f+'app/activation.json')));activation.source_sha256=hash(sourceBytes);
const activationBytes=new TextEncoder().encode(JSON.stringify(activation));assert.ok(activationBytes.length<max);
const paddedActivation=new Uint8Array(max);paddedActivation.fill(32);paddedActivation.set(activationBytes);
const input={source,activation:paddedActivation,entry:tuple('entry'),operations:tuple('operations'),libCore:read('standard/wasmc-json/0.0.6/artifact.wasm'),libWit:read('standard/wasmc-json/0.0.6/lib.wit'),template:read(f+'producer-assets/canonical-template.json')};
const compilerBytes=readFileSync(compilerPath);
if(!args.length){
 const manifest=JSON.parse(readFileSync(join(root,'current/compiler-release.json')));
 const wrapper=readFileSync(wrapperPath),pin=manifest.artifacts.find(row=>row.path==='current/canonical-host.mjs');
 assert.equal(manifest.compiler.bytes,compilerBytes.length);assert.equal(manifest.compiler.sha256,hash(compilerBytes));
 assert.ok(pin);assert.equal(pin.bytes,wrapper.length);assert.equal(pin.sha256,hash(wrapper));
}
const module=new WebAssembly.Module(compilerBytes);assert.equal(WebAssembly.Module.imports(module).length,0);
const {createCanonicalHostCompiler}=await import(pathToFileURL(wrapperPath).href);const compiler=await createCanonicalHostCompiler(compilerBytes);
try {
 const result=await compiler.compile(input);assert.equal(result.modules.size,8);
 await assert.rejects(compiler.compile({...input,source:source+' '}),/Source exceeds the hosted byte budget/);
 const over=new Uint8Array(max+1);over.set(paddedActivation);over[max]=32;
 await assert.rejects(compiler.compile({...input,activation:over}),/Compiler input allocation failed/);
 const recovered=await compiler.compile(input);assert.equal(recovered.modules.size,8);assert.equal(hash(result.frame),hash(recovered.frame));
} finally {compiler.dispose();}
// Append an ignored valid custom section to exercise the compiler-carrier limit.
const sectionLength=3*1024*1024;let n=sectionLength,leb=[];do{let b=n&127;n>>>=7;if(n)b|=128;leb.push(b);}while(n);
const paddedCompiler=new Uint8Array(compilerBytes.length+1+leb.length+sectionLength);paddedCompiler.set(compilerBytes);paddedCompiler[compilerBytes.length]=0;paddedCompiler.set(leb,compilerBytes.length+1);
const large=await createCanonicalHostCompiler(paddedCompiler);large.dispose();
await assert.rejects(createCanonicalHostCompiler(new Uint8Array(max+1)),/Compiler exceeds the public 16 MiB artifact budget/);
console.log(JSON.stringify({accepted:true,compiler_sha256:hash(compilerBytes),source_bytes:sourceBytes.length,activation_bytes:paddedActivation.length,modules:8,compiler_carrier_bytes:paddedCompiler.length,compiler_over_16m_rejected:true,plus_one_rejected:true,same_instance_recovery:true,scope:'padded existing fixture, not production'}));
