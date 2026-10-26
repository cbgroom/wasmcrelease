import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {LibDefinedBoundary} from '../../../host/runtime/lib-boundary/reference.mjs';
const own=path.resolve('.agents/workstreams/WS-20261026-lib-memory-release-v031'),boundary=new LibDefinedBoundary(),checks=[];
const file=await boundary.install(path.join(own,'candidate-roots/wasmc-system-file-prototype/0.1.0'));
const network=await boundary.install(path.join(own,'candidate-roots/wasmc-system-network-prototype/0.1.0'));
const temp=await mkdtemp(path.join(os.tmpdir(),'wasmc-memory-node-'));let server;
const invoke=async(resource,input,expected='completed')=>{
 const window=boundary.acquireWindow(input),operation=boundary.submit(resource,window),watchdog=setTimeout(()=>boundary.cancel(operation),15000);
 try {const [ready]=await boundary.wait([operation]);assert.equal(ready.state,expected);return boundary.claim(operation);}
 finally {clearTimeout(watchdog);boundary.releaseOperation(operation);boundary.releaseWindow(window);}
};
const check=async(name,fn)=>{await fn();checks.push(name);console.log(JSON.stringify({accepted:true,check:name}));};
const hash=b=>createHash('sha256').update(b).digest('hex');
try {
 const target=path.join(temp,'input.bin'),first=Buffer.alloc(3*1024*1024,0x41),second=Buffer.alloc(7*1024*1024,0x42);
 await writeFile(target,first);
 await check('file3MiB and new7MiB on same installed resource',async()=>{
  let reply=await invoke(file,Buffer.from(target));assert(Buffer.from(reply.bytes).equals(first));
  await writeFile(target,second);reply=await invoke(file,Buffer.from(target));assert(Buffer.from(reply.bytes).equals(second));
 });
 await check('file missing and overlong path report real OS errors and recover',async()=>{
  const missing=await invoke(file,Buffer.from(path.join(temp,'missing')),'failed');assert.match(missing.error,/ENOENT/);
  const long=await invoke(file,Buffer.from('x'.repeat(5000)),'failed');assert.match(long.error,/ENAMETOOLONG/);
  assert(Buffer.from((await invoke(file,Buffer.from(target))).bytes).equals(second));
 });
 const received=[];
 server=createServer({allowHalfOpen:true},socket=>{
  const chunks=[];socket.on('data',chunk=>chunks.push(chunk));socket.on('end',()=>{const request=Buffer.concat(chunks);received.push({bytes:request.length,sha256:hash(request)});socket.end(request[0]===0x78?request:Buffer.alloc(5*1024*1024,0x7a));});
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const port=server.address().port,host=Buffer.from('127.0.0.1');
 const encode=payload=>{const head=Buffer.alloc(4+host.length+2);head.writeUInt32LE(host.length,0);host.copy(head,4);head.writeUInt16LE(port,4+host.length);return Buffer.concat([head,payload]);};
 await check('loopback2MiB input/echo and new5MiB output on same installed resource',async()=>{
  const payload=Buffer.alloc(2*1024*1024,0x78),reply=await invoke(network,encode(payload));assert(Buffer.from(reply.bytes).equals(payload));
  const next=Buffer.from([0x79]),again=await invoke(network,encode(next));assert(Buffer.from(again.bytes).equals(Buffer.alloc(5*1024*1024,0x7a)));
  assert.deepEqual(received,[{bytes:payload.length,sha256:hash(payload)},{bytes:1,sha256:hash(next)}]);
 });
 boundary.releaseResource(file);boundary.releaseResource(network);assert.deepEqual(boundary.counts(),{resources:0,windows:0,operations:0});
 const roots=[];for(const id of ['wasmc-system-file-prototype','wasmc-system-network-prototype']){
  const root=path.join(own,'candidate-roots',id,'0.1.0');roots.push({id,manifest_sha256:hash(await readFile(path.join(root,'lib.json')))});
 }
 await writeFile(process.argv[2],JSON.stringify({accepted:true,checks,platform:process.platform,arch:process.arch,node:process.version,roots,host_executor_sha256:hash(await readFile('host/runtime/lib-boundary/reference.mjs')),same_installed_resources_new_inputs:true,observed_network_exchanges:received.length,final_counts:boundary.counts(),wasm:false,current_catalog:false,formal_release:false},null,2)+'\n');
} finally {if(server)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await rm(temp,{recursive:true,force:true});}
