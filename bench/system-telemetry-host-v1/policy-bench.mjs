import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {compile} from '../../current/wasmc.mjs';

const source = await readFile(
  new URL('./policy.wasmc', import.meta.url),
  'utf8',
);

const compileStart = performance.now();
const wasm = await compile(source);
const compileMs = performance.now() - compileStart;
const module = new WebAssembly.Module(wasm);
assert.deepEqual(WebAssembly.Module.imports(module), []);

const instantiateStart = performance.now();
const instance = new WebAssembly.Instance(module, {});
const instantiateMs = performance.now() - instantiateStart;
const classify = instance.exports.classify;
assert.equal(typeof classify, 'function');

assert.equal(classify(25000, 8192, 1000, 0), 0);
assert.equal(classify(25000, 8192, 2000000, 0), 1);
assert.equal(classify(95000, 8192, 1000, 0), 2);
assert.equal(classify(25000, 256, 1000, 0), 3);
assert.equal(classify(25000, 8192, 1000, 1), 4);

for (let i = 0; i < 100000; i++) {
  classify(i % 100000, 8192, i & 2047, 0);
}

const iterations = 5000000;
let checksum = 0;
const started = process.hrtime.bigint();
for (let i = 0; i < iterations; i++) {
  checksum += classify(i % 100000, 8192, i & 2047, 0);
}
const elapsedNs = Number(process.hrtime.bigint() - started);
console.log(JSON.stringify({
  accepted: true,
  kind: 'wasmc-policy',
  imports: 0,
  wasm_bytes: wasm.byteLength,
  compile_ms: compileMs,
  instantiate_ms: instantiateMs,
  iterations,
  elapsed_ms: elapsedNs / 1e6,
  ns_per_call: elapsedNs / iterations,
  calls_per_sec: iterations * 1e9 / elapsedNs,
  checksum,
}));
