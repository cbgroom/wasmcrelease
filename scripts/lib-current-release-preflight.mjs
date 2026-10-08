// New-product identity/build gate. It does not admit, publish or install a
// product. Old product/catalog PASS and hand-edited booleans are not inputs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityCoverage } from './validate-lib-identity-coverage.mjs';
import { assertRetiredAuthoringAbsent } from './validate-current-only-libs.mjs';
import { currentIndex } from './lib-current-index-v2.mjs';
import { generatedLib } from './generated-lib-v2.mjs';
import { sha, digest, inventory } from './lib-refresh-cache-v2.mjs';

const generatorFiles = ['lib-refresh-v2.mjs', 'lib-refresh-runner-v2.mjs',
  'lib-refresh-cache-v2.mjs', 'lib-refresh-native-v2.mjs', 'lib-refresh-resource-core-v2.mjs', 'lib-refresh-upstream-source-v2.mjs'];
const pin = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const sorted = values => [...values].sort();

export function currentReleaseArguments(argv) {
  const options = {};
  const names = { '--current-run': 'run_root', '--current-receipt-sha256': 'receipt_sha256',
    '--current-producer-sha256': 'producer_sha256', '--wit-tool':'wit_tool', '--wit-tool-sha256':'wit_tool_sha256' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = names[argv[i]];
    assert.ok(key && !(key in options) && argv[i + 1] && !argv[i + 1].startsWith('--'),
      'unknown, duplicate or missing current-release argument');
    options[key] = argv[i + 1];
  }
  return options;
}

export async function currentReleasePreflight(repo, options = {}) {
  repo = resolve(repo);
  const report = { schema: 'wasmc.current-release-preflight/v1', accepted: false,
    identity_and_build_complete: false, public_admission: false, released: false,
    checks: [], blockers: [], packages: [], scope: 'current source identities and pinned whole-cohort Q0 only' };
  const check = async (id, action) => {
    try { const result = await action(); report.checks.push({ id, pass: true }); return result; }
    catch (error) { report.checks.push({ id, pass: false });
      report.blockers.push({ id, detail: error.message }); return null; }
  };
  const coverage = await check('current-identity-union', () => identityCoverage(repo));
  report.coverage = coverage;
  if (coverage && !coverage.implementation_complete)
    report.blockers.push({ id: 'pending-implementations', identities: coverage.pending });
  await check('no-legacy-source-tree', () => assertRetiredAuthoringAbsent(repo));
  const optionsValid = await check('independent-current-build-pins', async () => {
    assert.ok(options.run_root && isAbsolute(options.run_root), 'absolute current run required');
    assert.ok(pin(options.receipt_sha256), 'independent refresh receipt SHA256 required');
    assert.ok(pin(options.producer_sha256), 'independent producer SHA256 required');
    const extra=options.wit_tool===undefined?[]:['wit_tool','wit_tool_sha256'];
    assert.deepEqual(Object.keys(options).sort(), ['producer_sha256', 'receipt_sha256', 'run_root',...extra].sort());
    if(extra.length) assert.ok(isAbsolute(options.wit_tool)&&pin(options.wit_tool_sha256),'explicit WIT tool identity required');
    return true;
  });
  let receipt, index;
  if (optionsValid && coverage) {
    receipt = await check('full-current-refresh', async () => {
      const run = resolve(options.run_root);
      const bytes = await readFile(join(run, 'refresh-receipt.json'));
      assert.equal(sha(bytes), options.receipt_sha256, 'refresh receipt pin mismatch');
      const value = JSON.parse(bytes);
      assert.equal(value.schema, 'wasmc.lib-refresh-receipt/v2');
      assert.equal(value.accepted, true, 'partial refresh is not a product input');
      assert.equal(resolve(value.run_root), run, 'refresh run locator mismatch');
      assert.equal(value.producer?.sha256, options.producer_sha256, 'producer pin mismatch');
      assert.deepEqual(sorted(value.selected), coverage.current_ids, 'whole current cohort must be selected');
      assert.deepEqual(sorted(value.rows.map(row => row.id)), coverage.current_ids,
        'missing, extra or duplicate package rows');
      for (const row of value.rows) assert.equal(row.state, 'verified', row.id + ': incomplete package');
      for (const file of generatorFiles) {
        const expected = sha(await readFile(join(repo, 'scripts', file)));
        assert.equal(value.generator_digests?.[file], expected, 'stale refresh generator: ' + file);
      }
      assert.equal(value.source_digests?.['libspec/registry.json'],
        sha(await readFile(join(repo, 'libspec/registry.json'))), 'stale full registry');
      return value;
    });
    if (receipt) {
      index = await check('current-source-and-WIT-routes', () => currentIndex(repo, [{
        run_root: options.run_root, receipt_sha256: options.receipt_sha256,
      }],options.wit_tool?{path:options.wit_tool,sha256:options.wit_tool_sha256}:null));
      await check('independent-whole-root-inventories', async () => {
        for (const row of receipt.rows) {
          assert.ok(pin(row.root_inventory_sha256), row.id + ': whole-root inventory pin missing; rerun refresh');
          const loaded = await generatedLib(row.id, options.run_root);
          assert.equal(digest(loaded.files), row.root_inventory_sha256,
            row.id + ': package inventory differs from independently pinned receipt');
          report.packages.push({ id: row.id, version: row.version, profile: row.profile,
            manifest_sha256: row.manifest_sha256, root_inventory_sha256: row.root_inventory_sha256,
            artifact_sha256: loaded.manifest.artifact?.sha256 ?? null,
            supported_views: Object.keys(loaded.manifest.bindings ?? {}).sort(),
            native_status: loaded.manifest.native?.status ?? null,
            artifact_kind: row.profile !== 'native' ? 'wasm' : loaded.manifest.artifact ? 'native' : 'native-source',
            runtime_qualified: false });
        }
      });
      // No failed report may look like partial installation authorization.
      if (index) {report.index = { ...index.summary, registry_sha256: index.index.registry_sha256 };
        report.wit_normalizations=index.wit_normalizations;}
      await check('end-of-read-receipt-fence', async () => {
        assert.equal(sha(await readFile(join(options.run_root, 'refresh-receipt.json'))),
          options.receipt_sha256, 'receipt changed during preflight');
        for (const row of receipt.rows) assert.equal(digest(await inventory(join(options.run_root, 'packages', row.id))),
          row.root_inventory_sha256, row.id + ': package changed during preflight');
      });
    }
  }
  report.build_pins = optionsValid ? { ...options } : null;
  report.identity_and_build_complete = report.blockers.length === 0;
  report.accepted = report.identity_and_build_complete;
  report.remaining_product_gates = ['matched private compiler/CoreLib admission and integration',
    'all-public-API ordinary App plus complete SDK Q2', 'resource and Host lifecycle',
    'declared native target compilation/device evidence', 'exact licenses and dependency notices',
    'independent whole-product rebuild', 'current discovery/resolve/install',
    'exact-candidate two-model Pi and immutable channel promotion'];
  return report;
}

export async function requireCurrentReleaseCohort(repo, options) {
  const report = await currentReleasePreflight(repo, options);
  assert.equal(report.accepted, true, 'current release preflight rejected: ' + JSON.stringify(report.blockers));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await currentReleasePreflight(process.cwd(), currentReleaseArguments(process.argv.slice(2)));
  console.log(JSON.stringify(report));
  if (!report.accepted) process.exitCode = 1;
}
