import {createServer,createConnection} from 'node:net';
import assert from 'node:assert/strict';
import {PreauthorizedTcpListener} from './listener.mjs';
import {spawn} from 'node:child_process';
const watchdog=setTimeout(()=>{console.error('half-close probe timeout');process.exit(1);},5000);
const server=createServer({allowHalfOpen:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const listener=new PreauthorizedTcpListener(server),accepted=listener.accept();
const characterize=process.argv.includes('--characterize-js-peer');
const nativePeer=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
const client=nativePeer?null:createConnection({host:'127.0.0.1',port:server.address().port,allowHalfOpen:true});client?.on('error',()=>{});
let closed;
if(nativePeer) {
  const child=spawn(nativePeer,[String(server.address().port)],{env:{},stdio:['ignore','pipe','pipe']});
  let output='',error='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);
  closed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',status=>{
    if(status!==0)return reject(Error(error||'Native peer failed'));
    try{assert.deepEqual(JSON.parse(output),{accepted:true,peer_response:[24]});resolve(Buffer.from([24]));}catch(e){reject(e);}
  });});
  closed.catch(()=>{});
}
let tcp;
try {
  if(client) {
    await new Promise((resolve,reject)=>{client.once('connect',resolve);client.once('error',reject);});
    const chunks=[];closed=new Promise(resolve=>client.once('close',()=>resolve(Buffer.concat(chunks))));
    client.on('data',chunk=>chunks.push(chunk));
    client.end(Uint8Array.of(7,8,9));
  }
  tcp=await accepted;
  assert.deepEqual(await tcp.read(3),[7,8,9]);
  assert.deepEqual(await tcp.read(1),[]);
  assert.equal(await tcp.write([24]),1);
  await tcp.release();tcp=null;
  const response=await closed,supported=response.equals(Buffer.from([24]));
  if(!characterize||nativePeer)assert.equal(supported,true,'peer response lost after half-close');
  else assert.ok(supported||response.length===0,'unclassified peer corruption');
  console.log(JSON.stringify({probe_completed:true,accepted:supported,native_peer:!!nativePeer,profile_supported:supported,peer_half_close_before_response:supported,read_eof_preserves_write:true,peer_response_bytes:response.length,resource_cleanup:true,characterization_only:characterize&&!nativePeer}));
} finally {
  if(tcp)await tcp.release();client?.destroy();
  await listener.release();clearTimeout(watchdog);
}
