import assert from 'node:assert/strict';
import {createServer,createConnection} from 'node:net';
import {createSocket} from 'node:dgram';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compile} from '../../current/wasmc.mjs';
import {PreauthorizedTcpListener} from '../tcp/listener.mjs';
import {PreauthorizedDatagram} from '../udp/adapter.mjs';
import {HostSession} from './session.mjs';
import {driveScalarTask} from '../scenarios/scalar-task-driver.mjs';
const watchdog=setTimeout(()=>{console.error('shared network session watchdog');process.exit(1);},30000);
assert(process.argv.length<=3,'only an optional trusted Native peer binary is accepted');
const nativePeer=process.argv[2];
function independentPeer(port,bytes){
  const child=spawn(nativePeer,[String(port),bytes.join(',')],{env:{},stdio:['ignore','pipe','pipe']});
  let output='',error='';child.stdout.on('data',bytes=>output+=bytes);child.stderr.on('data',bytes=>error+=bytes);
  return new Promise((resolve,reject)=>{
    child.once('error',reject);child.once('close',status=>{
      if(status!==0)return reject(Error(error||'Native peer failed'));
      try{const receipt=JSON.parse(output);assert.equal(receipt.accepted,true);resolve(Buffer.from(receipt.response));}catch(error){reject(error);}
    });
  });
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const appBytes=await compile(await readFile('host/session/network-app.wasmc','utf8'));
const module=new WebAssembly.Module(appBytes);
assert.deepEqual(WebAssembly.Module.imports(module),[]);
assert.equal(sha(new Uint8Array(WebAssembly.Module.customSections(module,'wasmc-async-effects')[0])),
  '387c79355dcc1da4d756b49b3e3b40d3d4b1f6ba5f289160c1c1a1bfeb1d5b0b');
const libBytes=await readFile('libs/wasmc-owned-algorithms/artifact.wasm');
assert.equal(sha(libBytes),'44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
const {instance:app}=await WebAssembly.instantiate(appBytes,{});
const {instance:lib}=await WebAssembly.instantiate(libBytes,{});
const ptr=lib.exports.cabi_realloc(0,0,4,64);
let libCalls=0,tcpPositive=0,udpPositive=0,networkNegative=0;
async function serve(backend,kind,{timeout=false}={}) {
  const session=new HostSession([{name:'peer',backend,kind,read:true,write:true}]);
  const root=session.root,endpoint=session.open(root,'peer',{write:true});
  const input=session.window_acquire(16),output=session.window_acquire(8);
  const windows=new Set([input,output]),endpoints=new Set([endpoint]),ops=new Set();
  const before=libCalls; let data=[];
  const result=async operation=>{
    ops.add(operation);
    const receipts=await session.wait([operation],{timeoutMs:timeout?5:1000});
    if(!receipts.length){
      // Wait timeout leaves actual operation and pins untouched.
      assert.equal(session.counts().operations,1);
      assert.throws(()=>session.copy_out(input),/busy/);
      await assert.rejects(session.release(endpoint),/busy/);
      session.cancel(operation);
      const drained=await session.wait([operation],{timeoutMs:1000});
      assert.equal(drained.length,1);assert.equal(drained[0].result.status,'cancelled');
      await session.release(operation);ops.delete(operation);throw Error('wait-timeout-drained');
    }
    assert.equal(receipts[0].operation,operation);
    const value=receipts[0].result;await session.release(operation);ops.delete(operation);
    if(value.status!=='ok')throw Error(value.status);return value;
  };
  try {
    return await driveScalarTask(app.exports.run,16,[
      async limit=>{
        if(kind==='datagram'){
          await result(session.read(endpoint,input,{length:limit}));data=session.copy_out(input);
        }else{
          // Bounded read-to-EOF transport fixture, not a general HTTP parser.
          for(let reads=0;reads<=17;reads++){
            const receipt=await result(session.read(endpoint,input,{length:Math.max(1,limit-data.length)}));
            const chunk=session.copy_out(input);
            if(receipt.eof)break;
            if(data.length+chunk.length>limit)throw Error('bounds');
            data.push(...chunk);
            if(reads===17)throw Error('read-limit');
          }
        }
        return data.length;
      },
      async length=>{
        assert.equal(length,data.length);libCalls++;
        const view=new DataView(lib.exports.memory.buffer);
        data.forEach((byte,index)=>view.setInt32(ptr+4*index,byte,true));
        return Number(lib.exports['sum-s32'](ptr,length));
      },
      async value=>{
        const bytes=new Uint8Array(8);new DataView(bytes.buffer).setBigInt64(0,BigInt(value),true);
        session.window_commit(output,[...bytes],8);
        return (await result(session.write(endpoint,output))).transferred;
      },
      async count=>{
        assert.equal(count,8);
        await session.release(endpoint);endpoints.delete(endpoint);
        for(const window of windows){await session.release(window);windows.delete(window);}return count;
      },
    ]);
  }catch(error){assert.equal(libCalls,before);throw error;}
  finally{
    for(const op of ops){await session.wait([op]);await session.release(op);}
    for(const window of windows)await session.release(window);
    for(const endpoint of endpoints)await session.release(endpoint);
    await session.release(root);
    assert.deepEqual(session.counts(),{endpoints:0,unopened_grants:0,windows:0,operations:0,waiters:0,window_bytes:0});
  }
}
const inputs=[[],[7],[1,2,3,255],Array.from({length:16},(_,i)=>i)];
const server=createServer({allowHalfOpen:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const listener=new PreauthorizedTcpListener(server);
try {
  for(let repeat=0;repeat<3;repeat++)for(const bytes of inputs){
    const pending=listener.accept();
    pending.catch(()=>{}); // Cleanup may cancel accept if trusted peer startup fails.
    let closed,socket;
    if(nativePeer)closed=independentPeer(server.address().port,bytes);
    else{
      socket=createConnection({host:'127.0.0.1',port:server.address().port,allowHalfOpen:true});socket.on('error',()=>{});
      const chunks=[];closed=new Promise(resolve=>socket.once('close',()=>resolve(Buffer.concat(chunks))));
      socket.on('data',bytes=>chunks.push(bytes));
    }
    const service=serve(await pending,'stream');socket?.end(Uint8Array.from(bytes));
    assert.equal(await service,8);
    const expected=Buffer.alloc(8);expected.writeBigInt64LE(BigInt(bytes.reduce((a,b)=>a+b,0)));
    assert.deepEqual(await closed,expected);tcpPositive++;
  }
  const pending=listener.accept();
  const socket=createConnection({host:'127.0.0.1',port:server.address().port});socket.on('error',()=>{});
  let delivered=0;socket.on('data',bytes=>delivered+=bytes.length);
  const closed=new Promise(resolve=>socket.once('close',resolve));
  await assert.rejects(serve(await pending,'stream',{timeout:true}),/wait-timeout-drained/);
  await closed;assert.equal(delivered,0);networkNegative++;
  assert.equal(listener.counts().active,0);
}finally{await listener.release();}
const bound=async()=>{const socket=createSocket('udp4');await new Promise(resolve=>socket.bind(0,'127.0.0.1',resolve));return socket;};
const close=socket=>new Promise(resolve=>socket.close(resolve));
try{
  for(const bytes of [...inputs,Array(17).fill(1)]){
    const client=await bound(),server=await bound();let replies=0;
    client.on('message',()=>replies++);
    const endpoint=new PreauthorizedDatagram(server,{address:'127.0.0.1',port:client.address().port});
    const task=serve(endpoint,'datagram');
    const expected=Buffer.alloc(8);expected.writeBigInt64LE(BigInt(bytes.reduce((a,b)=>a+b,0)));
    const reply=bytes.length<=16?new Promise(resolve=>client.once('message',resolve)):null;
    const rejected=bytes.length>16?assert.rejects(task,/bounds/):null;
    try{
      await new Promise((resolve,reject)=>client.send(Uint8Array.from(bytes),server.address().port,'127.0.0.1',error=>error?reject(error):resolve()));
      if(rejected){await rejected;assert.equal(replies,0);networkNegative++;}
      else{assert.equal(await task,8);assert.deepEqual(await reply,expected);udpPositive++;}
    }finally{await close(client);}
  }
}finally{
  new Uint8Array(lib.exports.memory.buffer,ptr,64).fill(0);lib.exports.cabi_realloc(ptr,64,4,0);clearTimeout(watchdog);
}
console.log(JSON.stringify({accepted:true,scope:'shared-js-session-guest-network-e2e',tcpPositive,udpPositive,networkNegative,
  libCalls,resident_app_instances:1,resident_lib_instances:1,actual_tcp_close_ack:true,
  tcp_peer_profile:nativePeer?'independent-native':'same-js-runtime',
  wait_timeout_retains_pins:true,cancelled_response_bytes:0,resource_counts_zero:true,
  uniform_core_abi_accepted:false,native_session_parity:false,session_sha256:sha(await readFile('host/session/session.mjs'))}));
