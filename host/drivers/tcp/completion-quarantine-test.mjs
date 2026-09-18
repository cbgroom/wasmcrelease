import assert from 'node:assert/strict';
import {TcpOwnerSupervisor} from './supervisor.mjs';
import {TcpStopFailure} from './stop-fence.mjs';
import {PreconnectedTcp} from './adapter.mjs';
import {createServer,createConnection} from 'node:net';
let controls=0;
for(const bytes of [Array(17).fill(1),Array(1),[256],[-1],[0.5],null]) {
  const supervisor=new TcpOwnerSupervisor(1);let reads=0,stops=0,closes=0,allow=false;
  const endpoint={async read(){reads++;return bytes;},async terminateRead(){stops++;if(!allow)throw -8;},async release(){closes++;}};
  const failure=await supervisor.read(endpoint).catch(e=>e);
  assert.ok(failure instanceof TcpStopFailure);assert.equal(failure.primary,-5);
  assert.equal(failure.reason,'malformed-completion');assert.equal(reads,1);assert.equal(closes,0);
  assert.deepEqual(supervisor.status(),{active:0,quarantined:1,limit:1});
  assert.deepEqual(failure.owner.guard.counts(),[1,1]);assert.equal(failure.owner.guard.poll(failure.owner.operation).drained,false);
  assert.throws(()=>failure.owner.guard.acquire(1),e=>e===-2);
  await assert.rejects(supervisor.read(endpoint),e=>e===-4);
  await assert.rejects(supervisor.read({}),e=>e===-3);
  await assert.rejects(supervisor.retireQuarantine(failure.quarantineTicket),e=>e===-8);
  assert.deepEqual(failure.owner.guard.counts(),[1,1]);assert.equal(closes,0);
  allow=true;await supervisor.retireQuarantine(failure.quarantineTicket);
  assert.equal(reads,1);assert.equal(stops,2);assert.equal(closes,1);
  assert.deepEqual(failure.owner.guard.counts(),[0,0]);assert.equal(supervisor.status().quarantined,0);
  await assert.rejects(supervisor.retireQuarantine(failure.quarantineTicket),e=>e===-1);controls++;
}
let realCases=0;
if(process.argv.includes('--real-tcp')) {
  const watchdog=setTimeout(()=>{console.error('completion quarantine timeout');process.exit(1);},5000);
  let peer,closed,received=0;
  const server=createServer(socket=>{peer=socket;closed=new Promise(resolve=>socket.once('close',resolve));socket.on('error',()=>{});socket.on('data',bytes=>{received+=bytes.length;});socket.write(Uint8Array.of(7));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const socket=createConnection({host:'127.0.0.1',port:server.address().port});socket.on('error',()=>{});
  try {
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
    const tcp=new PreconnectedTcp(socket,false),supervisor=new TcpOwnerSupervisor(1);let reads=0,stops=0;
    const input={async read(n){reads++;assert.deepEqual(await tcp.read(n),[7]);return Array(17).fill(7);},terminateRead(){if(++stops===1)throw -8;return tcp.terminateRead();},release:()=>tcp.release()};
    const failure=await supervisor.read(input).catch(e=>e);assert.ok(failure instanceof TcpStopFailure);
    assert.equal(failure.reason,'malformed-completion');assert.equal(socket.closed,false);
    await assert.rejects(supervisor.retireQuarantine(failure.quarantineTicket),e=>e===-8);
    assert.deepEqual(failure.owner.guard.counts(),[1,1]);
    await supervisor.retireQuarantine(failure.quarantineTicket);await closed;
    assert.equal(socket.closed,true);assert.equal(reads,1);assert.equal(stops,2);assert.equal(received,0);
    assert.deepEqual(failure.owner.guard.counts(),[0,0]);assert.equal(supervisor.status().quarantined,0);realCases++;
  } finally {socket.destroy();peer?.destroy();await new Promise(resolve=>server.close(resolve));clearTimeout(watchdog);}
}
console.log(JSON.stringify({accepted:true,completion_quarantine_controls:controls,real_tcp_completion_cases:realCases,malformed_no_delivery:true,owner_retained:true,explicit_close_ack_before_drain:true,no_io_replay:true,native_async_qualified:false}));
