import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const [source, assemblyPin, tool, toolPin] = process.argv.slice(2);
assert.ok(source && /^[a-f0-9]{64}$/.test(assemblyPin ?? '') && tool && /^[a-f0-9]{64}$/.test(toolPin ?? ''));
const script = resolve(import.meta.dirname, 'materialize-verified-rust-source.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'wasmc-authoring-recovery-'));
const run = (root, pin, output) => spawnSync(process.execPath,
  [script, root, pin, 'wasmc-compression', output], {encoding: 'utf8', timeout: 120000});
const output = join(tmp, 'valid');
const valid = run(resolve(source), assemblyPin, output);
assert.equal(valid.status, 0, valid.stderr);
const receipt = JSON.parse(valid.stdout);
assert.equal(receipt.files['delta.rs'], 'f57b352babf009e3930acbf9509e72dfc7fd6f736e362847ce3d9db15a063d85');
assert.ok(!readFileSync(join(output, 'delta.rs'), 'utf8').includes('MAX_INPUT_BYTES'));
const repeat = run(resolve(source), assemblyPin, output);
assert.notEqual(repeat.status, 0, 'existing output must not be replaced');
assert.equal(readFileSync(join(output, 'delta.rs'), 'utf8').includes('MAX_INPUT_BYTES'), false);
const badOutput = join(tmp, 'wrong-pin');
assert.notEqual(run(resolve(source), '0'.repeat(64), badOutput).status, 0);
assert.equal(existsSync(badOutput), false);
const copy = join(tmp, 'tampered-composition');
const cloned = spawnSync('cp', ['-cR', resolve(source), copy], {encoding: 'utf8'});
assert.equal(cloned.status, 0, cloned.stderr);
const projection = JSON.parse(readFileSync(join(copy, 'libspec/wasmc-compression/lib.json')));
const packetDelta = join(copy, projection.source_packet.root, 'delta.rs');
const originalDelta = readFileSync(packetDelta);
writeFileSync(packetDelta, Buffer.concat([originalDelta, Buffer.from('\n// altered\n')]));
const changedOutput = join(tmp, 'changed-source');
assert.notEqual(run(copy, assemblyPin, changedOutput).status, 0);
assert.equal(existsSync(changedOutput), false);
writeFileSync(packetDelta, originalDelta);
const rebind = (root, id, output, pin = toolPin) => spawnSync(process.execPath,
  [script, root, assemblyPin, id, output, tool, pin], {encoding: 'utf8', timeout: 120000});
for (const id of ['wasmc-data-interchange', 'wasmc-data-relational']) {
  const out = join(tmp, id), r = rebind(resolve(source), id, out);
  assert.equal(r.status, 0, r.stderr);
  const data = JSON.parse(r.stdout), spec = JSON.parse(readFileSync(join(out, 'lib.json')));
  assert.equal(spec.version, '0.1.1');
  assert.equal(data.wit_closure.mode, 'standard-tool-normalization');
  assert.equal(data.wit_closure.normalized_sha256, data.wit_closure.delivered_sha256);
  assert.ok(readFileSync(join(out, 'lib.wit'), 'utf8').includes('wasmc:data-core/types@0.0.2'));
}
const wrongTool = join(tmp, 'wrong-tool');
assert.notEqual(rebind(resolve(source), 'wasmc-data-relational', wrongTool, '0'.repeat(64)).status, 0);
assert.equal(existsSync(wrongTool), false);
const missingSource = join(tmp, 'missing-parent-source');
assert.notEqual(rebind(resolve(source), 'wasmc-text', missingSource).status, 0);
assert.equal(existsSync(missingSource), false);
const changedParent = join(copy, 'libspec/wasmc-data-relational/lib.json');
const parentProjection = JSON.parse(readFileSync(changedParent));
const parentDelta = join(copy, parentProjection.source_packet.root, 'parent-source/delta.rs');
const originalParent = readFileSync(parentDelta);
writeFileSync(parentDelta, Buffer.concat([originalParent, Buffer.from('\n// altered\n')]));
const parentOutput = join(tmp, 'changed-parent');
assert.notEqual(rebind(copy, 'wasmc-data-relational', parentOutput).status, 0);
assert.equal(existsSync(parentOutput), false);
writeFileSync(parentDelta, originalParent);
for (const [id, version] of [['wasmc-data-core', '0.0.2'], ['wasmc-owned-algorithms', '0.1.2'],
  ['wasmc-csv', '0.0.3'], ['wasmc-data-compute', '0.0.3'], ['wasmc-data-expr', '0.0.3'], ['wasmc-data-profile', '0.0.3']]) {
  const out = join(tmp, id), r = rebind(resolve(source), id, out);
  assert.equal(r.status, 0, r.stderr);
  const data = JSON.parse(r.stdout);
  assert.equal(data.version, version);
  assert.equal(data.base_source_fingerprint, '10b7d95f6ec08bb128e494c91a8710c1e3e9a293aeb95e91dd531cfffc3ed042');
  assert.equal(data.wit_closure.normalized_sha256 ?? data.wit_closure.authored_sha256, data.wit_closure.delivered_sha256);
}
const baseDelta = join(copy, 'admission/current-composition-inputs-v1/libspec/wasmc-data-core/delta.rs');
writeFileSync(baseDelta, Buffer.concat([readFileSync(baseDelta), Buffer.from('\n// altered\n')]));
const baseOutput = join(tmp, 'changed-base');
assert.notEqual(rebind(copy, 'wasmc-data-core', baseOutput).status, 0);
assert.equal(existsSync(baseOutput), false);
console.log(JSON.stringify({accepted: true, controls: ['valid exact packet', 'existing output', 'wrong assembly pin', 'tampered packet',
  'two WIT-rebound sources', 'wrong WIT tool pin', 'unsupported projection', 'tampered parent',
  'six base cohort sources', 'tampered base source'],
  output_delta_sha256: receipt.files['delta.rs'], temporary_root: tmp, formal_release: false}));
