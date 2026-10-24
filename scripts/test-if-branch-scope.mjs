import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as sidecar from '../current/index.mjs';
import * as single from '../current/wasmc.mjs';
(0,eval)(readFileSync(new URL('../current/wasmc.global.js',import.meta.url),'utf8'));
const apis=[sidecar,single,globalThis.Wasmc];
const source=body=>`package neutral:branches; interface api {record Pair {left:u32,right:u32} run:func(input:u32)->u32 {${body}}} world app {export api;}`;
const cases=[
 ['if (input == 0) {let mut body:u32 = 10; body = body + 1; return body;} else {let mut body:u32 = 20; body = body + 2; return body;}',n=>n===0?11:22],
 ['if (input == 0) {let mut body:Pair = {left:10,right:1}; body.left = body.left + 3; return body.left + body.right;} else {let mut body:Pair = {left:20,right:2}; body.right = body.right + 4; return body.left + body.right;}',n=>n===0?14:26],
 ['let mut answer:u32 = 0; if (input == 0) {let body:u32 = 1; if (body == 1) {let scratch:u32 = 10; answer = scratch;} else {let scratch:u32 = 11; answer = scratch;} let scratch:u32 = 2; answer = answer + scratch;} else {let body:u32 = 20; answer = body;} let body:u32 = 3; return answer + body;',n=>n===0?15:23],
 ['let mut index:u32 = 0; let mut answer:u32 = 0; while (index < input) {if (index == 0) {let mut body:u32 = 1; body = body + 2; answer = answer + body;} else {let mut body:u32 = 4; body = body + 3; answer = answer + body;} index = index + 1;} return answer;',n=>n===0?0:3+(n-1)*7],
 ['let mut answer:u32 = 0; if (input == 0) {let body:u32 = 1; answer = body;} if (input != 0) {let body:u32 = 2; answer = body;} let mut body:u32 = 3; body = body + answer; return body;',n=>n===0?4:5]
];
const rejected=[
 'if (input == 0) {let body:u32 = 1;} else {return body;} return 0;',
 'if (input == 0) {let body:u32 = 1;} return body;',
 'if (input == 0) {let mut body:u32 = 1;} body = 2; return 0;',
 'if (input == 0) {let body:u32 = 1; let body:u32 = 2;} return 0;',
 'let body:u32 = 1; if (input == 0) {let body:u32 = 2;} return body;',
 'if (input == 0) {let input:u32 = 2;} return input;',
 'if (input == 0) {let mut body:Pair = {left:1,right:2};} else {let body:Pair = {left:2,right:3}; body.left = 4;} return 0;',
 'if (input == 0) {let body:Pair = {left:1,right:2};} return body.left;'
];
let scalarCalls=0,managedCalls=0,rejections=0;
for(const [body,oracle] of cases){
 let expected;
 for(const api of apis){
  const bytes=await api.compile(source(body));
  expected??=bytes;assert.deepEqual(bytes,expected);assert.ok(WebAssembly.validate(bytes));
  const module=new WebAssembly.Module(bytes);assert.deepEqual(WebAssembly.Module.imports(module),[]);
  const app=new WebAssembly.Instance(module,{});
  for(let round=0;round<16;round++)for(const n of [0,1,2,3,8]){assert.equal(app.exports.run(n),oracle(n));scalarCalls++;}
 }
}
for(const api of apis){
 for(const body of rejected){await assert.rejects(async()=>api.compile(source(body)));rejections++;}
 for(const body of [
  'if (input == 0) {let body:string = "alpha"; return body.len();} else {let body:string = "雪"; return body.len();}',
  'let mut answer:u32 = 0; if (input == 0) {let body:string = "alpha"; answer = body.len();} else {let body:string = "雪"; answer = body.len();} let body:string = "x"; return answer + body.len();'
 ]){
  const app=await api.instantiateLib(source(body));
  for(let round=0;round<16;round++)for(const n of [0,1]){
   const value=app.exports.run(n);if(Array.isArray(value))assert.equal(value[1],0);
   assert.equal(Array.isArray(value)?value[0]:value,(n===0?5:3)+Number(body.includes('answer')));managedCalls++;
  }
 }
}
console.log(JSON.stringify({accepted:true,engine:globalThis.Deno?'deno':globalThis.Bun?'bun':'node',
 compiler_sha256:createHash('sha256').update(readFileSync(new URL('../current/wasmc_compiler.wasm',import.meta.url))).digest('hex'),
 source_cases:cases.length,scalar_calls:scalarCalls,managed_calls:managedCalls,scope_rejections:rejections,
 carrier_forms:3,physical_owner_slots_preserved:true}));
