import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const [baseline, activation, authoring, core, activationPin, authoringPin, corePin] = process.argv.slice(2);
assert.ok([baseline, activation, authoring, core, activationPin, authoringPin, corePin].every(Boolean));
const prep = resolve(import.meta.dirname, 'prepare-rebound-rust2024-workspace.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'wasmc-rebound-prep-controls-'));
const run = (out, ap = activationPin, ar = authoringPin, cp = corePin) => spawnSync(process.execPath,
  [prep, baseline, activation, authoring, core, out, ap, ar, cp], {encoding: 'utf8', timeout: 30000});
for (const [which, pins] of [['activation', ['0'.repeat(64), authoringPin, corePin]],
  ['authoring', [activationPin, '0'.repeat(64), corePin]], ['core', [activationPin, authoringPin, '0'.repeat(64)]]]) {
  const out = join(tmp, which); assert.notEqual(run(out, ...pins).status, 0, which); assert.equal(existsSync(out), false);
}
const out = join(tmp, 'existing');
writeFileSync(out, 'preserve this output');
assert.notEqual(run(out).status, 0);
assert.equal(readFileSync(out, 'utf8'), 'preserve this output');
console.log(JSON.stringify({accepted: true, controls: ['bad activation pin', 'bad authoring pin', 'bad DataCore pin', 'existing output preserved'],
  temporary_root: tmp, formal_release: false}));
