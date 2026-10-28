// Prepare a separate changed-source Rust build without touching the retained
// earlier producer workspace or pretending this is the complete cohort.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, lstatSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, join, resolve} from 'node:path';

const [baseline, activationFile, authoringReceipt, coreReceipt, out, activationPin, authoringPin, corePin] = process.argv.slice(2);
assert.ok([baseline, activationFile, authoringReceipt, coreReceipt, out].every(p => isAbsolute(p ?? '')));
assert.ok([activationPin, authoringPin, corePin].every(pin => /^[a-f0-9]{64}$/.test(pin ?? '')), 'independent receipt pins required');
assert.ok(!existsSync(out), 'output must be absent');
const sha = b => createHash('sha256').update(b).digest('hex');
const activationBytes = readFileSync(activationFile), authoringBytes = readFileSync(authoringReceipt), coreBytes = readFileSync(coreReceipt);
assert.equal(sha(activationBytes), activationPin); assert.equal(sha(authoringBytes), authoringPin); assert.equal(sha(coreBytes), corePin);
const activation = JSON.parse(activationBytes);
assert.equal(activation.schema, 'wasmc.std-map-root-activation/v1');
assert.equal(resolve(activation.workspace), resolve(baseline));
const inventory = (root, prefix = '') => {
  const dir = join(root, prefix);
  return readdirSync(dir).sort().flatMap(name => {
    const path = prefix ? `${prefix}/${name}` : name, st = lstatSync(join(root, path));
    assert.ok(!st.isSymbolicLink(), 'linked baseline input');
    if (st.isDirectory()) return inventory(root, path);
    assert.ok(st.isFile(), 'non-regular baseline input');
    return [path];
  });
};
assert.deepEqual(inventory(baseline).sort(), Object.keys(activation.inputs).sort(), 'baseline inventory drift');
for (const [path, expected] of Object.entries(activation.inputs)) {
  const absolute = join(baseline, path);
  assert.equal(sha(readFileSync(absolute)), expected, `baseline drift: ${path}`);
}
const recovered = JSON.parse(authoringBytes);
const core = JSON.parse(coreBytes);
assert.equal(recovered.schema, 'wasmc.rebound-authoring-and-json-differential/v1');
assert.equal(core.schema, 'wasmc.reexport-source-recovery/v1');
const dataCore = core.sources.find(row => row.id === 'wasmc-data-core');
assert.equal(dataCore.version, '0.0.2');
const coreWit = readFileSync(join(dataCore.output, 'lib.wit'));
assert.equal(sha(coreWit), dataCore.files['lib.wit']);
const prepared = [];
for (const id of ['wasmc-data-interchange', 'wasmc-data-relational']) {
  const row = recovered.rebound_sources.find(x => x.id === id);
  assert.equal(row.version, '0.1.1');
  assert.equal(row.wit_closure.normalized_sha256, row.wit_closure.delivered_sha256);
  const source = {};
  for (const name of ['delta.rs', 'adapter.rs', 'lib.wit', 'lib.json']) {
    source[name] = readFileSync(join(row.output, name));
    assert.equal(sha(source[name]), row.files[name]);
  }
  const spec = JSON.parse(source['lib.json']);
  assert.equal(spec.id, id); assert.equal(spec.version, '0.1.1');
  prepared.push({id, row, source, spec});
}
cpSync(baseline, out, {recursive: true, force: false, errorOnExist: true});
assert.deepEqual(inventory(out).sort(), Object.keys(activation.inputs).sort(), 'copied baseline inventory drift');
for (const [path, expected] of Object.entries(activation.inputs)) {
  assert.equal(sha(readFileSync(join(out, path))), expected, `copied baseline drift: ${path}`);
  assert.equal(sha(readFileSync(join(baseline, path))), expected, `baseline changed during copy: ${path}`);
}
let lock = readFileSync(join(out, 'Cargo.lock'), 'utf8');
for (const {id, source, spec} of prepared) {
  const crate = join(out, 'crates', id), manifest = join(crate, 'Cargo.toml');
  let cargo = readFileSync(manifest, 'utf8');
  assert.equal((cargo.match(/version = "0\.1\.0"/g) ?? []).length, 1);
  assert.equal((cargo.match(/edition = "2021"/g) ?? []).length, 1);
  cargo = cargo.replace('version = "0.1.0"', 'version = "0.1.1"').replace('edition = "2021"', 'edition = "2024"');
  assert.ok(cargo.includes(`name = "${spec.crate}"`));
  writeFileSync(manifest, cargo);
  for (const name of ['delta.rs', 'adapter.rs']) writeFileSync(join(crate, 'src', name), source[name]);
  writeFileSync(join(crate, 'wit/lib.wit'), source['lib.wit']);
  writeFileSync(join(crate, 'wit/deps/wasmc-data-core/lib.wit'), coreWit);
  const old = `name = "${spec.crate}"\nversion = "0.1.0"`;
  assert.equal(lock.split(old).length, 2, 'lock package identity');
  lock = lock.replace(old, `name = "${spec.crate}"\nversion = "0.1.1"`);
}
writeFileSync(join(out, 'Cargo.lock'), lock);
console.log(JSON.stringify({schema: 'wasmc.rebound-rust2024-workspace/v1', baseline_activation_sha256: activationPin,
  source_receipt_sha256: authoringPin, datacore_receipt_sha256: corePin,
  source_ids: prepared.map(({id, row}) => ({id, files: row.files})), datacore_wit_sha256: sha(coreWit),
  cargo_lock_sha256: sha(Buffer.from(lock)), edition: '2024', output: out,
  complete_cohort: false, formal_release: false}));
