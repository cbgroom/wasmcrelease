// Real vertical fixture, not the uniform v1 guest resource/Future SDK.
import assert from 'node:assert/strict';
import {mkdtemp, open, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {compile} from '../../current/wasmc.mjs';
import {PreopenedRoot} from '../file-io/root.mjs';
import {CommittedWriteWindow} from '../file-io/write-window.mjs';
import {createResidentApp} from '../tcp/resident-app.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = await readFile('host/lib-e2e/guest.wasmc', 'utf8');
const appBytes = await compile(source);
assert(process.argv[2], 'independently rustc-compiled Rust caller path required');
const rustBytes = await readFile(process.argv[2]);
const libBytes = await readFile('libs/wasmc-owned-algorithms/artifact.wasm');
assert.equal(sha(libBytes), '44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
for (const bytes of [appBytes, rustBytes]) {
  assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(bytes)).map(({module,name,kind}) => ({module,name,kind})),
    [{module:'transport', name:'sum_window', kind:'function'}]);
}
let positives = 0, negatives = 0;
async function exercise(bytes, caller, mode = 'normal') {
  const dir = typeof Deno === 'object' ? await Deno.makeTempDir({prefix:'wasmc-file-app-'})
    : await mkdtemp(join(tmpdir(), 'wasmc-file-app-'));
  let input, output, root, app, window;
  try {
    const inputPath = join(dir, 'input'), outputPath = join(dir, 'output');
    const seed = await open(inputPath, 'wx');
    try {await seed.writeFile(Uint8Array.from(bytes));} finally {await seed.close();}
    const inputHandle = await open(inputPath, 'r');
    let outputHandle;
    try {outputHandle = await open(outputPath, 'wx+');}
    catch (error) {await inputHandle.close(); throw error;}
    let syncAttempts = 0;
    const outputBackend = mode === 'sync-failure' ? {
      read: (...args) => outputHandle.read(...args),
      write: (...args) => outputHandle.write(...args),
      close: () => outputHandle.close(),
      sync: async () => {syncAttempts++; throw Error('controlled sync failure');},
    } : outputHandle;
    root = new PreopenedRoot([{name:'input',file:inputHandle,writable:false},
      {name:'output',file:outputBackend,writable:true}]);
    assert.equal(root.describe().length, 2);
    assert.throws(() => root.open('../escape'), e => e === -2);
    input = root.open('input'); output = root.open('output', {write: mode !== 'readonly'});
    const pending = input.read(0, 16);
    // Issued real read retains the descriptor until backend settlement.
    await assert.rejects(input.release(), e => e === -4);
    const data = await pending;
    assert.deepEqual(data, bytes);
    assert.deepEqual(await input.read(bytes.length, 1), []);
    app = await createResidentApp(libBytes, caller);
    window = new CommittedWriteWindow(8);
    if (mode === 'cancel') {
      // Ordered fixture suppression, not an OS abort or guest cancel carrier.
      assert.equal(app.libCalls(), 0);
    } else if (mode === 'trap') {
      assert.throws(() => app.call(data, 1), WebAssembly.RuntimeError);
      assert.throws(() => app.call(data), e => e === -8);
      assert.equal(app.libCalls(), 1); // No replay after the trap.
    } else {
      const value = app.call(data);
      const expected = BigInt(bytes.reduce((a,b) => a+b, 0));
      assert.equal(value, expected);
      const encoded = new Uint8Array(8);
      new DataView(encoded.buffer).setBigInt64(0, value, true);
      window.commit([...encoded], 8);
      if (mode === 'readonly') {
        await assert.rejects(window.writeTo(output, 0), e => e === -2);
      } else {
        assert.equal(await window.writeTo(output, 0), 8);
        if (mode === 'sync-failure') {
          await assert.rejects(output.invokeSync(), e => e === -8);
          assert.equal(syncAttempts, 1); // Never retry sync or replay a written App.
        } else assert.equal(await output.invokeSync(), 0);
        assert.deepEqual(await readFile(outputPath), Buffer.from(encoded));
      }
      assert.equal(app.libCalls(), 1);
    }
    if (['cancel','trap','readonly'].includes(mode)) assert.equal((await readFile(outputPath)).length, 0);
    await input.release(); input = null;
    await output.release(); output = null;
    window.release(); window = null;
    app.release(); app = null;
    await root.release(); root = null;
    if (mode === 'normal') positives++; else negatives++;
  } finally {
    // Await actual close; cleanup failure rejects rather than claiming success.
    const closures = [];
    if (input) closures.push(input.release());
    if (output) closures.push(output.release());
    if (root) closures.push(root.release());
    const outcomes = await Promise.allSettled(closures);
    if (window) window.release();
    if (app) app.release();
    const failed = outcomes.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    await rm(dir, {recursive:true});
  }
}
for (const caller of [appBytes, rustBytes]) {
  for (const bytes of [[], [7], [1,2,3,255], Array.from({length:16}, (_,i) => i)]) await exercise(bytes, caller);
  for (const mode of ['cancel', 'trap', 'readonly', 'sync-failure']) await exercise([1,2,3,255], caller, mode);
}
console.log(JSON.stringify({accepted:true, scope:'real-file-app-lib-vertical-fixture',
  positive_paths:positives, negative_paths:negatives, independent_disk_oracle:true,
  sync_acknowledged:true, power_loss_proven:false, actual_read_settlement:true,
  cancelled_output_empty:true, post_trap_no_replay:true, uniform_v1_accepted:false,
  controlled_sync_failure_preserves_written_bytes:true, sync_failure_no_retry:true,
  native_parity:false, guest_initiates_io:false, callers:['wasmc','rust'],
  app_sha256:[sha(appBytes),sha(rustBytes)], lib_sha256:sha(libBytes),
  rust_source_sha256:sha(await readFile('host/scenarios/file-app.rs'))}));
