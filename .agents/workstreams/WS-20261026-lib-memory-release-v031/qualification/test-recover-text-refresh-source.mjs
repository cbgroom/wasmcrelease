import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const [root, pin] = process.argv.slice(2);
const script = resolve(import.meta.dirname, 'recover-text-refresh-source.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'wasmc-text-recovery-'));
const run = (assemblyPin, out) => spawnSync(process.execPath, [script, root, assemblyPin, out],
  {encoding:'utf8', timeout:120000});
const bad = join(tmp, 'bad');
assert.notEqual(run('0'.repeat(64), bad).status, 0);
assert.equal(existsSync(bad), false);
const out = join(tmp, 'good'), first = run(pin, out);
assert.equal(first.status, 0, first.stderr);
const receipt = JSON.parse(first.stdout), spec = JSON.parse(readFileSync(join(out,'lib.json')));
assert.equal(receipt.schema, 'wasmc.text-refresh-source/v1');
assert.equal(spec.id, 'wasmc-text'); assert.equal(spec.version, '0.0.2');
assert.deepEqual(spec.dependencies, ['memchr']);
assert.ok(readFileSync(join(out, 'adapter.rs'), 'utf8').includes('input.split_whitespace()'));
assert.notEqual(run(pin, out).status, 0);
assert.equal(readFileSync(join(out,'lib.json'),'utf8'), JSON.stringify(spec,null,2)+'\n');
console.log('PASS Text source recovery, independent pin, method continuity, and no-overwrite');
