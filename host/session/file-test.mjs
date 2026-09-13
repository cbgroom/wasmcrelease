import assert from 'node:assert/strict';
import {open,readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {compile} from '../../current/wasmc.mjs';
import {PreopenedFile} from '../file-io/adapter.mjs';
import {HostSession} from './session.mjs';
import {driveScalarTask} from '../scenarios/scalar-task-driver.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = await readFile('host/scenarios/file-async-app.wasmc','utf8');
const appBytes = await compile(source), module = new WebAssembly.Module(appBytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);
assert.equal(sha(new Uint8Array(WebAssembly.Module.customSections(module,'wasmc-async-effects')[0])),
  'd02679e3ebf7b627db2bb37dad128b3b49f3e67e79bc30f96f46d904a88d4342');
const libBytes = await readFile('libs/wasmc-owned-algorithms/artifact.wasm');
assert.equal(sha(libBytes),'44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
let positive=0,negative=0;
async function run(bytes, mode='normal') {
  const dir=typeof Deno==='object'?await Deno.makeTempDir({prefix:'wasmc-session-'})
    :await mkdtemp(join(tmpdir(),'wasmc-session-'));
  const endpoints=new Set(),windows=new Set(),operations=new Set();
  let session,root,lib,ptr;
  const trace=[];
  try {
    const inputPath=join(dir,'input'),outputPath=join(dir,'output');
    const seed=await open(inputPath,'wx');try{await seed.writeFile(Uint8Array.from(bytes));}finally{await seed.close();}
    const inputHandle=await open(inputPath,'r');let outputHandle;
    try{outputHandle=await open(outputPath,'wx+');}catch(error){await inputHandle.close();throw error;}
    session=new HostSession([
      {name:'input',backend:new PreopenedFile(inputHandle,false),kind:'file',read:true,write:false},
      {name:'output',backend:new PreopenedFile(outputHandle,true),kind:'file',read:true,write:true},
    ],{clockRead:kind=>kind==='monotonic'?BigInt(Math.floor(performance.now()*1000)):BigInt(Date.now())*1000n,
      entropyFill:bytes=>globalThis.crypto.getRandomValues(bytes)});
    root=session.root;assert.equal(session.describe(root).length,2);
    const before=session.clock_read('monotonic'); assert(session.clock_read('wall')>0n);
    const input=session.open(root,'input'),output=session.open(root,'output',{write:true});
    endpoints.add(input);endpoints.add(output);
    assert.deepEqual(Object.keys(input),[]);
    const readWindow=session.window_acquire(16),writeWindow=session.window_acquire(8);
    windows.add(readWindow);windows.add(writeWindow);
    const check=async operation=>{
      operations.add(operation);
      const receipts=await session.wait([operation]);
      assert.equal(receipts.length,1);assert.equal(receipts[0].operation,operation);
      let result;
      try{result=session.take_result(operation);}finally{await session.release(operation);operations.delete(operation);}
      return result;
    };
    await check(session.entropy_fill(readWindow,16));assert.equal(session.copy_out(readWindow).length,16);
    ({instance:lib}=await WebAssembly.instantiate(libBytes,{}));ptr=lib.exports.cabi_realloc(0,0,4,64);
    let readBytes;const abort=new AbortController();
    const effects=[
      async limit=>{
        trace.push('read');const op=session.read(input,readWindow,{length:limit});operations.add(op);
        assert.deepEqual(await session.wait([op],{timeoutMs:0}),[]); // Poll only; never cancels/consumes.
        if(mode==='cancel'){assert.equal(session.cancel(op),'accepted');abort.abort();}
        const receipts=await session.wait([op]);assert.equal(receipts.length,1);
        assert.equal(receipts[0].operation,op);
        if(mode==='cancel'){
          assert.equal(receipts[0].result.status,'cancelled');assert.deepEqual(session.copy_out(readWindow),[]);
          await session.release(op);operations.delete(op);return 0;
        }
        assert.equal(session.take_result(op).status,'ok');readBytes=session.copy_out(readWindow);
        assert.deepEqual(readBytes,bytes);await session.release(op);operations.delete(op);return readBytes.length;
      },
      async length=>{
        trace.push('lib');assert.equal(length,readBytes.length);
        const view=new DataView(lib.exports.memory.buffer);
        readBytes.forEach((byte,index)=>view.setInt32(ptr+4*index,byte,true));
        return Number(lib.exports['sum-s32'](ptr,length));
      },
      async sum=>{
        trace.push('write');assert.equal(sum,bytes.reduce((a,b)=>a+b,0));
        const encoded=new Uint8Array(8);new DataView(encoded.buffer).setBigInt64(0,BigInt(sum),true);
        session.window_commit(writeWindow,[...encoded],8);
        return (await check(session.write(output,writeWindow))).transferred;
      },
      async count=>{trace.push('sync');assert.equal(count,8);assert.equal((await check(session.invoke(output,'storage-sync'))).durability,'sync-acknowledged');return count;},
      async count=>{
        trace.push('release');
        for(const endpoint of endpoints){await session.release(endpoint);endpoints.delete(endpoint);}
        for(const window of windows){await session.release(window);windows.delete(window);}
        return count;
      },
    ];
    const {instance:app}=await WebAssembly.instantiate(appBytes,{});
    const task=driveScalarTask(app.exports.run,16,effects,{signal:abort.signal});
    if(mode==='cancel'){
      await assert.rejects(task,/cancelled/);assert.deepEqual(trace,['read']);
      assert.equal((await readFile(outputPath)).length,0);negative++;
    }else{
      assert.equal(await task,8);assert.deepEqual(trace,['read','lib','write','sync','release']);
      const expected=Buffer.alloc(8);expected.writeBigInt64LE(BigInt(bytes.reduce((a,b)=>a+b,0)));
      assert.deepEqual(await readFile(outputPath),expected);positive++;
    }
    assert(session.clock_read('monotonic')>=before);
  }finally{
    if(session){
      for(const op of operations){await session.wait([op],{timeoutMs:30000});await session.release(op);}
      for(const window of windows)await session.release(window);
      for(const endpoint of endpoints)await session.release(endpoint);
      await session.release(root);
      assert.deepEqual(session.counts(),{endpoints:0,unopened_grants:0,windows:0,operations:0,waiters:0,window_bytes:0});
    }
    if(lib&&ptr!==undefined){new Uint8Array(lib.exports.memory.buffer,ptr,64).fill(0);lib.exports.cabi_realloc(ptr,64,4,0);}
    await rm(dir,{recursive:true});
  }
}
for(const bytes of [[],[7],[1,2,3,255],Array.from({length:16},(_,i)=>i)])await run(bytes);
await run([1,2,3,255],'cancel');
console.log(JSON.stringify({accepted:true,scope:'shared-js-session-guest-file-e2e',positive,negative,
  typed_opaque_objects:true,wait_timeout_does_not_cancel:true,actual_settlement_before_unpin:true,
  resource_counts_zero:true,uniform_core_abi_accepted:false,native_session_parity:false,
  app_sha256:sha(appBytes),session_sha256:sha(await readFile('host/session/session.mjs'))}));
