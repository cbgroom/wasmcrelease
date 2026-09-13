import assert from 'node:assert/strict';
import {TcpOwnerSupervisor} from './supervisor.mjs';
import {TcpStopFailure} from './stop-fence.mjs';
import {PreconnectedTcp} from './adapter.mjs';
import {createServer,createConnection} from 'node:net';
let controls=0;
for(const mode of ['read','invalid-policy','write','failed-write']) {
  const supervisor=new TcpOwnerSupervisor(1);let reads=0,writes=0,releases=0,stops=0;
  const endpoint={read:async()=>{reads++;return[7];},write:async()=>{writes++;if(mode==='failed-write')throw -9;return 1;},release:async()=>{if(++releases===1)throw -8;},terminateRead:async()=>{stops++;}};
  const failure=await (mode.includes('write')?supervisor.write(endpoint,[7]):supervisor.read(endpoint,mode==='invalid-policy'?{signal:0}:{})).catch(e=>e);
  assert.ok(failure instanceof TcpStopFailure);assert.equal(failure.cause,-8);
  assert.deepEqual(supervisor.status(),{active:0,quarantined:1,limit:1});
  assert.deepEqual(failure.owner.guard.counts(),mode==='invalid-policy'?[0,0]:[1,1]);
  if(failure.owner.operation!==undefined)assert.equal(failure.owner.guard.poll(failure.owner.operation).drained,true);
  if(mode==='invalid-policy')assert.equal(failure.primary,-5);
  if(mode==='read')assert.deepEqual(failure.primary,{state:'done',delivery:'suppressed_by_failed_retirement'});
  if(mode==='write')assert.deepEqual(failure.primary,{state:'done',effect:'accepted_locally',acknowledged:1});
  if(mode==='failed-write')assert.deepEqual(failure.primary,{state:'failed',effect:'possibly_partial',acknowledged:null,error:-9});
  assert.equal(stops,0);assert.equal(releases,1);
  await assert.rejects(supervisor.read({read:()=>assert.fail('quota read'),release:()=>assert.fail('quota close')}),e=>e===-3);
  const before=[reads,writes];await supervisor.retireQuarantine(failure.quarantineTicket);
  assert.deepEqual([reads,writes],before);assert.equal(stops,1);assert.equal(releases,2);
  assert.deepEqual(failure.owner.guard.counts(),[0,0]);assert.equal(supervisor.status().quarantined,0);
  await assert.rejects(supervisor.retireQuarantine(failure.quarantineTicket),e=>e===-1);controls++;
}
let realCases=0;
if(process.argv.includes('--real-tcp')) {
  const watchdog=setTimeout(()=>{console.error('driver retirement TCP timeout');process.exit(1);},5000);
  let peer,peerClosed;
  const server=createServer(socket=>{peer=socket;peerClosed=new Promise(resolve=>socket.once('close',resolve));socket.on('error',()=>{});socket.write(Uint8Array.of(7));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const socket=createConnection({host:'127.0.0.1',port:server.address().port});socket.on('error',()=>{});
  try {
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
    const tcp=new PreconnectedTcp(socket,false),supervisor=new TcpOwnerSupervisor(1);let reads=0,closes=0;
    const input={read(n){reads++;return tcp.read(n);},terminateRead:()=>tcp.terminateRead(),release(){if(++closes===1)throw -8;return tcp.release();}};
    const failure=await supervisor.read(input).catch(e=>e);
    assert.ok(failure instanceof TcpStopFailure);assert.equal(socket.closed,false);
    assert.deepEqual(failure.owner.guard.counts(),[1,1]);assert.equal(failure.owner.guard.poll(failure.owner.operation).drained,true);
    await supervisor.retireQuarantine(failure.quarantineTicket);await peerClosed;
    assert.equal(socket.closed,true);assert.equal(reads,1);assert.equal(closes,2);
    assert.deepEqual(failure.owner.guard.counts(),[0,0]);assert.equal(supervisor.status().quarantined,0);realCases++;
  } finally {socket.destroy();peer?.destroy();await new Promise(resolve=>server.close(resolve));clearTimeout(watchdog);}
}
console.log(JSON.stringify({accepted:true,driver_retirement_controls:controls,real_tcp_retirement_cases:realCases,ordinary_close_failure_quarantined:true,already_drained_not_completed_twice:true,primary_outcome_preserved:true,active_and_quarantine_bounded:true,no_business_io_replay:true,close_failure_injected:true,native_failed_close_qualified:false}));
