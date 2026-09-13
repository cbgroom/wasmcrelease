// Real TCP half-close probe, not Core ABI or native engine acceptance.
import assert from 'node:assert/strict';
import {createServer,createConnection} from 'node:net';
import {spawn} from 'node:child_process';
import {PreauthorizedTcpListener} from '../tcp/listener.mjs';
import {HostSession} from './session.mjs';
const watchdog=setTimeout(()=>{console.error('finish-write watchdog');process.exit(1);},5000);
const server=createServer({allowHalfOpen:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const listener=new PreauthorizedTcpListener(server);
const session=new HostSession([{name:'listener',kind:'listener',backend:listener,read:true,write:true}]);
const root=session.root,parent=session.open(root,'listener',{write:true});
let client,endpoint,window;
assert(process.argv.length<=3);const unsupported=process.argv[2]==='--expect-unsupported';
const nativePeer=unsupported?null:process.argv[2];let native;
assert.equal(unsupported,typeof globalThis.Bun!=='undefined','exact Bun profile must report unsupported');
const ops=new Set();
const result=async op=>{
  ops.add(op);const ready=await session.wait([op]);assert.equal(ready[0].operation,op);
  try{return session.take_result(op);}finally{await session.release(op);ops.delete(op);}
};
try {
  const accepting=session.invoke(parent,'accept');
  let peerDone,ended,chunks=[];
  if(nativePeer){
    native=spawn(nativePeer,[String(server.address().port),'--after-fin'],{env:{},stdio:['ignore','pipe','pipe']});
    let output='',error='';native.stdout.on('data',bytes=>output+=bytes);native.stderr.on('data',bytes=>error+=bytes);
    peerDone=new Promise((resolve,reject)=>{native.once('error',reject);native.once('close',code=>{
      if(code!==0)return reject(Error(error||'peer failed'));
      try{assert.deepEqual(JSON.parse(output),{accepted:true,after_fin_write:true});resolve();}catch(error){reject(error);}
    });});peerDone.catch(()=>{});
  }else{
  client=createConnection({host:'127.0.0.1',port:server.address().port,allowHalfOpen:true});
  client.on('error',()=>{});
  client.on('data',bytes=>chunks.push(bytes));
  ended=new Promise(resolve=>client.once('end',resolve));
  }
  endpoint=(await result(accepting)).endpoint;window=session.window_acquire(1);
  session.window_commit(window,[7],1);
  assert.equal((await result(session.write(endpoint,window))).transferred,1);
  if(unsupported){
    await assert.rejects(result(session.invoke(endpoint,'finish-write')),/unsupported/);
    // Denial must precede any FIN/close: ordinary peer-to-service I/O still works.
    const reading=session.read(endpoint,window,{length:1});
    await new Promise((resolve,reject)=>client.write(Uint8Array.of(3),error=>error?reject(error):resolve()));
    assert.equal((await result(reading)).transferred,1);assert.deepEqual(session.copy_out(window),[3]);
  }else{
  assert.equal((await result(session.invoke(endpoint,'finish-write'))).writeFinished,true);
  if(client){await ended;assert.deepEqual(Buffer.concat(chunks),Buffer.from([7]));}
  // Peer has observed FIN but can still send. A full-close implementation fails.
  const reading=session.read(endpoint,window,{length:1});
  if(client)await new Promise((resolve,reject)=>client.write(Uint8Array.of(3),error=>error?reject(error):resolve()));
  assert.equal((await result(reading)).transferred,1);assert.deepEqual(session.copy_out(window),[3]);
  await assert.rejects(result(session.invoke(endpoint,'finish-write')),/invalid-resource/);
  session.window_commit(window,[3],1);
  await assert.rejects(result(session.write(endpoint,window)),/invalid-resource/);
  if(peerDone)await peerDone;
  }
} finally {
  for(const op of ops){await session.wait([op]);await session.release(op);}
  if(window)await session.release(window);
  if(endpoint)await session.release(endpoint);
  if(client){const closed=client.closed?Promise.resolve():new Promise(resolve=>client.once('close',resolve));client.destroy();await closed;}
  if(native&&native.exitCode===null){const closed=new Promise(resolve=>native.once('close',resolve));native.kill();await closed;}
  await session.release(parent);await session.release(root);clearTimeout(watchdog);
  assert.deepEqual(session.counts(),{endpoints:0,unopened_grants:0,windows:0,operations:0,waiters:0,window_bytes:0});
}
console.log(JSON.stringify({accepted:!unsupported,negative_contract_pass:unsupported,
  scope:'actual-tcp-finish-write',peer_observed_fin:!unsupported,
  read_after_local_fin:!unsupported,repeated_finish_and_write_denied:!unsupported,resource_counts_zero:true,
  tcp_peer_profile:nativePeer?'independent-native':'same-js-runtime',
  uniform_core_abi_accepted:false,native_session_parity:false}));
