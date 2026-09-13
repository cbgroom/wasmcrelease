import {createServer,createConnection} from 'node:net';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {PreauthorizedTcpListener} from './listener.mjs';
import {createResidentApp} from './resident-app.mjs';
import {compile} from '../../current/wasmc.mjs';
const watchdog=setTimeout(()=>{console.error('TCP listener conformance timeout');process.exit(1);},30000);
const jsOnly=process.argv.includes('--js-only'),diagnose=process.argv.includes('--diagnose');
const libPath='libs/wasmc-owned-algorithms/artifact.wasm',libBytes=await readFile(libPath);
const digest=createHash('sha256').update(libBytes).digest('hex');
assert.equal(digest,'44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
const appBytes=await compile(await readFile('host/lib-e2e/guest.wasmc','utf8'));
const appDigest=createHash('sha256').update(appBytes).digest('hex');
assert.equal(appDigest,'4eff84eccf06251a0b5de89e81d4faaeb5f51bce18724d8f011b95ea0ab7fd19');
await mkdir('target/host-tcp-app',{recursive:true});const appPath='target/host-tcp-app/guest.wasm';await writeFile(appPath,appBytes);
const cases=[];
for(let repeat=0;repeat<4;repeat++) for(const bytes of [[],[7],[1,2,3,255],Array.from({length:16},(_,i)=>i)]) cases.push(bytes);
// Bad input followed by valid input proves service survival, not just process exit.
cases.splice(5,0,'oversized');cases.splice(11,0,'truncated');cases.push([9]);
async function listen() {
  const server=createServer({allowHalfOpen:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,listener:new PreauthorizedTcpListener(server),port:server.address().port};
}
async function client(port,input,lane='js') {
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
  assert.deepEqual(output,expected,`${lane} frame ${JSON.stringify(input)} response mismatch`);
}
async function jsService(listener) {
  const app=await createResidentApp(libBytes,appBytes);let calls=0,rejected=0;
  try {
    for(let i=0;i<cases.length;i++) {
      const tcp=await listener.accept();
      const read=async n=>{
        const timer=setTimeout(()=>tcp.terminateRead(),500);
        try {return await tcp.read(n);} finally {clearTimeout(timer);}
      };
      try {
        const header=await read(1);if(diagnose)console.error(JSON.stringify({diagnostic:'js_header',index:i,header}));if(header.length!==1||header[0]>16) throw -5;
        const input=[];
        while(input.length<header[0]) {const chunk=await read(header[0]-input.length);if(!chunk.length) throw -8;input.push(...chunk);}
        if(diagnose)console.error(JSON.stringify({diagnostic:'js_frame',index:i,expected:cases[i],received:input}));
        const value=app.call(input);calls++;
        const output=Buffer.alloc(8);output.writeBigInt64LE(value);await tcp.write([...output]);
      } catch(error) {if(diagnose)console.error(JSON.stringify({diagnostic:'js_rejection',index:i,error:String(error)}));rejected++;}
      finally {await tcp.release();}
    }
  } finally {app.release();await listener.release();}
  assert.equal(app.libCalls(),calls);
  return {accepted:true,calls,rejected,lib_instances:1,app_instances:1,listener_retired:true};
}
const local=await listen(),service=jsService(local.listener);
for(const input of cases) await client(local.port,input);
const js=await service;
assert.deepEqual(js,{accepted:true,calls:17,rejected:2,lib_instances:1,app_instances:1,listener_retired:true});
assert.equal(local.listener.counts().active,0);await assert.rejects(local.listener.accept(),e=>e===-1);
const engineArgs=process.argv.includes('--wasmtime')?['--wasmtime']:[];
if(!jsOnly) {
const native=spawn(process.argv[2],[libPath,String(cases.length),appPath,...engineArgs],{env:{},stdio:['ignore','pipe','pipe']});
let out='',err='',ready;
const start=new Promise(resolve=>{ready=resolve;});native.stdout.on('data',b=>{out+=b;if(out.includes('\n')) ready(JSON.parse(out.split('\n')[0]).port);});
native.stderr.on('data',b=>{err+=b;console.error(String(b));});
const exit=new Promise((resolve,reject)=>{native.on('error',reject);native.on('close',code=>{ready(-1);resolve(code);});});
const port=await start;assert.ok(port>0,err);
for(const input of cases) await client(port,input,'native');
assert.equal(await exit,0,err);assert.deepEqual(JSON.parse(out.trim().split('\n')[1]),js);
}
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
const resident=await createResidentApp(libBytes,appBytes);
for(let i=0;i<1000;i++) assert.equal(resident.call([7,i%256]),BigInt(7+i%256));
assert.equal(resident.libCalls(),1000);
assert.throws(()=>resident.call(Array(17).fill(1)),e=>e===-5);assert.equal(resident.libCalls(),1000);
assert.throws(()=>resident.call([7],1),e=>e instanceof WebAssembly.RuntimeError);assert.equal(resident.libCalls(),1001);
assert.throws(()=>resident.call([7]),e=>e===-8);assert.equal(resident.libCalls(),1001);resident.release();
if(!jsOnly) {
const smoke=spawn(process.argv[3],[libPath,appPath,...engineArgs],{env:{},stdio:['ignore','pipe','pipe']});
let receipt='',smokeError='';smoke.stdout.on('data',b=>receipt+=b);smoke.stderr.on('data',b=>smokeError+=b);
assert.equal(await new Promise((resolve,reject)=>{smoke.on('error',reject);smoke.on('close',resolve);}),0,smokeError);
assert.deepEqual(JSON.parse(receipt),{accepted:true,resident_calls:1000,trap_poisoned:true,post_trap_no_replay:true,budget_no_lib_call:true});
}
clearTimeout(watchdog);
console.log(JSON.stringify({accepted:true,js_only:jsOnly,native_engine:jsOnly?null:engineArgs.length?'wasmtime':'wasmi',paired_connections:jsOnly?0:cases.length,local_connections:cases.length,lib_calls_per_engine:17,rejected_frames_per_engine:2,lib_instances_per_engine:1,app_instances_per_engine:1,resident_calls_per_engine:1000,trap_poisoned:true,post_trap_no_replay:true,listener_controls:controls,resource_cleanup:true,guest_bind_authority:false,lib_sha256:digest,app_sha256:appDigest}));
