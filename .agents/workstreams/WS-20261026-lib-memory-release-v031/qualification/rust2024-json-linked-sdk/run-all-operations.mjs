import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const [root, guestPath] = process.argv.slice(2);
assert.ok(root && guestPath);
const sha = b => createHash('sha256').update(b).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'lib.json')));
const providerBytes = fs.readFileSync(path.join(root, 'artifact.wasm'));
const guestBytes = fs.readFileSync(guestPath);
assert.equal(sha(providerBytes), '09b833d6b1910ef1e345e73c9b2698deb6f78b6077e4ab31b3ed9c5e0c1e2c06');
assert.equal(sha(providerBytes), manifest.artifact.sha256);
assert.equal(sha(guestBytes), 'fa84817dad5b88b1a0b2fdcc0019716577931f0a82dccb4babd171121d800caf');
const provider = new WebAssembly.Instance(new WebAssembly.Module(providerBytes), {});
let app;
const view = lib => new DataView((lib ? provider.exports.memory : app.exports.memory).buffer);
const memory = {
  own_memory_size:()=>app.exports.memory.buffer.byteLength/65536,
  lib_memory_size:()=>provider.exports.memory.buffer.byteLength/65536,
  copy_to_lib:(d,s,n)=>new Uint8Array(provider.exports.memory.buffer).set(new Uint8Array(app.exports.memory.buffer,s>>>0,n>>>0),d>>>0),
  copy_from_lib:(d,s,n)=>new Uint8Array(app.exports.memory.buffer).set(new Uint8Array(provider.exports.memory.buffer,s>>>0,n>>>0),d>>>0),
};
for (const [prefix, lib] of [['',true],['own_',false]]) for (const width of [8,32,64]) {
  const get=width===8?'getUint8':width===32?'getInt32':'getBigInt64';
  const set=width===8?'setUint8':width===32?'setInt32':'setBigInt64';
  memory[prefix+'read'+width] = p => view(lib)[get](p>>>0,true);
  memory[prefix+'write'+width] = (p,v) => view(lib)[set](p>>>0,v,true);
}
const module = new WebAssembly.Module(guestBytes);
const imports = WebAssembly.Module.imports(module);
assert.ok(imports.length > 0);
assert.ok(imports.every(i => i.kind === 'function' && ['wasmc:private/canonical-memory@1','wasmc:lib/wasmc-json@0.2.1'].includes(i.module)), JSON.stringify(imports));
const bindings = {'wasmc:private/canonical-memory@1':memory,'wasmc:lib/wasmc-json@0.2.1':provider.exports};
for (const i of imports) assert.equal(typeof bindings[i.module]?.[i.name], 'function', `${i.module}/${i.name}`);
app = new WebAssembly.Instance(module, bindings);
for (let i=0;i<3;i++) assert.equal(app.exports.run(),26);
console.log(JSON.stringify({accepted:true,engine:globalThis.Deno?'deno':globalThis.Bun?'bun':'node',
  guest_sha256:sha(guestBytes), provider_sha256:sha(providerBytes), imports:imports.length,
  official_interface_imports:0, api_checks:26, same_instance_runs:3,
  source_rewrite_at_compile:false, host:'controlled canonical memory adapter', formal_release:false}));
