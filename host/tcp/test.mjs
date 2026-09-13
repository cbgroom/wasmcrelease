import { createServer, createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { PreconnectedTcp } from './adapter.mjs';
const trace=(...args)=>{if(process.argv.includes('--trace')) console.error(...args);};
const watchdog=setTimeout(()=>{console.error('TCP conformance timeout');process.exit(1);},30000);
const libPath='libs/wasmc-owned-algorithms/artifact.wasm';
const libBytes=await readFile(libPath);
const digest=createHash('sha256').update(libBytes).digest('hex');
assert.equal(digest,'44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
async function sum(bytes) {
  const {instance}=await WebAssembly.instantiate(libBytes,{}),e=instance.exports;
  const ptr=e.cabi_realloc(0,0,4,64),view=new DataView(e.memory.buffer);
  bytes.forEach((b,i)=>view.setInt32(ptr+4*i,b,true));
  try {return e['sum-s32'](ptr,bytes.length);} finally {e.cabi_realloc(ptr,64,4,0);}
}
async function journey(bytes,writable,native) {
  trace('start',bytes.length,writable,!!native);
  let finish;
  const received=new Promise(resolve=>{finish=resolve;});
  const peers=new Set();
  const server=createServer({allowHalfOpen:true},socket=>{
    peers.add(socket);socket.on('error',()=>{});
    const chunks=[];socket.on('data',chunk=>{chunks.push(chunk);if(Buffer.concat(chunks).length>=8) socket.end();});
    socket.on('close',()=>{peers.delete(socket);finish(Buffer.concat(chunks));});
    // Intentionally fragment input; its bounded length is fixture metadata.
    socket.write(Uint8Array.from(bytes.slice(0,1)));
    setTimeout(()=>{
      if(writable) socket.write(Uint8Array.from(bytes.slice(1)));
      else socket.end(Uint8Array.from(bytes.slice(1)));
    },10);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const timeout=setTimeout(()=>{for(const peer of peers) peer.destroy();},6000);
  try {
    if(native) {
      const child=spawn(native,[`127.0.0.1:${port}`,writable?'write':'read',libPath,String(bytes.length)],{env:{},stdio:['ignore','pipe','pipe']});
      let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
      const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
      assert.equal(exit,0,stderr);assert.equal(stdout.trim(),Buffer.from(bytes).toString('hex'));
    } else {
      const socket=createConnection({host:'127.0.0.1',port,allowHalfOpen:true});
      await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
      const tcp=new PreconnectedTcp(socket,writable);
      try {
        await assert.rejects(tcp.read(17),e=>e===-5);
        await assert.rejects(tcp.write(Array(17).fill(0)),e=>e===-5);
        await assert.rejects(tcp.write(Array(1)),e=>e===-5);
        const input=[];
        if(bytes.length) {
          const pending=tcp.read(3);
          await assert.rejects(tcp.release(),e=>e===-4);
          await assert.rejects(tcp.read(1),e=>e===-4);
          await assert.rejects(tcp.write([1]),e=>e===-4);
          input.push(...await pending);
        }
        while(input.length<bytes.length) {const chunk=await tcp.read(3);assert.ok(chunk.length&&chunk.length<=3);input.push(...chunk);assert.ok(input.length<=16);}
        assert.deepEqual(input,bytes);
        const value=await sum(input),out=Buffer.alloc(8);out.writeBigInt64LE(value);
        if(writable) assert.equal(await tcp.write([...out]),8);
        else await assert.rejects(tcp.write([1]),e=>e===-2);
        assert.deepEqual(await tcp.read(16),[]);trace('EOF');
      } finally {trace('release');await tcp.release();trace('released');}
      await assert.rejects(tcp.read(1),e=>e===-1);
      await assert.rejects(tcp.write([1]),e=>e===-1);
      await assert.rejects(tcp.release(),e=>e===-1);
    }
    trace('peer wait');const output=await received,expected=Buffer.alloc(8);trace('peer closed');
    expected.writeBigInt64LE(BigInt(bytes.reduce((a,b)=>a+b,0)));
    assert.deepEqual(output,writable?expected:Buffer.alloc(0));
  } finally {
    clearTimeout(timeout);for(const peer of peers) peer.destroy();
    await new Promise(resolve=>server.close(resolve));trace('server closed');
  }
}
let cases=0;
for(const bytes of [[],[7],[1,2,3,255],Array.from({length:16},(_,i)=>i)]) {
  for(const writable of [false,true]) {
    await journey(bytes,writable,null);await journey(bytes,writable,process.argv[2]);cases++;
  }
}
clearTimeout(watchdog);
console.log(JSON.stringify({accepted:true,paired_cases:cases,real_loopback_tcp:true,fragmented_input:true,readonly_no_write:true,post_close_denied:true,busy_release_denied:true,lib_sha256:digest,guest_address_authority:false,tls:false}));
