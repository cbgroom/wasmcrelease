import { PreopenedFile } from '../file-io/adapter.mjs';
import { ScopedCompletionGuard } from '../completion/scoped-guard.mjs';
import { readWindow } from '../completion/read-window.mjs';
import { compile } from '../../current/wasmc.mjs';
import { mkdtemp, open, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const libPath='libs/wasmc-owned-algorithms/artifact.wasm';
const libBytes=await readFile(libPath);
const libSha=createHash('sha256').update(libBytes).digest('hex');
assert.equal(libSha,'44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
const wasm=await compile(await readFile('host/lib-e2e/guest.wasmc','utf8'));
await mkdir('target/host-lib-e2e',{recursive:true});
const appPath='target/host-lib-e2e/guest.wasm';
await writeFile(appPath,wasm);
const root=await mkdtemp(join(tmpdir(),'wasmc-lib-e2e-'));
let count=0;
try {
  for(const bytes of [[],[7],[1,2,3,255],Array.from({length:16},(_,i)=>i)]) {
    for(const mode of ['write','read','trap','cancel','read-failure']) {
      const inputPath=join(root,`input-${count}`);
      const jsPath=join(root,`js-${count}`), nativePath=join(root,`native-${count}`);
      const sentinel=Buffer.alloc(8,99);
      await writeFile(inputPath,Uint8Array.from(bytes));
      await writeFile(jsPath,sentinel); await writeFile(nativePath,sentinel);
      // A real write-only descriptor makes the filesystem reject read.
      const input=new PreopenedFile(await open(inputPath,mode==='read-failure'?'a':'r'),false);
      const guard=ScopedCompletionGuard.fresh();
      let window=[],readFailure;
      try {
        window=await readWindow(input,guard,{cancelDelivery:mode==='cancel'});
      } catch(cause) {
        readFailure=cause;
        assert.equal(cause,mode==='cancel'?-6:mode==='read-failure'?-8:undefined);
      }
      assert.deepEqual(guard.counts(),[0,0]);
      await assert.rejects(input.read(0,1),e=>e===-1);
      const {instance:lib}=await WebAssembly.instantiate(libBytes,{});
      const ptr=lib.exports.cabi_realloc(0,0,4,64);
      const view=new DataView(lib.exports.memory.buffer);
      window.forEach((b,i)=>view.setInt32(ptr+4*i,b,true));
      const {instance:app}=await WebAssembly.instantiate(wasm,{transport:{sum_window(n) {
        assert.equal(n,window.length);
        return lib.exports['sum-s32'](ptr,n);
      }}});
      let value, error=false;
      try {
        if(readFailure!==undefined) throw readFailure;
        value=app.exports.run(window.length,mode==='trap'?1:0);
        const output=new PreopenedFile(await open(jsPath,'r+'),mode==='write');
        try {
          const out=Buffer.alloc(8);out.writeBigInt64LE(value);
          await output.write(0,[...out]);await output.invokeSync();
        } finally { await output.release(); }
      } catch (cause) {
        error=true;
        if(mode==='read') assert.equal(cause,-2);
        else if(mode==='cancel') assert.equal(cause,-6);
        else if(mode==='read-failure') assert.equal(cause,-8);
        else if(mode==='trap') assert.ok(cause instanceof WebAssembly.RuntimeError);
        else throw cause;
      }
      // Canonical input is borrowed/copied by this Lib; harness slab is reclaimed.
      lib.exports.cabi_realloc(ptr,64,4,0);
      const native=spawnSync(process.argv[2],[inputPath,nativePath,appPath,libPath,mode==='write'?'write':'read',mode==='trap'?'1':mode==='cancel'?'2':mode==='read-failure'?'3':'0'],{env:{},encoding:'utf8',timeout:30000});
      const expected=Buffer.alloc(8);expected.writeBigInt64LE(BigInt(bytes.reduce((a,b)=>a+b,0)));
      assert.equal(error,mode!=='write');
      assert.equal(native.status===0,mode==='write',native.stderr);
      if(mode==='read') assert.match(native.stderr,/write\/sync -2/);
      if(mode==='trap') assert.match(native.stderr,/divide by zero/);
      if(mode==='cancel') assert.match(native.stderr,/cancelled completion/);
      if(mode==='read-failure') assert.match(native.stderr,/read -8/);
      if(mode==='write') {
        assert.equal(value,expected.readBigInt64LE());
        assert.equal(BigInt(native.stdout.trim()),value);
      }
      assert.deepEqual(await readFile(jsPath),mode==='write'?expected:sentinel);
      assert.deepEqual(await readFile(nativePath),mode==='write'?expected:sentinel);
      count++;
    }
  }
  console.log(JSON.stringify({accepted:true,cases:count,lib_sha256:libSha,app_sha256:createHash('sha256').update(wasm).digest('hex'),real_file_io:true,trap_no_flush:true,readonly_no_write:true,cancelled_read_no_flush:true,failed_read_no_flush:true,guard_cleanup:true,binding_scoped:true,guest_async_abi:false}));
} finally { await rm(root,{recursive:true,force:true}); }
