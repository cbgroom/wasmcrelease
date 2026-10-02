import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { all18Targets } from './future-lib-license-admission.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const catalog = read('catalog/libs-current-v2.json');
const projection = read('lib-ecosystem-control-plane.json');
const candidate = read('channels/candidates/0.0.20.json');
const ledger = read('catalog/current-v2-migration.json');
const release = read('release.json');
const productionFiles = new Map(candidate.product_files.map(row => [row.path, row]));

function validateCurrentSide(model, selected) {
  const identities = new Set(selected.packages.map(row => row.wit_package));
  assert.equal(identities.size, selected.packages.length, 'unique selected identities');
  assert.equal(model.inventory.current_side_install_catalog, selected.release_tag);
  assert.equal(model.inventory.current_side_installable, identities.size, 'selected count drift');
  assert.equal(model.inventory.current_side_inventory_matches_release,
    identities.size === model.inventory.released);
  let matched = 0;
  for (const row of model.packages) {
    const isSelected = identities.has(row.identity);
    const side = row.current_side_remediation;
    assert.equal(side.resolvable_installable, isSelected, `selected membership drift: ${row.identity}`);
    assert.equal(side.authority, isSelected ? 'catalog/libs-current-v2.json' : null,
      `selected authority drift: ${row.identity}`);
    if (isSelected) matched++;
  }
  assert.equal(matched, identities.size, 'selected identity absent from package projection');
}

// Current-side selection never promotes an immutable product lifecycle.
function validateFrozenProduct(model) {
  assert.equal(model.release.version, release.version);
  assert.equal(model.release.product_set_sha256, candidate.product_set_sha256);
  for (const row of model.packages) {
    const metadata = read(`${row.root}/lib.json`);
    const required = [`${row.root}/lib.json`, `${row.root}/${metadata.wit.path}`,
      `${row.root}/${metadata.artifact.path}`];
    if (metadata.component?.path) required.push(`${row.root}/${metadata.component.path}`);
    const included = required.every(path => {
      const pinned = productionFiles.get(path);
      if (!pinned) return false;
      const bytes = readFileSync(join(root, path));
      return bytes.length === pinned.bytes && digest(bytes) === pinned.sha256;
    });
    assert.equal(row.states.released, included, `frozen release inclusion drift: ${row.identity}`);
    assert.equal(row.current_side_remediation.included_in_immutable_tag, included,
      `immutable tag inclusion drift: ${row.identity}`);
  }
}

validateCurrentSide(projection, catalog);
validateFrozenProduct(projection);
assert.equal(all18Targets.length, 18, 'original future-admission denominator');
assert.deepEqual([...ledger.migrated, ...ledger.backlog].map(row => row.id).sort(),
  [...all18Targets], 'migration ledger must retain every original target');
assert.equal(ledger.migrated.length, catalog.packages.length);

const selectedRow = projection.packages.find(row =>
  catalog.packages.some(selected => selected.wit_package === row.identity));
const unselectedRow = projection.packages.find(row =>
  !catalog.packages.some(selected => selected.wit_package === row.identity));
assert(selectedRow && unselectedRow, 'positive and excluded package controls required');
const clone = value => structuredClone(value);
let negativeControls = 0;
function reject(mutate, validate, pattern) {
  const bad = clone(projection);
  mutate(bad);
  assert.throws(() => validate(bad), pattern);
  negativeControls++;
}
reject(model => { model.inventory.current_side_installable--; },
  model => validateCurrentSide(model, catalog), /selected count drift/);
reject(model => {
  model.packages.find(row => row.identity === selectedRow.identity)
    .current_side_remediation.resolvable_installable = false;
}, model => validateCurrentSide(model, catalog), /selected membership drift/);
reject(model => {
  model.packages.find(row => row.identity === unselectedRow.identity)
    .current_side_remediation.resolvable_installable = true;
}, model => validateCurrentSide(model, catalog), /selected membership drift/);
reject(model => {
  model.packages.find(row => row.identity === selectedRow.identity)
    .current_side_remediation.authority = 'catalog/libs-v018.json';
}, model => validateCurrentSide(model, catalog), /selected authority drift/);
reject(model => {
  model.packages.find(row => row.identity === selectedRow.identity).states.released = false;
}, validateFrozenProduct, /frozen release inclusion drift/);

const orphanCatalog = clone(catalog);
orphanCatalog.packages[0].wit_package = 'control:absent@0.0.1';
assert.throws(() => validateCurrentSide(projection, orphanCatalog), /selected membership drift/);
negativeControls++;

const generatedCheck = spawnSync(process.execPath,
  ['scripts/lib-ecosystem-control-plane.mjs', '--check'],
  { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 });
assert.equal(generatedCheck.status, 0, generatedCheck.stderr);
console.log(JSON.stringify({ accepted: true,
  catalog_packages: catalog.packages.length,
  projected_selected_packages: projection.inventory.current_side_installable,
  historical_release_packages: projection.inventory.released,
  future_admission_targets: all18Targets.length,
  negative_controls: negativeControls,
  generator_check: JSON.parse(generatedCheck.stdout).accepted,
  lifecycle_promoted: false, all18_qualified: false }));
