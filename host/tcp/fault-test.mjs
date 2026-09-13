import {createServer,createConnection} from 'node:net';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {PreconnectedTcp} from './adapter.mjs';
import {readTcpWindow} from './read-window.mjs';
import {ScopedCompletionGuard} from '../completion/scoped-guard.mjs';
const watchdog=setTimeout(()=>{console.error('TCP read-stop timeout');process.exit(1);},30000);
async function run(mode,native) {
  const peers=new Set();let outputBytes=0;
  const server=createServer(socket=>{
    peers.add(socket);socket.on('error',()=>{});socket.on('data',bytes=>outputBytes+=bytes.length);socket.on('close',()=>peers.delete(socket));
    if(mode==='success') socket.write(Uint8Array.of(7));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try {
    const expected=mode==='success'?0:mode==='revoke'?-2:-6;
    if(native) {
      const child=spawn(native,[`127.0.0.1:${port}`,mode],{env:{},stdio:['ignore','pipe','pipe']});
      let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
      const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
      assert.equal(exit,0,err);assert.deepEqual(JSON.parse(out),{status:expected,cleanup:true,duplicate_denied:true});
    } else {
      const socket=createConnection({host:'127.0.0.1',port});
      await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
      const input=new PreconnectedTcp(socket,false),guard=ScopedCompletionGuard.fresh(),controller=new AbortController();
      let timer;
      if(mode==='cancel'||mode==='revoke') timer=setTimeout(()=>controller.abort(),30);
      try {
        const pending=readTcpWindow(input,guard,{signal:controller.signal,deadlineMs:mode==='timeout'?40:2000,revokeOnAbort:mode==='revoke'});
        if(mode==='success') assert.deepEqual(await pending,[7]);
        else await assert.rejects(pending,e=>e===expected);
        assert.deepEqual(guard.counts(),[0,0]);
        assert.ok(socket.destroyed);assert.ok(socket.closed);
        await assert.rejects(input.read(1),e=>e===-1);
        if(mode==='revoke') assert.throws(()=>guard.acquire(1),e=>e===-2);
      } finally {clearTimeout(timer);}
    }
    assert.equal(outputBytes,0);
  } finally {
    for(const peer of peers) peer.destroy();
    await new Promise(resolve=>server.close(resolve));
  }
}
let cases=0;
for(const mode of ['success','cancel','revoke','timeout']) {
  await run(mode,null);await run(mode,process.argv[2]);cases++;
}
// Deliberately deferred backend: cancellation cannot unpin before acknowledgement.
let resolveRead,resolveClose,closeAck;
const closed=new Promise(resolve=>{resolveClose=resolve;}),g=ScopedCompletionGuard.fresh(),controller=new AbortController();
const input={read:()=>new Promise(resolve=>{resolveRead=resolve;}),terminateRead:()=>closed,release:async()=>{assert.ok(closeAck);}};
const pending=readTcpWindow(input,g,{signal:controller.signal});
controller.abort();assert.deepEqual(g.counts(),[1,1]);
resolveRead([9]);await Promise.resolve();assert.deepEqual(g.counts(),[1,1]);
closeAck=true;resolveClose();await assert.rejects(pending,e=>e===-6);assert.deepEqual(g.counts(),[0,0]);
let controls=1;
// Primary read error survives a later close failure; pin still drains.
const failed=ScopedCompletionGuard.fresh();
await assert.rejects(readTcpWindow({read:async()=>{throw -8;},release:async()=>{throw -9;}},failed),e=>e===-8);
assert.deepEqual(failed.counts(),[0,0]);controls++;
// Pre-aborted/revoked calls must not issue a read or allocate a window.
for(const revoked of [false,true]) {
  const guard=ScopedCompletionGuard.fresh(),abort=new AbortController();abort.abort();
  let terminated=false,released=false;
  await assert.rejects(readTcpWindow({read:()=>{assert.fail('read after prior abort');},terminateRead:async()=>{terminated=true;},release:async()=>{released=true;}},guard,{signal:abort.signal,revokeOnAbort:revoked}),e=>e===(revoked?-2:-6));
  assert.ok(terminated&&released);assert.deepEqual(guard.counts(),[0,0]);
  if(revoked) assert.throws(()=>guard.acquire(1),e=>e===-2);
  controls++;
}
for(const deadlineMs of [0,-1,5001,NaN,1.5]) {
  const guard=ScopedCompletionGuard.fresh();let released=false;
  await assert.rejects(readTcpWindow({read:()=>assert.fail('invalid deadline read'),release:async()=>{released=true;}},guard,{deadlineMs}),e=>e===-5);
  assert.ok(released);assert.deepEqual(guard.counts(),[0,0]);controls++;
}
clearTimeout(watchdog);
console.log(JSON.stringify({accepted:true,paired_cases:cases,additional_controls:controls,real_blocked_read_stop:true,deadline_no_delivery:true,revoked_no_delivery:true,late_bytes_no_delivery:true,pinned_until_close_ack:true,resource_cleanup:true,write_cancellation_qualified:false}));
