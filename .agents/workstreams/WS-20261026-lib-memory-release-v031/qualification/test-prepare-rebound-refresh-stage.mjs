import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const [data, base, dataPin, basePin] = process.argv.slice(2);
assert.ok([data, base, dataPin, basePin].every(Boolean));
const script = resolve(import.meta.dirname, 'prepare-rebound-refresh-stage.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'wasmc-refresh-stage-controls-'));
const run = (out, dp, bp) => spawnSync(process.execPath, [script, out, data, base, dp, bp], {encoding:'utf8',timeout:30000});
for (const [name, dp, bp] of [['bad-data','0'.repeat(64),basePin],['bad-base',dataPin,'0'.repeat(64)]]) {
  const out = join(tmp, name); assert.notEqual(run(out, dp, bp).status, 0); assert.equal(existsSync(out), false);
}
const existing = join(tmp, 'existing'); writeFileSync(existing, 'retain');
assert.notEqual(run(existing, dataPin, basePin).status, 0); assert.equal(readFileSync(existing,'utf8'),'retain');
console.log(JSON.stringify({accepted:true,controls:['bad authoring pin','bad base pin','existing output preserved'],formal_release:false}));
