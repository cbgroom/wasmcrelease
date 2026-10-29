// Candidate-only reproduction against a disposable v031 2172 fixture stage.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]??''); assert.ok(process.argv.length===3,'provide disposable stage path');
const read=p=>readFileSync(resolve(root,p)),sha=b=>createHash('sha256').update(b).digest('hex'), json=p=>JSON.parse(read(p));
const f='examples/current/canonical-host-v031/';
const before={
 [f+'expected-frame.json']:'d9296e658ba642d4625e3e3066e3a6f7ecac0f9f72372d7869df325d224a46e6',
 [f+'checked-chunk-profile.json']:'303657c83ae3f96aba904c168e50a377fd9b17eaa1c3409bede324cb64967466',
 [f+'import-demand-proof.json']:'d9701b4154a9d35bb77549e999259071941fdf84c91be37e35778437db970ce4',
 'current/compiler-release.json':'5cf1f9c97c102310b75473e85401828650be1532816a70de18b64d97221f6398'};
for(const [p,h] of Object.entries(before))assert.equal(sha(read(p)),h,`baseline: ${p}`);
const compilerBytes=read('current/wasmc_compiler.wasm'),compilerHash=sha(compilerBytes);
assert.equal(compilerHash,'fb1d34e75427c2629a62b00bb9ca1ce4e4c0f2fb224e2305c1ec2d5e39cc2f7c','candidate compiler');
const {createCanonicalHostCompiler}=await import(pathToFileURL(resolve(root,'current/canonical-host.mjs')));
const tuple=n=>Object.fromEntries([['wit','lib.wit'],['executionAbi','execution-abi.json'],['providerContract','provider-contract.json'],['binding','binding.json']].map(([k,p])=>[k,read(f+'host/'+n+'/'+p)]));
const base={entry:tuple('entry'),operations:tuple('operations'),libCore:read('standard/wasmc-json/0.0.6/artifact.wasm'),libWit:read('standard/wasmc-json/0.0.6/lib.wit'),template:read(f+'producer-assets/canonical-template.json')};
const compiler=await createCanonicalHostCompiler(compilerBytes),rows={};
try {for(const name of ['ordinary','static','json-read']) {const source=read(f+'app/'+name+'.wasmc').toString(),a=json(f+'app/activation.json');a.source_sha256=sha(Buffer.from(source));const activation=name==='ordinary'?read(f+'app/activation.json'):Buffer.from(JSON.stringify(a));const result=await compiler.compile({...base,source,activation});assert.equal(result.modules.size,8);rows[name]={frame:sha(result.frame),size:result.frame.length,modules:result.descriptor.modules};}} finally {compiler.dispose()}
const expected=json(f+'expected-frame.json');Object.assign(expected,{frame_sha256:rows.ordinary.frame,frame_bytes:rows.ordinary.size,compiler_sha256:compilerHash,modules:rows.ordinary.modules});
const profile=json(f+'checked-chunk-profile.json');Object.assign(profile.compiler,{bytes:compilerBytes.length,sha256:compilerHash});profile.compiler_build_source='51ddc3c2c790d25186e4441274edb8d2bd665f20';
const proof=json(f+'import-demand-proof.json');proof.compiler_sha256=compilerHash;for(const row of proof.cases)row.frame_sha256=rows[{table_control:'ordinary',json_read:'json-read',static:'static'}[row.name]].frame;
const release=json('current/compiler-release.json');Object.assign(release.compiler,{bytes:compilerBytes.length,sha256:compilerHash});
for(const [path,value] of [[f+'expected-frame.json',expected],[f+'checked-chunk-profile.json',profile],[f+'import-demand-proof.json',proof],['current/compiler-release.json',release]])writeFileSync(resolve(root,path),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({candidate_only:true,compiler:compilerHash,frames:rows}));
