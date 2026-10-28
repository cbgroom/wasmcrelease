// Recover a normal refresh input from the pinned Text candidate's original Rust.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentProductReader} from '../../../../scripts/current-lib-release-v3.mjs';

const [rootArg, assemblyPin, output] = process.argv.slice(2);
assert.ok(isAbsolute(rootArg ?? '') && /^[a-f0-9]{64}$/.test(assemblyPin ?? '') && isAbsolute(output ?? ''));
const root = resolve(rootArg), read = currentProductReader(root);
const sha = b => createHash('sha256').update(b).digest('hex');
const assemblyBytes = read('admission/current-composition-assembly-v1.json');
assert.equal(sha(assemblyBytes), assemblyPin);
const assembly = JSON.parse(assemblyBytes), catalogBytes = read('catalog/libs-current-v2.json');
assert.equal(sha(catalogBytes), assembly.catalog_sha256);
const catalog = JSON.parse(catalogBytes), row = catalog.packages.find(x => x.id === 'wasmc-text');
assert.ok(row);
const projectionBytes = read(row.source.spec.path);
assert.equal(sha(projectionBytes), row.source.spec.sha256);
const projection = JSON.parse(projectionBytes);
assert.equal(projection.schema, 'wasmc.current-reexported-rust-producer-source/v1');
assert.equal(projection.version, '0.0.2');
const validator = resolve(import.meta.dirname, '../../../../scripts/validate-lib-refresh-v2-source.mjs');
const validated = spawnSync(process.execPath, [validator, '--candidate-assembly-sha256', assemblyPin],
  {cwd: root, encoding: 'utf8', timeout: 120000});
assert.equal(validated.status, 0, validated.stderr);
assert.equal(JSON.parse(validated.stdout).accepted, true);
const packet = projection.source_packet;
function pinned(relative) {
  const path = `${packet.root}/${relative}`;
  const pins = packet.files.filter(x => x.path === path); assert.equal(pins.length, 1);
  const bytes = read(path); assert.equal(bytes.length, pins[0].bytes); assert.equal(sha(bytes), pins[0].sha256);
  return bytes;
}
const original = pinned('original-authoring/text-adapter/src/lib.rs').toString('utf8');
const originalWit = pinned('original-authoring/lib.wit').toString('utf8');
const selectedWit = read(projection.wit.path);
assert.equal(selectedWit.length, projection.wit.bytes); assert.equal(sha(selectedWit), projection.wit.sha256);
assert.equal(originalWit.replace('package wasmc:text@0.0.1;', 'package wasmc:text@0.0.2;'), selectedWit.toString('utf8'));
const prefix = 'mod bindings { wit_bindgen::generate!({path:"../../lib.wit",world:"text-world"}); }\nuse bindings::exports::wasmc::text::text::Guest;\nstruct Component;\nimpl Guest for Component {\n';
const suffix = '}\nbindings::export!(Component with_types_in bindings);\n\n#[cfg(test)]\nmod tests;\n';
assert.ok(original.startsWith(prefix) && original.endsWith(suffix));
const body = original.slice(prefix.length, -suffix.length);
const adapter = Buffer.from('use crate::exports::wasmc::text::text::Guest;\npub struct Adapter;\nimpl Guest for Adapter {\n' + body + '}\n');
const spec = {schema:'wasmc.lib-refresh-source/v2', id:'wasmc-text', version:projection.version,
  profile:'value', crate:'wasmc_text_refresh_v2', artifact_name:'wasmc_text_refresh_v2',
  world:projection.world, description:projection.description, dependencies:['memchr'], apis:projection.apis};
const files = {'lib.json':Buffer.from(JSON.stringify(spec, null, 2)+'\n'), 'lib.wit':selectedWit,
  'adapter.rs':adapter, 'delta.rs':Buffer.from('// Text behavior is retained verbatim in adapter.rs.\n')};
assert.equal(sha(read('admission/current-composition-assembly-v1.json')), assemblyPin);
mkdirSync(output); // no overwrite of an existing directory
for (const [name, bytes] of Object.entries(files)) writeFileSync(join(output,name), bytes, {flag:'wx'});
console.log(JSON.stringify({schema:'wasmc.text-refresh-source/v1', assembly_sha256:assemblyPin,
  source_sha256:sha(Buffer.from(original)), unchanged_method_body_sha256:sha(Buffer.from(body)),
  wit_sha256:sha(selectedWit), files:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,sha(v)])),
  output, formal_release:false}));
