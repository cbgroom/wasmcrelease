import {NativeLinuxCapacitySession} from '../../../host/runtime/lib-boundary/native-linux-capacity.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [executor,fixture,endpointRoot,out]=process.argv.slice(2);assert(executor&&fixture&&endpointRoot&&out);const endpoint=path.join(endpointRoot,'native-adapter.so');
const hash=b=>createHash('sha256').update(b).digest('hex');const dir=path.dirname(fixture),checks=[];
async function descriptor(filename,adapter,limits){const row={schema:'wasmc.native-boundary-descriptor/v1',identity:'test:normal-operation@0.1.0',adapter:{path:path.basename(adapter),sha256:hash(await readFile(adapter)),export:'wasmc_boundary_v1_invoke'}};if(limits)row.limits=limits;const p=path.join(dir,filename);await writeFile(p,JSON.stringify(row));return p;}
class Session {
 constructor(desc,mode='--operation-session'){this.mode=mode;this.child=spawn(executor,[mode,desc],{stdio:['pipe','pipe','pipe']});this.buf=Buffer.alloc(0);this.pending=[];this.stderr='';this.child.stderr.on('data',x=>this.stderr+=x);this.child.stdout.on('data',x=>{this.buf=Buffer.concat([this.buf,x]);while(this.buf.length>=8){const len=this.buf.readUInt32LE(4);if(this.buf.length<8+len)break;const row={status:this.buf.readInt32LE(0),output:this.buf.subarray(8,8+len)};this.buf=this.buf.subarray(8+len);const p=this.pending.shift();assert(p);p.resolve(row);}});this.exit=new Promise((resolve,reject)=>{this.child.once('error',reject);this.child.once('close',(code,signal)=>code===0?resolve():reject(new Error(`executor exit ${code}/${signal}: ${this.stderr}`)));});}
 request(data,capacity){const extra=this.mode==='--capacity-session'?4:0;const frame=Buffer.alloc(4+extra+data.length);frame.writeUInt32LE(data.length);if(extra)frame.writeUInt32LE(capacity,4);data.copy(frame,4+extra);return new Promise((resolve,reject)=>{this.pending.push({resolve,reject});this.child.stdin.write(frame,e=>{if(e)reject(e)});});}
 async close(){this.child.stdin.end();await this.exit;assert.equal(this.pending.length,0);assert.equal(this.buf.length,0);}
}
const cmd=(id,token,timeout)=>{const b=Buffer.alloc(timeout===undefined?9:13);b[0]=id;b.writeBigUInt64LE(token,1);if(timeout!==undefined)b.writeUInt32LE(timeout,9);return b;};
const ok=async p=>{const r=await p;assert.equal(r.status,0);return r.output;};
async function submit(s,payload,capacity){const b=Buffer.alloc(5+payload.length);b[0]=1;b.writeUInt32LE(capacity,1);payload.copy(b,5);return(await ok(s.request(b))).readBigUInt64LE();}
async function result(s,token){const r=await ok(s.request(cmd(7,token,5000)));assert.equal(r.readInt32LE(0),0);return r.subarray(4);}
async function run(s,payload,cap){return result(s,await submit(s,payload,cap));}
const check=async(name,fn)=>{await fn();checks.push(name);console.log(JSON.stringify({accepted:true,check:name}));};
const free=await descriptor('fixture-free.json',fixture),legacy=await descriptor('fixture-legacy.json',fixture,{max_input_bytes:64,max_output_bytes:128});
let session=new Session(free);
await check('single invocation moves3MiB input and3MiB output',async()=>{const payload=Buffer.alloc(3*1024*1024,0x78),r=await run(session,Buffer.concat([Buffer.from([3]),payload]),payload.length);assert(r.equals(payload));});
await check('seventy pending operations and later unblocking operation all complete',async()=>{const tokens=[];for(let i=0;i<70;i++)tokens.push(await submit(session,Buffer.from([1]),0));assert.deepEqual(await run(session,Buffer.from([2]),0),Buffer.alloc(0));for(const token of tokens)assert.deepEqual(await result(session,token),Buffer.alloc(0));const count=await run(session,Buffer.from([4]),4);assert.equal(count.readUInt32LE(),73);});
await check('cancelled pending operation drains after actual completion',async()=>{await run(session,Buffer.from([5]),0);const token=await submit(session,Buffer.from([1]),0);await ok(session.request(cmd(4,token)));await run(session,Buffer.from([2]),0);const state=await ok(session.request(cmd(3,token,5000)));assert.equal(state[0],3);await ok(session.request(cmd(6,token)));});
await session.close();
session=new Session(free);
await check('timed-out single call drains before process and library exit',async()=>{
 const request=Buffer.alloc(10);request[0]=8;request.writeUInt32LE(0,1);request.writeUInt32LE(20,5);request[9]=6;
 const started=Date.now(),reply=await session.request(request);assert.equal(reply.status,-110);await session.close();assert(Date.now()-started>=150);
});
session=new Session(legacy);
await check('explicit legacy descriptor input and output limits remain enforced',async()=>{let b=Buffer.alloc(5+65);b[0]=1;b.writeUInt32LE(1,1);b[5]=3;assert.equal((await session.request(b)).status,-22);b=Buffer.alloc(6);b[0]=1;b.writeUInt32LE(129,1);b[5]=3;assert.equal((await session.request(b)).status,-22);assert.deepEqual(await run(session,Buffer.from([3,11]),1),Buffer.from([11]));});
await session.close();
const endpointDesc=path.join(endpointRoot,'native-boundary.json');const endpointManifest=JSON.parse(await readFile(path.join(endpointRoot,'lib.json')));assert.equal(endpointManifest.artifact.sha256,hash(await readFile(endpoint)));session=new Session(endpointDesc);
await check('real endpoint reads3MiB in a single call and accepts later new data',async()=>{const filename=path.join(dir,'endpoint-fixture.bin'),first=Buffer.alloc(3*1024*1024,0x51),second=Buffer.alloc(2*1024*1024,0x52),p=Buffer.from(filename);const request=Buffer.alloc(9+p.length);request[0]=1;request.writeUInt32LE(p.length,1);request.writeUInt32LE(first.length,5);p.copy(request,9);await writeFile(filename,first);assert((await run(session,request,first.length)).equals(first));await writeFile(filename,second);request.writeUInt32LE(second.length,5);assert((await run(session,request,second.length)).equals(second));});
await session.close();
session=new Session(free,'--capacity-session');
await check('direct capacity session transfers3MiB and new2MiB exactly once',async()=>{for(const n of [3*1024*1024,2*1024*1024]){const payload=Buffer.alloc(n,n===3*1024*1024?0x61:0x62);const reply=await session.request(Buffer.concat([Buffer.from([3]),payload]),n);assert.equal(reply.status,0);assert(reply.output.equals(payload));}const count=await session.request(Buffer.from([4]),4);assert.equal(count.status,0);assert.equal(count.output.readUInt32LE(),3);});
await session.close();
session=new Session(legacy,'--session');await check('legacy session preserves declared output capacity',async()=>{const reply=await session.request(Buffer.from([3,9]));assert.equal(reply.status,0);assert.deepEqual(reply.output,Buffer.from([9]));});await session.close();
session=new Session(legacy,'--capacity-session');await check('direct capacity session respects explicit descriptor maximum',async()=>{const frame=Buffer.alloc(9);frame.writeUInt32LE(1,0);frame.writeUInt32LE(129,4);frame[8]=3;session.child.stdin.end(frame);await assert.rejects(session.exit,/output limit/);});
session=new Session(endpointDesc,'--capacity-session');await check('direct endpoint reads3MiB then fresh2MiB',async()=>{const filename=path.join(dir,'endpoint-direct.bin'),p=Buffer.from(filename);for(const n of [3*1024*1024,2*1024*1024]){const bytes=Buffer.alloc(n,n===3*1024*1024?0x41:0x42);await writeFile(filename,bytes);const request=Buffer.alloc(9+p.length);request[0]=1;request.writeUInt32LE(p.length,1);request.writeUInt32LE(n,5);p.copy(request,9);const reply=await session.request(request,n);assert.equal(reply.status,0);assert(reply.output.equals(bytes));}});await session.close();
await check('generic direct client serializes fresh inputs without replay',async()=>{const client=new NativeLinuxCapacitySession(executor,free),first=Buffer.from([3,10]),second=Buffer.from([3,20]);const a=client.invoke(first,1),b=client.invoke(second,1);second[1]=99;assert.deepEqual((await a).bytes,Buffer.from([10]));assert.deepEqual((await b).bytes,Buffer.from([20]));assert.equal((await client.invoke(Buffer.from([4]),4)).bytes.readUInt32LE(),3);await client.close();});
await check('generic direct client reads real endpoint with fresh large input',async()=>{const client=new NativeLinuxCapacitySession(executor,endpointDesc),filename=path.join(dir,'endpoint-client.bin'),p=Buffer.from(filename);for(const n of [3*1024*1024,2*1024*1024]){const bytes=Buffer.alloc(n,n===3*1024*1024?0x44:0x45);await writeFile(filename,bytes);const req=Buffer.alloc(9+p.length);req[0]=1;req.writeUInt32LE(p.length,1);req.writeUInt32LE(n,5);p.copy(req,9);const result=await client.invoke(req,n);assert.equal(result.status,0);assert(result.bytes.equals(bytes));}await client.close();});
await writeFile(out,JSON.stringify({accepted:true,checks,platform:process.platform,arch:process.arch,executor_sha256:hash(await readFile(executor)),fixture_sha256:hash(await readFile(fixture)),endpoint_sha256:hash(await readFile(endpoint)),endpoint_manifest_sha256:hash(await readFile(path.join(endpointRoot,'lib.json'))),same_process_new_inputs:true,network_security_work:false,current_catalog:false,formal_release:false},null,2)+'\n');
