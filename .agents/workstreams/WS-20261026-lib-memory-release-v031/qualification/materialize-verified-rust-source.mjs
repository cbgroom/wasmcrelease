// Recover a separately named four-file authoring source from a fully verified
// candidate composition. This does not change the selected product or publish it.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentProductReader} from '../../../../scripts/current-lib-release-v3.mjs';

const [rootArg, assemblyPin, id, output] = process.argv.slice(2);
assert.ok(isAbsolute(rootArg ?? '') && /^[a-f0-9]{64}$/.test(assemblyPin ?? '') &&
  /^wasmc-[a-z0-9-]+$/.test(id ?? '') && isAbsolute(output ?? ''),
  'usage: materialize-verified-rust-source.mjs ASSEMBLED_ROOT ASSEMBLY_SHA256 LIB_ID ABSENT_OUTPUT');
const root = resolve(rootArg), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = currentProductReader(root);
const assemblyBytes = read('admission/current-composition-assembly-v1.json');
assert.equal(sha(assemblyBytes), assemblyPin, 'independent assembly pin');
const assembly = JSON.parse(assemblyBytes);
assert.equal(assembly.accepted, true);
assert.equal(assembly.formal_release, false);
const catalogBytes = read('catalog/libs-current-v2.json');
assert.equal(sha(catalogBytes), assembly.catalog_sha256, 'catalog pin');
const catalog = JSON.parse(catalogBytes);
const packageRow = catalog.packages.find(row => row.id === id);
assert.ok(packageRow, 'missing package');
const projectedBytes = read(packageRow.source.spec.path);
assert.equal(sha(projectedBytes), packageRow.source.spec.sha256, 'projected spec pin');
const projected = JSON.parse(projectedBytes);
assert.equal(projected.schema, 'wasmc.current-built-rust-producer-source/v1');
assert.equal(projected.id, id);
const validator = resolve(import.meta.dirname, '../../../../scripts/validate-lib-refresh-v2-source.mjs');
const validation = spawnSync(process.execPath, [validator, '--candidate-assembly-sha256', assemblyPin],
  {cwd: root, encoding: 'utf8', timeout: 120000});
assert.equal(validation.status, 0, `full candidate source verification failed: ${validation.stderr}`);
const report = JSON.parse(validation.stdout);
assert.equal(report.accepted, true);
assert.equal(report.composition_catalog_sha256, assembly.catalog_sha256);
const packet = projected.source_packet;
assert.ok(packet && Array.isArray(packet.files));
const files = {};
for (const name of ['adapter.rs', 'delta.rs', 'lib.json', 'lib.wit']) {
  const path = `${packet.root}/${name}`;
  const matches = packet.files.filter(item => item.path === path);
  assert.equal(matches.length, 1, `missing unique ${name}`);
  const file = read(path), pin = matches[0];
  assert.equal(file.length, pin.bytes, `size drift: ${name}`);
  assert.equal(sha(file), pin.sha256, `digest drift: ${name}`);
  files[name] = file;
}
const spec = JSON.parse(files['lib.json']);
assert.equal(spec.schema, 'wasmc.lib-refresh-source/v2');
assert.equal(spec.id, id);
assert.equal(spec.version, projected.version);
assert.equal(spec.profile, projected.profile);
assert.equal(spec.world, projected.world);
// Recheck independently pinned identity after reading all input bytes.
assert.equal(sha(read('admission/current-composition-assembly-v1.json')), assemblyPin);
assert.equal(sha(read('catalog/libs-current-v2.json')), assembly.catalog_sha256);
assert.equal(sha(read(packageRow.source.spec.path)), sha(projectedBytes));
mkdirSync(output); // fails if present; never replaces existing work
for (const [name, bytes] of Object.entries(files)) writeFileSync(join(output, name), bytes, {flag: 'wx'});
console.log(JSON.stringify({schema: 'wasmc.verified-authoring-source/v1', id, version: spec.version,
  assembly_sha256: assemblyPin, catalog_sha256: assembly.catalog_sha256,
  source_packet_inventory_sha256: packet.inventory_sha256,
  files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, sha(bytes)])),
  output, formal_release: false}));
