import {createServer,createConnection} from 'node:net';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {PreauthorizedTcpListener} from './listener.mjs';
const watchdog=setTimeout(()=>{console.error('TCP listener conformance timeout');process.exit(1);},30000);
const libPath='libs/wasmc-owned-algorithms/artifact.wasm',libBytes=await readFile(libPath);
const digest=createHash('sha256').update(libBytes).digest('hex');
assert.equal(digest,'44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
const cases=[];
for(let repeat=0;repeat<4;repeat++) for(const bytes of [[],[7],[1,2,3,255],Array.from({length:16},(_,i)=>i)]) cases.push(bytes);
// Bad input followed by valid input proves service survival, not just process exit.
cases.splice(5,0,'oversized');cases.splice(11,0,'truncated');cases.push([9]);
async function listen() {
  const server=createServer({allowHalfOpen:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,listener:new PreauthorizedTcpListener(server),port:server.address().port};
}
async function client(port,input) {
  const socket=createConnection({host:'127.0.0.1',port});socket.on('error',()=>{});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  const chunks=[],closed=new Promise(resolve=>socket.once('close',()=>resolve(Buffer.concat(chunks))));
  socket.on('data',bytes=>chunks.push(bytes));
  if(input==='oversized') socket.write(Uint8Array.of(17));
  else if(input==='truncated') socket.end(Uint8Array.of(2,7));
  else {
    socket.write(Uint8Array.of(input.length));
    // Force the server to accumulate across at least two TCP writes.
    await new Promise(resolve=>setTimeout(resolve,2));socket.write(Uint8Array.from(input));
  }
  const output=await closed;
  const expected=Buffer.alloc(typeof input==='string'?0:8);
  if(expected.length) expected.writeBigInt64LE(BigInt(input.reduce((a,b)=>a+b,0)));
  assert.deepEqual(output,expected);
}
async function jsService(listener) {
  const {instance}=await WebAssembly.instantiate(libBytes,{}),e=instance.exports;
  const ptr=e.cabi_realloc(0,0,4,64);let calls=0,rejected=0;
  try {
    for(let i=0;i<cases.length;i++) {
      const tcp=await listener.accept();
      const read=async n=>{
        const timer=setTimeout(()=>tcp.terminateRead(),500);
        try {return await tcp.read(n);} finally {clearTimeout(timer);}
      };
      try {
        const header=await read(1);if(header.length!==1||header[0]>16) throw -5;
        const input=[];
        while(input.length<header[0]) {const chunk=await read(header[0]-input.length);if(!chunk.length) throw -8;input.push(...chunk);}
        const view=new DataView(e.memory.buffer);input.forEach((b,j)=>view.setInt32(ptr+4*j,b,true));
        const value=e['sum-s32'](ptr,input.length);calls++;
        const output=Buffer.alloc(8);output.writeBigInt64LE(value);await tcp.write([...output]);
      } catch {rejected++;}
      finally {await tcp.release();}
    }
  } finally {e.cabi_realloc(ptr,64,4,0);await listener.release();}
  return {accepted:true,calls,rejected,lib_instances:1,listener_retired:true};
}
const local=await listen(),service=jsService(local.listener);
for(const input of cases) await client(local.port,input);
const js=await service;
assert.deepEqual(js,{accepted:true,calls:17,rejected:2,lib_instances:1,listener_retired:true});
assert.equal(local.listener.counts().active,0);await assert.rejects(local.listener.accept(),e=>e===-1);
const native=spawn(process.argv[2],[libPath,String(cases.length)],{env:{},stdio:['ignore','pipe','pipe']});
let out='',err='',ready;
const start=new Promise(resolve=>{ready=resolve;});native.stdout.on('data',b=>{out+=b;if(out.includes('\n')) ready(JSON.parse(out.split('\n')[0]).port);});
native.stderr.on('data',b=>{err+=b;console.error(String(b));});
const exit=new Promise((resolve,reject)=>{native.on('error',reject);native.on('close',code=>{ready(-1);resolve(code);});});
const port=await start;assert.ok(port>0,err);
for(const input of cases) await client(port,input);
assert.equal(await exit,0,err);assert.deepEqual(JSON.parse(out.trim().split('\n')[1]),js);
// Pending accept cancellation and single pending accept ownership.
let controls=0;
const cancelled=await listen(),pending=cancelled.listener.accept();
const denied=assert.rejects(pending,e=>e===-6);
await assert.rejects(cancelled.listener.accept(),e=>e===-4);controls++;
await cancelled.listener.release();await denied;controls++;
await assert.rejects(cancelled.listener.accept(),e=>e===-1);controls++;
await assert.rejects(cancelled.listener.release(),e=>e===-1);controls++;
// Accepted endpoint outlives listener authority until explicitly closed.
const busy=await listen();
const socket=createConnection({host:'127.0.0.1',port:busy.port});socket.on('error',()=>{});
const endpoint=await busy.listener.accept();
await assert.rejects(busy.listener.release(),e=>e===-4);controls++;
await endpoint.release();socket.destroy();await busy.listener.release();
const capacity=await listen(),clients=[];
for(let i=0;i<3;i++) {
  const socket=createConnection({host:'127.0.0.1',port:capacity.port});socket.on('error',()=>{});
  const closed=new Promise(resolve=>socket.once('close',resolve));
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  clients.push({socket,closed});
}
await clients[2].closed;
assert.deepEqual(capacity.listener.counts(),{queued:2,active:0,rejected:1});controls++;
const first=await capacity.listener.accept(),second=await capacity.listener.accept();
await assert.rejects(capacity.listener.accept(),e=>e===-3);controls++;
await assert.rejects(capacity.listener.release(),e=>e===-4);controls++;
await first.release();await second.release();await capacity.listener.release();
for(const {socket} of clients) socket.destroy();
clearTimeout(watchdog);
console.log(JSON.stringify({accepted:true,paired_connections:cases.length,lib_calls_per_engine:17,rejected_frames_per_engine:2,lib_instances_per_engine:1,listener_controls:controls,resource_cleanup:true,guest_bind_authority:false,resident_app_qualified:false,lib_sha256:digest}));
