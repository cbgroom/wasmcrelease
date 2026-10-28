import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const [source, assemblyPin] = process.argv.slice(2);
assert.ok(source && /^[a-f0-9]{64}$/.test(assemblyPin ?? ''));
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
writeFileSync(packetDelta, Buffer.concat([readFileSync(packetDelta), Buffer.from('\n// altered\n')]));
const changedOutput = join(tmp, 'changed-source');
assert.notEqual(run(copy, assemblyPin, changedOutput).status, 0);
assert.equal(existsSync(changedOutput), false);
console.log(JSON.stringify({accepted: true, controls: ['valid exact packet', 'existing output', 'wrong assembly pin', 'tampered packet'],
  output_delta_sha256: receipt.files['delta.rs'], temporary_root: tmp, formal_release: false}));
