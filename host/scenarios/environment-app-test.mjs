// Restricted synchronous conformance profile, NOT the accepted v1 resource ABI.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from '../../current/wasmc.mjs';
import {createHash} from 'node:crypto';
const root = new URL('../../', import.meta.url);
const sha = b => createHash('sha256').update(b).digest('hex');
const libBytes = await readFile(new URL('libs/wasmc-owned-algorithms/artifact.wasm', root));
assert.equal(sha(libBytes), '44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
const source = await readFile(new URL('host/scenarios/environment-app.wasmc', root), 'utf8');
const rustSource = await readFile(new URL('host/scenarios/environment-app.rs', root));
const compilerBytes = await readFile(new URL('current/wasmc_compiler.wasm', root));
const apps = [await compile(source), await readFile(process.argv[2])];
for (const bytes of apps) {
  const imports = WebAssembly.Module.imports(new WebAssembly.Module(bytes));
  assert.deepEqual(imports.map(i=>`${i.module}/${i.name}/${i.kind}`).sort(),
    ['clock_read','entropy_fill','nonce_sum'].map(n=>`environment/${n}/function`).sort());
}
let realCalls = 0, negativeControls = 0;
async function run(bytes, {grant = true, entropy = true, replay} = {}) {
  const {instance:lib} = await WebAssembly.instantiate(libBytes, {});
  const ptr = lib.exports.cabi_realloc(0, 0, 4, 64);
  const trace = [], nonce = new Uint8Array(16);
  let filled = false, released = false, reads = 0, libCalls = 0;
  const check = () => { if (released) throw Error('invalid-resource'); if (!grant) throw Error('permission-denied'); };
  const environment = {
    clock_read() {
      check();
      const value = replay ? replay.clocks[reads] : BigInt(Math.floor(performance.now() * 1000));
      assert.ok(value >= 0n); reads++; trace.push(['clock-read', value]); return value;
    },
    entropy_fill() {
      check();
      if (!entropy) throw Error('unsupported');
      if (filled) throw Error('busy');
      if (replay) nonce.set(replay.nonce); else globalThis.crypto.getRandomValues(nonce);
      const view = new DataView(lib.exports.memory.buffer);
      nonce.forEach((b,i)=>view.setInt32(ptr + 4*i, b, true));
      filled = true; trace.push(['entropy-fill', 16]); return 16;
    },
    nonce_sum() {
      check(); if (!filled) throw Error('busy');
      libCalls++; trace.push(['lib-sum', 16]); return lib.exports['sum-s32'](ptr, 16);
    },
  };
  try {
    const {instance:app} = await WebAssembly.instantiate(bytes, {environment});
    const value = app.exports.run();
    assert.equal(value, BigInt(nonce.reduce((a,b)=>a+b,0)));
    assert.equal(reads, 2); assert.equal(libCalls, 1);
    return {value, trace};
  } catch(e) {
    assert.equal(libCalls, 0); throw e;
  } finally {
    released = true; nonce.fill(0); lib.exports.cabi_realloc(ptr, 64, 4, 0);
    assert.throws(environment.clock_read, /invalid-resource/);
  }
}
// Both callers execute real sources independently. Equivalence replays a captured
// real sample only for the pure consumer oracle, never as real-entropy evidence.
for(let i=0;i<32;i++) {
  for(const app of apps) { await run(app); realCalls++; }
}
// Capture outside run because owned scratch is zeroed during cleanup.
const replay = {clocks:[BigInt(Math.floor(performance.now()*1000))], nonce:new Uint8Array(16)};
globalThis.crypto.getRandomValues(replay.nonce); replay.clocks.push(BigInt(Math.floor(performance.now()*1000)));
const a = await run(apps[0], {replay}), b = await run(apps[1], {replay});
assert.equal(a.value, b.value); assert.deepEqual(a.trace, b.trace); replay.nonce.fill(0);
for(const app of apps) {
  await assert.rejects(run(app, {grant:false}), /permission-denied/); negativeControls++;
  await assert.rejects(run(app, {entropy:false}), /unsupported/); negativeControls++;
}
console.log(JSON.stringify({accepted:true, scope:'restricted-synchronous-app-lib-host-profile',
  real_source_app_calls:realCalls, paired_replay_oracles:1, negative_controls:negativeControls,
  lib_sha256:sha(libBytes), app_sha256:apps.map(sha), source_sha256:sha(source),
  rust_source_sha256:sha(rustSource), compiler_sha256:sha(compilerBytes),
  uniform_v1_execution:false, native_engine_execution:false, entropy_quality_proven:false}));
