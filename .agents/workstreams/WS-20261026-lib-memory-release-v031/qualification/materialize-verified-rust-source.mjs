// Recover a separately named four-file authoring source from a fully verified
// candidate composition. This does not change the selected product or publish it.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentProductReader, currentProductPaths} from '../../../../scripts/current-lib-release-v3.mjs';
import {digest} from '../../../../scripts/lib-refresh-cache-v2.mjs';
import {verifyWitClosure} from '../../../../scripts/lib-wit-closure-v2.mjs';

const [rootArg, assemblyPin, id, output, toolPath, toolPin] = process.argv.slice(2);
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
assert.ok(['wasmc.current-built-rust-producer-source/v1', 'wasmc.current-wit-rebind-producer-source/v1',
  'wasmc.current-cohort-reexport-producer-source/v1'].includes(projected.schema), 'unsupported source projection');
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
const rebound = projected.schema === 'wasmc.current-wit-rebind-producer-source/v1';
const reexport = projected.schema === 'wasmc.current-cohort-reexport-producer-source/v1';
let parent = null;
if (rebound) {
  const parentPath = `${packet.root}/parent-selection.json`;
  const parentPin = packet.files.find(item => item.path === parentPath);
  assert.ok(parentPin, 'parent selection missing');
  const parentBytes = read(parentPath);
  assert.equal(parentBytes.length, parentPin.bytes); assert.equal(sha(parentBytes), parentPin.sha256);
  parent = JSON.parse(parentBytes);
  assert.ok(['wasmc.changed-rust-lib-source-input/v1', 'wasmc.cohort-reexport-source-input/v1'].includes(parent.source.schema));
  assert.equal(parent.id, id);
}
const fromBase = reexport || (rebound && parent.source.schema === 'wasmc.cohort-reexport-source-input/v1');
let baseSourceFingerprint = null;
let baseVersion = null;
if (fromBase) {
  const cohort = JSON.parse(read(catalog.cohort.path));
  assert.equal(sha(read(catalog.cohort.path)), catalog.cohort.sha256);
  const prefix = cohort.input_prefix, base = cohort.composition.base;
  const baseCatalogBytes = read(`${prefix}/${base.catalog.path}`);
  assert.equal(sha(baseCatalogBytes), base.catalog.sha256);
  const baseCatalog = JSON.parse(baseCatalogBytes), indexBytes = read(`${prefix}/${base.index.path}`);
  assert.equal(sha(indexBytes), base.index.sha256);
  const index = JSON.parse(indexBytes), original = {};
  for (const row of baseCatalog.packages) {
    const directory = row.source.spec.path.slice(0, -'/lib.json'.length);
    for (const full of currentProductPaths(root, `${prefix}/${directory}`)) {
      assert.ok(full.startsWith(`${prefix}/`));
      original[full.slice(prefix.length + 1)] = sha(read(full));
    }
  }
  const ordered = Object.fromEntries(Object.entries(original).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  baseSourceFingerprint = digest(ordered);
  assert.equal(baseSourceFingerprint, index.source_fingerprint, 'original complete authoring fingerprint');
  const baseCohortBytes = read(`${prefix}/${base.cohort.path}`);
  assert.equal(sha(baseCohortBytes), base.cohort.sha256);
  const baseCohort = JSON.parse(baseCohortBytes);
  assert.equal(baseCohort.source_fingerprint, baseSourceFingerprint);
  assert.equal(baseCohort.q0_accepted, true);
  const old = baseCatalog.packages.find(row => row.id === id);
  assert.ok(old && old.profile === 'value'); baseVersion = old.version;
  const oldManifestBytes = read(`${prefix}/${old.root}/lib.json`);
  assert.equal(sha(oldManifestBytes), old.manifest_sha256);
  const oldManifest = JSON.parse(oldManifestBytes);
  const implementationPath = `${packet.root}/${rebound ? 'parent-source/' : ''}implementation.wasm`;
  const implementationPin = packet.files.find(item => item.path === implementationPath);
  assert.ok(implementationPin, 'base implementation missing');
  const implementation = read(implementationPath);
  assert.equal(implementation.length, implementationPin.bytes);
  assert.equal(sha(implementation), implementationPin.sha256);
  assert.equal(sha(implementation), oldManifest.artifact.sha256, 'base artifact identity');
  for (const name of ['adapter.rs', 'delta.rs', 'lib.json', 'lib.wit']) {
    const path = `libspec/${id}/${name}`;
    assert.ok(ordered[path], `base authored ${name} missing`);
    files[name] = read(`${prefix}/${path}`);
    assert.equal(sha(files[name]), ordered[path]);
  }
}
if (!fromBase) {
for (const name of ['adapter.rs', 'delta.rs', 'lib.json', 'lib.wit']) {
  const path = `${packet.root}/${rebound ? 'parent-source/' : ''}${name}`;
  const matches = packet.files.filter(item => item.path === path);
  assert.equal(matches.length, 1, `missing unique ${name}`);
  const file = read(path), pin = matches[0];
  assert.equal(file.length, pin.bytes, `size drift: ${name}`);
  assert.equal(sha(file), pin.sha256, `digest drift: ${name}`);
  files[name] = file;
}
}
const spec = JSON.parse(files['lib.json']);
assert.equal(spec.schema, 'wasmc.lib-refresh-source/v2');
assert.equal(spec.id, id);
assert.equal(spec.profile, projected.profile);
assert.equal(spec.world, projected.world);
let closure = null;
if (rebound || reexport) {
  assert.equal(spec.version, fromBase ? baseVersion : parent.version);
  assert.deepEqual(spec.apis.map(a => a.api).sort(), projected.apis.map(a => a.api).sort());
  if (!fromBase) { assert.deepEqual(spec.apis, projected.apis); assert.equal(spec.description, projected.description); }
  assert.deepEqual(spec.wit_dependencies ?? [], rebound ? ['wasmc-data-core'] : []);
  const dependencies = [];
  if (rebound) {
    const selectedDependency = catalog.packages.find(row => row.id === 'wasmc-data-core');
    assert.ok(selectedDependency && selectedDependency.version === '0.0.2');
    const dependency = read(selectedDependency.source.wit.path);
    assert.equal(dependency.length, selectedDependency.source.wit.bytes);
    assert.equal(sha(dependency), selectedDependency.source.wit.sha256);
    dependencies.push({id: 'wasmc-data-core', bytes: dependency});
  }
  const packageName = id.slice('wasmc-'.length);
  const original = files['lib.wit'].toString('utf8');
  const oldPackage = `package wasmc:${packageName}@${spec.version};`;
  const oldDependency = 'wasmc:data-core/types@0.0.1';
  assert.equal(original.split(oldPackage).length, 2, 'parent package occurrence');
  if (rebound) assert.ok(original.includes(oldDependency), 'parent dependency identity missing');
  let author = original.replace(oldPackage, `package wasmc:${packageName}@${projected.version};`);
  if (rebound) author = author.replaceAll(oldDependency, 'wasmc:data-core/types@0.0.2');
  const authorWit = Buffer.from(author);
  const delivered = read(projected.wit.path);
  assert.equal(delivered.length, projected.wit.bytes); assert.equal(sha(delivered), projected.wit.sha256);
  closure = await verifyWitClosure(authorWit, dependencies, delivered,
    {path: toolPath, sha256: toolPin});
  spec.version = projected.version;
  if (fromBase) { spec.description = projected.description; spec.apis = projected.apis; }
  files['lib.json'] = Buffer.from(JSON.stringify(spec, null, 2) + '\n');
  files['lib.wit'] = authorWit;
} else {
  assert.equal(spec.version, projected.version);
}
// Recheck independently pinned identity after reading all input bytes.
assert.equal(sha(read('admission/current-composition-assembly-v1.json')), assemblyPin);
assert.equal(sha(read('catalog/libs-current-v2.json')), assembly.catalog_sha256);
assert.equal(sha(read(packageRow.source.spec.path)), sha(projectedBytes));
mkdirSync(output); // fails if present; never replaces existing work
for (const [name, bytes] of Object.entries(files)) writeFileSync(join(output, name), bytes, {flag: 'wx'});
console.log(JSON.stringify({schema: 'wasmc.verified-authoring-source/v1', id, version: spec.version,
  assembly_sha256: assemblyPin, catalog_sha256: assembly.catalog_sha256,
  source_packet_inventory_sha256: packet.inventory_sha256,
  base_source_fingerprint: baseSourceFingerprint,
  files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, sha(bytes)])),
  wit_closure: closure,
  output, formal_release: false}));
