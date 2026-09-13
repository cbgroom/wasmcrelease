// Exact admitted five-stage fixture; not general async Lib/resource SDK.
import assert from 'node:assert/strict';
import {readFile, open, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {compile} from '../../current/wasmc.mjs';
import {PreopenedRoot} from '../file-io/root.mjs';
import {CommittedWriteWindow} from '../file-io/write-window.mjs';
import {driveScalarTask} from './scalar-task-driver.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = await readFile('host/scenarios/file-async-app.wasmc','utf8');
const bytes = await compile(source), module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);
const metadata = WebAssembly.Module.customSections(module, 'wasmc-async-effects');
assert.equal(metadata.length, 1);
// Binds the finite effect identities/order to this reviewed profile before I/O.
assert.equal(sha(new Uint8Array(metadata[0])), 'd02679e3ebf7b627db2bb37dad128b3b49f3e67e79bc30f96f46d904a88d4342');
const libBytes = await readFile('libs/wasmc-owned-algorithms/artifact.wasm');
assert.equal(sha(libBytes), '44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
let positives = 0, negatives = 0;
async function run(inputBytes, mode = 'normal') {
  const dir = typeof Deno === 'object' ? await Deno.makeTempDir({prefix:'wasmc-async-file-'})
    : await mkdtemp(join(tmpdir(),'wasmc-async-file-'));
  let root, input, output, window, lib, slab;
  const trace = [], controller = new AbortController();
  try {
    const inputPath = join(dir,'input'), outputPath = join(dir,'output');
    const seed = await open(inputPath,'wx');
    try {await seed.writeFile(Uint8Array.from(inputBytes));} finally {await seed.close();}
    const inputHandle = await open(inputPath,'r');
    let outputHandle;
    try {outputHandle = await open(outputPath,'wx+');}
    catch(error) {await inputHandle.close(); throw error;}
    root = new PreopenedRoot([{name:'input',file:inputHandle,writable:false},
      {name:'output',file:outputHandle,writable:true}]);
    input = root.open('input'); output = root.open('output',{write:true});
    window = new CommittedWriteWindow(8);
    ({instance:lib} = await WebAssembly.instantiate(libBytes,{}));
    slab = lib.exports.cabi_realloc(0,0,4,64);
    let data, readSettled = false;
    const effects = [
      async limit => {
        trace.push('read'); assert.equal(limit,16);
        const pending = input.read(0,limit);
        if(mode === 'cancel') controller.abort();
        await assert.rejects(input.release(), e => e === -4);
        data = await pending; readSettled = true;
        return data.length;
      },
      async length => {
        trace.push('lib-sum'); assert(readSettled); assert.equal(length,data.length);
        const view = new DataView(lib.exports.memory.buffer);
        data.forEach((byte,index) => view.setInt32(slab+4*index,byte,true));
        // Local admitted Lib dispatch: no external Host mechanism is added.
        return Number(lib.exports['sum-s32'](slab,length));
      },
      async value => {
        trace.push('write');
        assert.equal(value,inputBytes.reduce((a,b)=>a+b,0));
        const encoded = new Uint8Array(8);
        new DataView(encoded.buffer).setBigInt64(0,BigInt(value),true);
        window.commit([...encoded],8);
        return await window.writeTo(output,0);
      },
      async count => {
        trace.push('sync'); assert.equal(count,8);
        if(mode === 'sync-failure') throw Error('controlled-sync-failure');
        await output.invokeSync(); return count;
      },
      async count => {
        trace.push('release');
        await input.release(); input = null;
        await output.release(); output = null;
        window.release(); window = null;
        return count;
      },
    ];
    const {instance:app} = await WebAssembly.instantiate(bytes,{});
    const task = driveScalarTask(app.exports.run,16,effects,{signal:controller.signal});
    if(mode === 'cancel') {
      await assert.rejects(task,/cancelled/); assert(readSettled);
      assert.deepEqual(trace,['read']);
      assert.equal((await readFile(outputPath)).length,0); negatives++;
    } else {
      if(mode === 'sync-failure') {
        await assert.rejects(task,/controlled-sync-failure/);
        assert.deepEqual(trace,['read','lib-sum','write','sync']); negatives++;
      } else {
        assert.equal(await task,8);
        assert.deepEqual(trace,['read','lib-sum','write','sync','release']); positives++;
      }
      const expected = Buffer.alloc(8);
      expected.writeBigInt64LE(BigInt(inputBytes.reduce((a,b)=>a+b,0)));
      assert.deepEqual(await readFile(outputPath),expected);
    }
  } finally {
    const outcomes = await Promise.allSettled([input?.release(),output?.release(),root?.release()]);
    if(window) window.release();
    if(lib && slab !== undefined) {
      new Uint8Array(lib.exports.memory.buffer,slab,64).fill(0);
      lib.exports.cabi_realloc(slab,64,4,0);
    }
    const failed = outcomes.find(row => row.status === 'rejected');
    if(failed) throw failed.reason; // Retain files on failed retirement, do not pretend clean.
    await rm(dir,{recursive:true});
  }
}
for(const input of [[],[7],[1,2,3,255],Array.from({length:16},(_,i)=>i)]) await run(input);
await run([1,2,3,255],'cancel'); await run([1,2,3,255],'sync-failure');
// Explicit controlled malformed-transition/result negatives, not real-I/O proofs.
await assert.rejects(driveScalarTask(()=>[0,2,16],16,[async()=>0]),/invalid-effect-transition/);
await assert.rejects(driveScalarTask(()=>[0,1,16],16,[async()=>NaN]),/invalid-effect-result/);
console.log(JSON.stringify({accepted:true,scope:'guest-initiated-scalar-async-file-fixture',
  positive_paths:positives,negative_paths:negatives,driver_negative_controls:2,
  guest_initiates_io:true,real_file_io:true,independent_disk_oracle:true,
  cancel_drains_before_cleanup:true,sync_failure_no_replay:true,
  uniform_v1_accepted:false,general_async_lib_sdk:false,native_parity:false,
  app_sha256:sha(bytes),source_sha256:sha(source),lib_sha256:sha(libBytes)}));
