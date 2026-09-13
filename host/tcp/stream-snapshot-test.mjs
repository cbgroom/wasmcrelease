import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PreconnectedTcp} from './adapter.mjs';
function socket() {
  const s=new EventEmitter();s.destroyed=false;s.closed=false;s.pause=()=>{};
  s.destroy=()=>{s.destroyed=true;s.closed=true;s.emit('close');return s;};return s;
}
let controls=0;
for(const lengths of [[1,4],[2,3],[5],[1,1,1,1,1]]) {
  const s=socket(),queue=[Uint8Array.of(4,1,2,3,255)];let active;
  // Adversarial borrowed backend view: pause invalidates its current buffer.
  s.pause=()=>{active?.fill(0);};s.unshift=bytes=>queue.unshift(bytes);
  s.resume=()=>queueMicrotask(()=>{if(queue.length){active=queue.shift();s.emit('data',active);active=undefined;}else s.emit('end');});
  const tcp=new PreconnectedTcp(s),received=[];
  for(const length of lengths)received.push(...await tcp.read(length));
  assert.deepEqual(received,[4,1,2,3,255]);assert.deepEqual(await tcp.read(1),[]);
  await tcp.release();controls++;
}
{
  const s=socket();let callback,snapshot;
  s.write=(bytes,cb)=>{snapshot=bytes;callback=cb;};
  const tcp=new PreconnectedTcp(s),input=[1,2,3],pending=tcp.write(input);
  input[0]=99;input.push(4);assert.deepEqual([...snapshot],[1,2,3]);callback();
  assert.equal(await pending,3);await tcp.release();controls++;
}
{
  const s=socket();let accesses=0,snapshot;
  s.write=(bytes,cb)=>{snapshot=bytes;cb();};
  const input=[1];Object.defineProperty(input,0,{get:()=>++accesses===1?1:256});
  const tcp=new PreconnectedTcp(s);assert.equal(await tcp.write(input),1);
  assert.equal(accesses,1);assert.deepEqual([...snapshot],[1]);await tcp.release();controls++;
}
console.log(JSON.stringify({accepted:true,stream_snapshot_controls:controls,borrowed_read_view_copied_before_pause:true,tail_has_owned_snapshot:true,write_count_uses_snapshot:true,single_read_validation:true,linux_bun_root_cause_proved:false}));
