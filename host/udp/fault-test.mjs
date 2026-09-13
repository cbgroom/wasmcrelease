import assert from 'node:assert/strict';
import {createSocket} from 'node:dgram';
import {EventEmitter} from 'node:events';
import {PreauthorizedDatagram} from './adapter.mjs';
const watchdog=setTimeout(()=>{console.error('UDP ownership timeout');process.exit(1);},5000);
async function bound(){const s=createSocket('udp4');s.on('error',()=>{});await new Promise(resolve=>s.bind(0,'127.0.0.1',resolve));return s;}
async function send(socket,port,bytes){await new Promise((resolve,reject)=>socket.send(Uint8Array.from(bytes),port,'127.0.0.1',error=>error?reject(error):resolve()));}
let controls=0;
const client=await bound();
try {
  {
    const socket=new EventEmitter();socket.address=()=>({address:'127.0.0.1',port:7});socket.close=()=>socket.emit('close');
    const endpoint=new PreauthorizedDatagram(socket,{address:'127.0.0.1',port:8});
    const first=endpoint.read();for(const byte of [1,2,3])socket.emit('message',Uint8Array.of(byte),{address:'127.0.0.1',port:8});
    assert.deepEqual(await first,[1]);const second=endpoint.read();socket.emit('message',Uint8Array.of(4),{address:'127.0.0.1',port:8});
    assert.deepEqual(await second,[2]);assert.deepEqual(await endpoint.read(),[3]);assert.deepEqual(await endpoint.read(),[4]);await endpoint.release();controls++;
  }
  {
    const socket=await bound(),endpoint=new PreauthorizedDatagram(socket,{address:'127.0.0.1',port:client.address().port});
    const read=assert.rejects(endpoint.read(),e=>e===-8);
    await assert.rejects(endpoint.read(),e=>e===-4);controls++;
    await assert.rejects(endpoint.write([1]),e=>e===-4);controls++;
    await assert.rejects(endpoint.release(),e=>e===-4);controls++;
    await endpoint.terminateRead();await read;await endpoint.release();controls++;
    await assert.rejects(endpoint.read(),e=>e===-1);controls++;
  }
  {
    const socket=await bound(),endpoint=new PreauthorizedDatagram(socket,{address:'127.0.0.1',port:client.address().port},false);
    await assert.rejects(endpoint.write([7]),e=>e===-2);controls++;
    const read=endpoint.read();await send(client,socket.address().port,[9]);assert.deepEqual(await read,[9]);
    await endpoint.release();controls++;
  }
  {
    const socket=await bound(),endpoint=new PreauthorizedDatagram(socket,{address:'127.0.0.1',port:client.address().port});
    let seen=0;const observed=new Promise(resolve=>socket.on('message',()=>{if(++seen===3)resolve();}));
    for(let i=0;i<3;i++)await send(client,socket.address().port,[i]);await observed;
    await assert.rejects(endpoint.read(),e=>e===-3);await assert.rejects(endpoint.write([1]),e=>e===-3);await endpoint.release();controls++;
  }
  for(const proxyLength of [false,true]) {
    const socket=await bound(),endpoint=new PreauthorizedDatagram(socket,{address:'127.0.0.1',port:client.address().port});
    let reads=0;const input=proxyLength?new Proxy([7],{get(target,key){return key==='length'?(++reads===1?1:17):Reflect.get(target,key);}}):[];
    if(!proxyLength)Object.defineProperty(input,0,{get(){return ++reads===1?7:256;}});
    const received=new Promise(resolve=>client.once('message',resolve));
    assert.equal(await endpoint.write(input),1);assert.deepEqual([...await received],[7]);assert.equal(reads,1);await endpoint.release();controls++;
  }
}finally{await new Promise(resolve=>client.close(resolve));clearTimeout(watchdog);}
console.log(JSON.stringify({accepted:true,udp_fault_controls:controls,real_loopback_udp:true,pending_read_close_denied:true,explicit_stop_close_ack:true,readonly_no_effect:true,queue_budget_messages:2,single_read_snapshot:true,native_async_qualified:false}));
