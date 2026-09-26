import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { compile, inspectWasm } from '../../current/wasmc.mjs';

const source = await readFile(new URL('pair.wasmc', import.meta.url), 'utf8');
const bytes = await compile(source);
const inspected = inspectWasm(bytes);
assert.equal(bytes.length, 49);
assert.equal(createHash('sha256').update(bytes).digest('hex'), '55f3c7e3d09b564b89b8268299a69569a33b856b46405cb4c4dd51634afec84e');
assert.deepEqual(inspected.imports, []);
assert.deepEqual(inspected.exports, [{ name: 'run', kind: 'function' }]);
const instance = await WebAssembly.instantiate(inspected.module, {});
assert.deepEqual(instance.exports.run(5, true), [1, 1]);
console.log(JSON.stringify({
  accepted: true,
  source: 'examples/agent-quickstart/pair.wasmc',
  core_bytes: bytes.length,
  core_sha256: createHash('sha256').update(bytes).digest('hex'),
  imports: inspected.imports,
  exports: inspected.exports,
  call: 'run(5, true)',
  result: instance.exports.run(5, true)
}));
