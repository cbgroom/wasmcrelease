import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {compile} from '../../current/wasmc.mjs';

assert(process.argv[2], 'trusted Native binary required');
const engines = process.argv[3] === '--wasmtime' ? ['wasmi','wasmtime'] : ['wasmi'];
assert(process.argv.length === 3 || (process.argv.length === 4 && engines.length === 2));
const source = await readFile('host/scenarios/file-async-app.wasmc','utf8');
const app = await compile(source), module = new WebAssembly.Module(app);
assert.deepEqual(WebAssembly.Module.imports(module), []);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(new Uint8Array(WebAssembly.Module.customSections(module,'wasmc-async-effects')[0])),
  'd02679e3ebf7b627db2bb37dad128b3b49f3e67e79bc30f96f46d904a88d4342');
const library = 'libs/wasmc-owned-algorithms/artifact.wasm';
assert.equal(sha(await readFile(library)), '44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
const dir = await mkdtemp(join(tmpdir(),'wasmc-native-file-'));
const counts = {};
try {
  const appPath = join(dir,'app.wasm'); await writeFile(appPath,app,{flag:'wx'});
  for(const engine of engines) {
    let positives = 0, negatives = 0;
    for(const [index,bytes] of [[],[7],[1,2,3,255],Array.from({length:16},(_,i)=>i)].entries()) {
      for(const mode of ['normal','cancel','sync-failure']) {
        const input = join(dir,`${engine}-${index}-${mode}-input`), output = input+'-output';
        await writeFile(input,Uint8Array.from(bytes),{flag:'wx'});
        const result = spawnSync(process.argv[2],[appPath,library,input,output,engine,mode],
          {encoding:'utf8',timeout:10000,env:{}});
        assert.equal(result.error,undefined); assert.equal(result.status,0,result.stderr);
        const receipt = JSON.parse(result.stdout);
        assert.equal(receipt.accepted,true); assert.equal(receipt.scratch_released,true);
        assert.equal(receipt.completed,mode === 'normal');
        assert.equal(receipt.effects,mode === 'normal' ? 5 : mode === 'cancel' ? 1 : 4);
        const expected = Buffer.alloc(mode === 'cancel' ? 0 : 8);
        if(expected.length) expected.writeBigInt64LE(BigInt(bytes.reduce((a,b)=>a+b,0)));
        assert.deepEqual(await readFile(output),expected);
        // Independent reopening plus exclusive-create rejection: no clobber or replay.
        const duplicate = spawnSync(process.argv[2],[appPath,library,input,output,engine,mode],
          {encoding:'utf8',timeout:10000,env:{}});
        assert.equal(duplicate.error,undefined); assert.notEqual(duplicate.status,0);
        assert.deepEqual(await readFile(output),expected);
        if(mode === 'normal') positives++; else negatives++;
      }
    }
    counts[engine] = {positive_paths:positives,negative_paths:negatives,no_clobber_controls:12};
  }
} finally {await rm(dir,{recursive:true});}
console.log(JSON.stringify({accepted:true,scope:'native-guest-scalar-file-task-fixture',engines:counts,
  app_sha256:sha(app),source_sha256:sha(source),
  binding_source_sha256:sha(await readFile('host/lib-e2e/rust/src/bin/file-task-reference.rs')),
  guest_initiates_io:true,blocking_io_fixture:true,uniform_v1_accepted:false,
  native_os_abort_proven:false,close_error_acknowledgement:false,power_loss_proven:false}));
