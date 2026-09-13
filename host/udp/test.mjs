import assert from 'node:assert/strict';
import {createSocket} from 'node:dgram';
import {readFile} from 'node:fs/promises';
import {compile} from '../../current/wasmc.mjs';
import {createResidentApp} from '../tcp/resident-app.mjs';
import {PreauthorizedDatagram} from './adapter.mjs';
const watchdog=setTimeout(()=>{console.error('UDP conformance timeout');process.exit(1);},5000);
async function bound(){const socket=createSocket('udp4');socket.on('error',()=>{});await new Promise(resolve=>socket.bind(0,'127.0.0.1',resolve));return socket;}
async function send(socket,port,data){await new Promise((resolve,reject)=>socket.send(Uint8Array.from(data),port,'127.0.0.1',error=>error?reject(error):resolve()));}
async function close(socket){await new Promise(resolve=>socket.close(resolve));}
const client=await bound(),foreign=await bound(),server=await bound();
const endpoint=new PreauthorizedDatagram(server,{address:'127.0.0.1',port:client.address().port});
const app=await createResidentApp(await readFile('libs/wasmc-owned-algorithms/artifact.wasm'),await compile(await readFile('host/lib-e2e/guest.wasmc','utf8')));
let calls=0,rejected=0,foreignReplies=0;
foreign.on('message',()=>{foreignReplies++;});
try {
  for(const [socket,data,error] of [[client,[],0],[client,[7],0],[client,[1,2,3,255],0],[client,Array.from({length:16},(_,i)=>i),0],[client,Array(17).fill(1),-5],[client,Array(64).fill(1),-5],[foreign,[1],-2],[client,[9],0]]) {
    const pending=endpoint.read();
    const denied=error?assert.rejects(pending,e=>e===error):null;
    await send(socket,server.address().port,data);
    if(error){await denied;rejected++;continue;}
    const bytes=await pending;assert.deepEqual(bytes,data);
    const value=app.call(bytes);assert.equal(value,BigInt(data.reduce((a,b)=>a+b,0)));calls++;
    const reply=new Promise(resolve=>client.once('message',resolve));
    const encoded=Buffer.alloc(8);encoded.writeBigInt64LE(value);
    assert.equal(await endpoint.write([...encoded]),8);assert.deepEqual(await reply,encoded);
  }
  assert.equal(app.libCalls(),5);assert.equal(foreignReplies,0);
  await endpoint.release();await assert.rejects(endpoint.read(),e=>e===-1);
  await assert.rejects(endpoint.write([1]),e=>e===-1);
  console.log(JSON.stringify({accepted:true,real_loopback_udp:true,calls,rejected,foreign_replies:foreignReplies,message_boundaries_preserved:true,oversized_not_truncated:true,lib_instances:1,app_instances:1,resource_cleanup:true,guest_address_authority:false,udp_authentication:false,native_parity:false}));
}finally{app.release();await close(client);await close(foreign);clearTimeout(watchdog);}
