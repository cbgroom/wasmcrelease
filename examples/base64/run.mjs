import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {resolveCurrentPackage} from '../../scripts/current-lib-release-v3.mjs';

const providerBytes = await readFile(new URL('../../current/lib_core.wasm', import.meta.url));
const args=process.argv.slice(2);
assert.ok(args.length===0 || args.length===2 && args[0]==='--installed' && args[1]);
const installed=args.length?resolve(args[1]):null;
const root='current-libs/wasmc-std/1.4.1';
if(installed) {
  resolveCurrentPackage(readFileSync(new URL('../../catalog/libs-current-v2.json',import.meta.url)),
    '01fda278b3c74363643879f71cc739488a57e9d934f217ab07af3460b88923d4',
    {id:'wasmc-std',version:'1.4.1',manifest_sha256:'9db63b4f380f9a8fb7541addfde6608bbc48b3267ad903f838afedb98e74ebfc',root_inventory_sha256:'6978407b51e835a3893ac14cbb7ca2c46da48d0a778f2611f6de829af07bdf92'},
    path=>readFileSync(resolve(installed,path)));
}
const libBytes=installed?readFileSync(resolve(installed,root,'artifact.wasm')):
  await readFile(new URL('../../'+root+'/artifact.wasm',import.meta.url));
assert.equal(createHash('sha256').update(providerBytes).digest('hex'), 'c3ac42b93f4c27e24065abe804b91f54761eff782e2971e947847b3d20ee7e00');
assert.equal(createHash('sha256').update(libBytes).digest('hex'), 'b79a499c8300361125e7fcdae02170184b82d4bbeff4d8f24ed95f3fd4db8d3b');
const providerModule = new WebAssembly.Module(providerBytes);
assert.deepEqual(WebAssembly.Module.imports(providerModule), []);
const provider = new WebAssembly.Instance(providerModule, {});
assert.equal(provider.exports.provider_domain_init(127, 7), 0);
const libModule = new WebAssembly.Module(libBytes);
const imports = WebAssembly.Module.imports(libModule);
assert.ok(imports.length > 0);
assert.ok(imports.every(row => row.module === 'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0'));
const lib = new WebAssembly.Instance(libModule, {
  'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0': provider.exports
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

const rounds=256;
let explicitDrops=0;
let providerBytesAfterWarmup;
for(let round=0;round<rounds;round++) {
  const input=makeBuffer(new TextEncoder().encode('abc'));
  const encoded=makeBuffer([]),decoded=makeBuffer([]),invalid=makeBuffer([63]);
  assert.equal(lib.exports.std_base64_try_encode_standard(input,encoded),1n);
  assert.equal(new TextDecoder().decode(readBuffer(encoded)),'YWJj');
  assert.equal(lib.exports.std_base64_try_decode_standard(encoded,decoded),1n);
  assert.equal(new TextDecoder().decode(readBuffer(decoded)),'abc');
  assert.equal(lib.exports.std_base64_try_decode_standard(invalid,decoded),0n);
  for(const handle of [invalid,decoded,encoded,input]) {
    assert.equal(lib.exports.std_bytes_drop(handle),0);explicitDrops++;
  }
  if(round===0)providerBytesAfterWarmup=provider.exports.memory.buffer.byteLength;
  assert.equal(provider.exports.memory.buffer.byteLength,providerBytesAfterWarmup);
}

console.log(JSON.stringify({
  accepted: true,
  installed_root_verified:installed!==null, rounds, explicit_drops:explicitDrops, invalid_input_rejected:true, persistent_provider_memory_bytes:providerBytesAfterWarmup,
  package: 'wasmc:std@1.4.1',
  apis: [
    'wasmc:std@1.4.1/base64#try-encode-standard',
    'wasmc:std@1.4.1/base64#try-decode-standard'
  ],
  artifact_sha256: createHash('sha256').update(libBytes).digest('hex'),
  import_module: 'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0',
  input_utf8: 'abc',
  encoded_utf8: 'YWJj',
  decoded_utf8: 'abc'
}));
