import {createServer,createConnection} from 'node:net';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {PreconnectedTcp} from './adapter.mjs';
import {ScopedCompletionGuard} from '../completion/scoped-guard.mjs';
import {writeTcpWindow} from './write-window.mjs';
const watchdog=setTimeout(()=>{console.error('TCP write outcome timeout');process.exit(1);},30000);
const expected={state:'cancelled',effect:'possibly_partial',acknowledged:4};
for(const native of [false,true]) {
  let observed,peer;const received=new Promise(resolve=>{observed=resolve;});
  const server=createServer(socket=>{
    peer=socket;const chunks=[];socket.on('error',()=>{});
    socket.on('data',bytes=>{chunks.push(bytes);const all=Buffer.concat(chunks);if(all.length>=4) {observed(all);if(native) socket.write(Uint8Array.of(42));}});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
  try {
    if(native) {
      const child=spawn(process.argv[2],[`127.0.0.1:${port}`],{env:{},stdio:['ignore','pipe','pipe']});let out='',err='';
      child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
      assert.equal(await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);}),0,err);
      assert.deepEqual(JSON.parse(out),expected);
    } else {
      const socket=createConnection({host:'127.0.0.1',port});await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
      const tcp=new PreconnectedTcp(socket),guard=ScopedCompletionGuard.fresh(),abort=new AbortController();
      const endpoint={write:async bytes=>{
        const count=await tcp.write(bytes);await received;
        abort.abort();assert.deepEqual(guard.counts(),[1,1]);
        await new Promise(resolve=>setTimeout(resolve,10));return count;
      },terminateRead:()=>tcp.terminateRead(),release:()=>tcp.release()};
      assert.deepEqual(await writeTcpWindow(endpoint,guard,[1,2,3,4],{signal:abort.signal}),expected);
      assert.deepEqual(guard.counts(),[0,0]);
    }
    assert.deepEqual([...await received],[1,2,3,4]);
  } finally {peer?.destroy();await new Promise(resolve=>server.close(resolve));}
}
let controls=0;
for(const [write,outcome] of [[async()=>4,{state:'done',effect:'accepted_locally',acknowledged:4}],[async()=>{throw -9;},{state:'failed',effect:'possibly_partial',acknowledged:null,error:-9}],[async()=>2,{state:'failed',effect:'possibly_partial',acknowledged:2,error:-9}]]) {
  const guard=ScopedCompletionGuard.fresh();assert.deepEqual(await writeTcpWindow({write,release:async()=>{}},guard,[1,2,3,4]),outcome);assert.deepEqual(guard.counts(),[0,0]);controls++;
}
const abort=new AbortController();abort.abort();const guard=ScopedCompletionGuard.fresh();
assert.deepEqual(await writeTcpWindow({write:()=>assert.fail('pre-abort write'),terminateRead:async()=>{},release:async()=>{}},guard,[1],{signal:abort.signal}),{state:'cancelled',effect:'none',acknowledged:0});assert.deepEqual(guard.counts(),[0,0]);controls++;
let finish,closed;const g=ScopedCompletionGuard.fresh(),source=[1,2,3,4];
const result=writeTcpWindow({write:bytes=>{assert.deepEqual(bytes,source);return new Promise(resolve=>{finish=resolve;});},terminateRead:async()=>{},release:async()=>{closed=true;}},g,source,{deadlineMs:10});
source[0]=9;await new Promise(resolve=>setTimeout(resolve,20));assert.deepEqual(g.counts(),[1,1]);assert.ok(!closed);finish(4);
assert.deepEqual(await result,expected);assert.deepEqual(g.counts(),[0,0]);controls++;
clearTimeout(watchdog);
console.log(JSON.stringify({accepted:true,real_peer_observed_cancelled_effect:true,js_native_outcomes_equal:true,additional_controls:controls,no_replay:true,resource_cleanup:true,blocked_write_preemption_qualified:false}));
