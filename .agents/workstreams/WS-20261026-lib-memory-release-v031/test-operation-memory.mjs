import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [executor,fixture,endpoint,out]=process.argv.slice(2);assert(executor&&fixture&&endpoint&&out);
const hash=b=>createHash('sha256').update(b).digest('hex');const dir=path.dirname(fixture),checks=[];
async function descriptor(filename,adapter,limits){const row={schema:'wasmc.native-boundary-descriptor/v1',identity:'test:normal-operation@0.1.0',adapter:{path:path.basename(adapter),sha256:hash(await readFile(adapter)),export:'wasmc_boundary_v1_invoke'}};if(limits)row.limits=limits;const p=path.join(dir,filename);await writeFile(p,JSON.stringify(row));return p;}
class Session {
 constructor(desc){this.child=spawn(executor,['--operation-session',desc],{stdio:['pipe','pipe','pipe']});this.buf=Buffer.alloc(0);this.pending=[];this.stderr='';this.child.stderr.on('data',x=>this.stderr+=x);this.child.stdout.on('data',x=>{this.buf=Buffer.concat([this.buf,x]);while(this.buf.length>=8){const len=this.buf.readUInt32LE(4);if(this.buf.length<8+len)break;const row={status:this.buf.readInt32LE(0),output:this.buf.subarray(8,8+len)};this.buf=this.buf.subarray(8+len);const p=this.pending.shift();assert(p);p.resolve(row);}});this.exit=new Promise((resolve,reject)=>{this.child.once('error',reject);this.child.once('close',(code,signal)=>code===0?resolve():reject(new Error(`executor exit ${code}/${signal}: ${this.stderr}`)));});}
 request(data){const frame=Buffer.alloc(4+data.length);frame.writeUInt32LE(data.length);data.copy(frame,4);return new Promise((resolve,reject)=>{this.pending.push({resolve,reject});this.child.stdin.write(frame,e=>{if(e)reject(e)});});}
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
const endpointDesc=await descriptor('endpoint-free.json',endpoint);session=new Session(endpointDesc);
await check('real endpoint reads3MiB in a single call and accepts later new data',async()=>{const filename=path.join(dir,'endpoint-fixture.bin'),first=Buffer.alloc(3*1024*1024,0x51),second=Buffer.alloc(2*1024*1024,0x52),p=Buffer.from(filename);const request=Buffer.alloc(9+p.length);request[0]=1;request.writeUInt32LE(p.length,1);request.writeUInt32LE(first.length,5);p.copy(request,9);await writeFile(filename,first);assert((await run(session,request,first.length)).equals(first));await writeFile(filename,second);request.writeUInt32LE(second.length,5);assert((await run(session,request,second.length)).equals(second));});
await session.close();
await writeFile(out,JSON.stringify({accepted:true,checks,platform:process.platform,arch:process.arch,executor_sha256:hash(await readFile(executor)),fixture_sha256:hash(await readFile(fixture)),endpoint_sha256:hash(await readFile(endpoint)),same_process_new_inputs:true,network_security_work:false,current_catalog:false,formal_release:false},null,2)+'\n');
