import assert from 'node:assert/strict';
import {createSocket} from 'node:dgram';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compile} from '../../../current/wasmc.mjs';
const watchdog=setTimeout(()=>{console.error('Native UDP conformance timeout');process.exit(1);},30000);
const lib='libs/wasmc-owned-algorithms/artifact.wasm',app='target/host-udp/guest.wasm';
const libBytes=await readFile(lib),appBytes=await compile(await readFile('host/tests/e2e/guest.wasmc','utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(libBytes),'44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
assert.equal(sha(appBytes),'4eff84eccf06251a0b5de89e81d4faaeb5f51bce18724d8f011b95ea0ab7fd19');
await mkdir('target/host-udp',{recursive:true});await writeFile(app,appBytes);
async function bound(){const socket=createSocket('udp4');socket.on('error',()=>{});await new Promise(resolve=>socket.bind(0,'127.0.0.1',resolve));return socket;}
const client=await bound(),foreign=await bound(),queue=[];let wake,foreignReplies=0;
client.on('message',bytes=>{queue.push(Buffer.from(bytes));wake?.();});foreign.on('message',()=>{foreignReplies++;});
async function receive(){if(queue.length)return queue.shift();return new Promise(resolve=>{wake=()=>{wake=undefined;resolve(queue.shift());};});}
const vectors=[[client,[],0],[client,[7],0],[client,[1,2,3,255],0],[client,Array.from({length:16},(_,i)=>i),0],[client,Array(17).fill(1),-5],[client,Array(64).fill(1),-5],[foreign,[1],-2],[client,[9],0]];
const wasmtime=process.argv.includes('--wasmtime');
const child=spawn(process.argv[2],[`127.0.0.1:${client.address().port}`,String(vectors.length),lib,app,...(wasmtime?['--wasmtime']:[])],{env:{},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',bytes=>{stderr+=bytes;});
const exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
async function next(){const line=await lines.next();assert.equal(line.done,false,stderr);return JSON.parse(line.value);}
let calls=0;
try {
  const {port}=await next();assert.ok(port>0);
  for(const [index,[socket,data,status]] of vectors.entries()) {
    await new Promise((resolve,reject)=>socket.send(Uint8Array.from(data),port,'127.0.0.1',error=>error?reject(error):resolve()));
    const sum=status?0:data.reduce((a,b)=>a+b,0);if(!status)calls++;
    assert.deepEqual(await next(),{index,status,sum,calls});
    if(!status){const expected=Buffer.alloc(8);expected.writeBigInt64LE(BigInt(sum));assert.deepEqual(await receive(),expected);}
  }
  assert.deepEqual(await next(),{accepted:true,calls:5,rejected:3,lib_instances:1,app_instances:1,resource_retired:true});
  assert.equal(await exit,0,stderr);assert.equal(foreignReplies,0);assert.equal(queue.length,0);
}finally{if(child.exitCode===null)child.kill();await new Promise(resolve=>client.close(resolve));await new Promise(resolve=>foreign.close(resolve));clearTimeout(watchdog);}
console.log(JSON.stringify({accepted:true,real_loopback_udp:true,native_engine:wasmtime?'Wasmtime47':'Wasmi2',messages:8,calls,rejected:3,foreign_replies:foreignReplies,message_boundaries_preserved:true,oversized_not_truncated:true,lib_sha256:sha(libBytes),app_sha256:sha(appBytes),lib_instances:1,app_instances:1,resource_retired:true,guest_address_authority:false,udp_authentication:false,native_async_qualified:false}));
