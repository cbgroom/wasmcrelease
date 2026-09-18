import { compile } from '../../../current/wasmc.mjs';
import { MemoryHost } from './reference.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const negotiated=process.argv.includes('--negotiated');
const wasm = await compile(await readFile(negotiated?'host/contract/v0/negotiation-guest.wasmc':'host/contract/v0/guest.wasmc','utf8'));
await mkdir('target/thin-host',{recursive:true});
await writeFile('target/thin-host/guest.wasm',wasm);
const host = new MemoryHost();
const imports = {};
for(const name of ['describe','window_acquire','window_commit','invoke','wait','cancel','release']) imports[name]=(a,b)=>host.step([name,a,b]);
const {instance}=await WebAssembly.instantiate(wasm,{host:imports});
const rows=[];
for(const size of [0,1,4,16]) {
  const result=instance.exports.run(size);
  assert.equal(result,size);
  assert.equal(host.windows.size,0); assert.equal(host.ops.size,0);
  rows.push([result,host.windows.size,host.ops.size,...host.bytes]);
}
const jit=process.argv.includes('--wasmtime');
async function native(extra=[]) {
const child=spawn(process.argv[2],['target/thin-host/guest.wasm',...(jit?['--wasmtime']:[]),...extra],{env:{},stdio:['ignore','pipe','pipe']});
let stdout='',stderr='';child.stdout.on('data',bytes=>{stdout+=bytes;});child.stderr.on('data',bytes=>{stderr+=bytes;});
const timer=setTimeout(()=>child.kill(),30000);
const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);}).finally(()=>clearTimeout(timer));
if(status!==0)throw Error(stderr||'Native kernel exited or timed out');
return JSON.parse(stdout);
}
assert.deepEqual(await native(),rows);
let denials=0;
if(negotiated)for(const [field,value] of [[0,1],[1,2],[2,0],[3,0],[4,0],[1,-7],[2,-7]]) {
  const denied=new MemoryHost(),bound={};let effects=0;
  for(const name of Object.keys(imports))bound[name]=(a,b)=>{
    if(name==='describe'&&b===field)return value;
    if(name!=='describe')effects++;return denied.step([name,a,b]);
  };
  const {instance}=await WebAssembly.instantiate(wasm,{host:bound});
  assert.equal(instance.exports.run(4),-7);assert.equal(effects,0);
  assert.equal(denied.windows.size,0);assert.equal(denied.ops.size,0);assert.deepEqual(denied.bytes,[]);denials++;
  assert.deepEqual(await native([`--describe-override=${field}:${value}`]),[[-7,0,0,0]]);
}
let failureControls=0;
if(negotiated)for(const [name,code,windows,operations,calls] of [['quota',-3,8,0,1],['window_acquire',-3,0,0,1],['window_commit',-5,0,0,3],['invoke',-3,0,0,4],['wait',-8,1,1,4]]) {
  const state=new MemoryHost(),bound={};let effects=0;
  if(name==='quota')for(let i=0;i<8;i++)state.step(['window_acquire',1,0]);
  for(const operation of Object.keys(imports))bound[operation]=(a,b)=>{
    if(operation!=='describe')effects++;
    if(operation===name)return code;return state.step([operation,a,b]);
  };
  const {instance}=await WebAssembly.instantiate(wasm,{host:bound});
  assert.equal(instance.exports.run(4),code);
  assert.equal(state.windows.size,windows);assert.equal(state.ops.size,operations);
  assert.equal(effects,calls);assert.deepEqual(state.bytes,[]);
  if(name==='wait')assert.equal([...state.windows.values()][0].busy,true);
  const args=name==='quota'?['--preload-window-quota']:[`--fail-before=${name}:${code}`];
  assert.deepEqual(await native(args),[[code,windows,operations,calls]]);failureControls++;
}
console.log(JSON.stringify({accepted:true,core_guest_cases:4,negotiated,preflight_denials:denials,failure_controls:failureControls,unknown_completion_retained:negotiated,retained_resources_after_unknown_completion:negotiated?[1,1]:[],cleanup_scope:'successful_and_known_preissue_failures_excluding_preexisting_owners',guest_sha256:createHash('sha256').update(wasm).digest('hex'),resource_cleanup:true,engines:jit?'JS WebAssembly / Wasmtime47':'JS WebAssembly / Wasmi2',real_io:false}));
