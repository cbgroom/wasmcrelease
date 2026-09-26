import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const providerBytes = await readFile(new URL('../../standard/corelib/4.8.0/corelib.wasm', import.meta.url));
const libBytes = await readFile(new URL('../../standard/wasmc-std/1.4.0/artifact.wasm', import.meta.url));
assert.equal(createHash('sha256').update(providerBytes).digest('hex'), 'f54a892aff9068e5c79464029423a2e8f753ddb44010af9ac34a5c9efce2069c');
assert.equal(createHash('sha256').update(libBytes).digest('hex'), 'f8a8ce447f776a47680e02e19ea3a69827edbbc46e01985803ce3d3df51178d7');
const providerModule = new WebAssembly.Module(providerBytes);
assert.deepEqual(WebAssembly.Module.imports(providerModule), []);
const provider = new WebAssembly.Instance(providerModule, {});
assert.equal(provider.exports.provider_domain_init(127, 7), 0);
const libModule = new WebAssembly.Module(libBytes);
const imports = WebAssembly.Module.imports(libModule);
assert.ok(imports.length > 0);
assert.ok(imports.every(row => row.module === 'wasmc:lib/wasmc.lib_managed_object_heap@4.8.0'));
const lib = new WebAssembly.Instance(libModule, {
  'wasmc:lib/wasmc.lib_managed_object_heap@4.8.0': provider.exports
});
assert.equal(lib.exports.std_init(), 0);

const readBuffer = handle => {
  const length = Number(lib.exports.std_bytes_len(handle));
  return Uint8Array.from({ length }, (_, index) => {
    const option = lib.exports.std_bytes_byte_at(handle, index);
    assert.equal(option >> 32n, 1n);
    return Number(option & 0xffn);
  });
};
const makeBuffer = bytes => {
  const handle = lib.exports.std_bytes_new();
  for (const byte of bytes) assert.equal(lib.exports.std_bytes_push(handle, byte), 0);
  return handle;
};

const input = makeBuffer(new TextEncoder().encode('abc'));
const encoded = makeBuffer([]);
const decoded = makeBuffer([]);
assert.equal(lib.exports.std_base64_try_encode_standard(input, encoded), 1n);
assert.equal(new TextDecoder().decode(readBuffer(encoded)), 'YWJj');
assert.equal(lib.exports.std_base64_try_decode_standard(encoded, decoded), 1n);
assert.equal(new TextDecoder().decode(readBuffer(decoded)), 'abc');
for (const handle of [decoded, encoded, input]) assert.equal(lib.exports.std_bytes_drop(handle), 0);

console.log(JSON.stringify({
  accepted: true,
  package: 'wasmc:std@1.4.0',
  apis: [
    'wasmc:std@1.4.0/base64#try-encode-standard',
    'wasmc:std@1.4.0/base64#try-decode-standard'
  ],
  artifact_sha256: createHash('sha256').update(libBytes).digest('hex'),
  import_module: 'wasmc:lib/wasmc.lib_managed_object_heap@4.8.0',
  input_utf8: 'abc',
  encoded_utf8: 'YWJj',
  decoded_utf8: 'abc'
}));
