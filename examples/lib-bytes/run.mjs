import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { resolveCurrentPackage } from '../../scripts/current-lib-release-v3.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(resolve(root, path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2), opts = {};
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: node examples/lib-bytes/run.mjs --codec CODEC --text TEXT\nCODEC: base64 or hex. Verifies the selected Root and imports, tests the roundtrip and invalid input, and drops owned resources.');
  process.exit(0);
}
for (let i = 0; i < args.length; i += 2) opts[args[i]] = args[i + 1];
const codec = opts['--codec'], text = opts['--text'];
assert.ok(['base64', 'hex'].includes(codec) && typeof text === 'string');
const release = JSON.parse(read('release.json')), candidate = JSON.parse(read(release.staged_product_manifest));
const catalogBytes = read('catalog/libs-current-v2.json'), catalog = JSON.parse(catalogBytes);
const std = catalog.packages.find(row => row.id === 'wasmc-std');
resolveCurrentPackage(catalogBytes, candidate.current_catalog.sha256,
  { id: std.id, version: std.version, manifest_sha256: std.manifest_sha256, root_inventory_sha256: std.root_inventory_sha256 }, read);
const carrier = JSON.parse(read('current/compiler-release.json'));
const providerPin = carrier.artifacts.find(row => row.path === 'current/lib_core.wasm');
const providerBytes = read(providerPin.path), libBytes = read(std.root + '/' + std.delivery.artifact.path);
assert.equal(sha(providerBytes), providerPin.sha256); assert.equal(sha(libBytes), std.delivery.artifact.sha256);
const providerModule = new WebAssembly.Module(providerBytes); assert.deepEqual(WebAssembly.Module.imports(providerModule), []);
const provider = new WebAssembly.Instance(providerModule, {}); assert.equal(provider.exports.provider_domain_init(127, 7), 0);
const libModule = new WebAssembly.Module(libBytes), imports = WebAssembly.Module.imports(libModule);
const providerIdentity = 'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0';
assert.ok(imports.length > 0 && imports.every(row => row.module === providerIdentity && row.kind === 'function' && typeof provider.exports[row.name] === 'function'));
const lib = new WebAssembly.Instance(libModule, { [providerIdentity]: provider.exports }); assert.equal(lib.exports.std_init(), 0);
const makeBuffer = bytes => { const handle = lib.exports.std_bytes_new(); for (const byte of bytes) assert.equal(lib.exports.std_bytes_push(handle, byte), 0); return handle; };
const readBuffer = handle => Uint8Array.from({ length: Number(lib.exports.std_bytes_len(handle)) }, (_, i) => {
  const value = lib.exports.std_bytes_byte_at(handle, i); assert.equal(value >> 32n, 1n); return Number(value & 255n);
});
const names = codec === 'hex' ? ['std_hex_try_encode_lower', 'std_hex_try_decode'] : ['std_base64_try_encode_standard', 'std_base64_try_decode_standard'];
const expected = Buffer.from(text, 'utf8').toString(codec), rounds = 256; let drops = 0, memory;
for (let round = 0; round < rounds; round++) {
  const owned = [];
  try {
    const input = makeBuffer(new TextEncoder().encode(text)), encoded = makeBuffer([]), decoded = makeBuffer([]), invalid = makeBuffer([63]);
    owned.push(input, encoded, decoded, invalid);
    assert.equal(lib.exports[names[0]](input, encoded), 1n); assert.equal(new TextDecoder().decode(readBuffer(encoded)), expected);
    assert.equal(lib.exports[names[1]](encoded, decoded), 1n); assert.equal(new TextDecoder().decode(readBuffer(decoded)), text);
    assert.equal(lib.exports[names[1]](invalid, decoded), 0n);
  } finally { for (const handle of owned.reverse()) { assert.equal(lib.exports.std_bytes_drop(handle), 0); drops++; } }
  memory ??= provider.exports.memory.buffer.byteLength; assert.equal(provider.exports.memory.buffer.byteLength, memory);
}
console.log(JSON.stringify({ accepted: true, codec, package: `wasmc:std@${std.version}`,
  apis: names.map(name => `wasmc:std@${std.version}/${codec}#` + name.slice(('std_' + codec + '_').length).replaceAll('_', '-')),
  input_utf8: text, encoded_utf8: expected, decoded_utf8: text, imports_verified: true,
  selected_Root_verified: true, invalid_input_rejected: true, rounds, explicit_drops: drops, persistent_provider_memory_bytes: memory }));
