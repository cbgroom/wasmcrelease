#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { atomicJson, command, sha } from './lib-refresh-cache-v2.mjs';

assert.equal(process.argv[2], '--run-root');
const runRoot = resolve(process.argv[3]);
const input = await readFile(join(runRoot, 'refresh-receipt.json'));
const refresh = JSON.parse(input);
assert.equal(refresh.accepted, true);
const subjectIds = refresh.rows.map(row => row.id).sort();
const expected = ['wasmc-json', 'wasmc-compression', 'wasmc-http1', 'wasmc-csv',
  'wasmc-data-core', 'wasmc-data-compute', 'wasmc-data-expr', 'wasmc-data-profile',
  'wasmc-data-interchange', 'wasmc-data-relational'].sort();
assert.deepEqual(subjectIds, expected, 'this Q1 suite is exactly the migrated ten-library cohort');
const runs = [], errors = [];
for (const [script, receiptFile] of [
  ['test-lib-refresh-v2.mjs', 'value-q1-receipt.json'],
  ['test-lib-refresh-data-v2.mjs', 'data-q1-receipt.json'],
]) {
  try {
    await command(process.execPath, [join('scripts', script), '--run-root', runRoot],
      { cwd: process.cwd(), logs: join(runRoot, 'q1-logs', script), timeout: 90000 });
    const bytes = await readFile(join(runRoot, receiptFile));
    const result = JSON.parse(bytes);
    assert.equal(result.accepted, true); assert.equal(result.fingerprint, refresh.fingerprint);
    runs.push({ file: receiptFile, sha256: sha(bytes), result });
  } catch (error) { errors.push({ script, error: error.message }); }
}
const packages = runs.flatMap(run => run.result.packages);
const covered = packages.reduce((n, row) => n + row.apis.length, 0);
if (!errors.length) {
  assert.deepEqual(packages.map(row => row.id).sort(), expected);
  assert.equal(covered, 28);
  for (const row of packages) assert.equal(row.artifact_sha256,
    refresh.rows.find(r => r.id === row.id).artifact_sha256, row.id + ': qualification subject mismatch');
}
const result = { schema: 'wasmc.lib-refresh-cohort-q1/v2', accepted: errors.length === 0,
  fingerprint: refresh.fingerprint, refresh_receipt_sha256: sha(input), engine: process.version + ' Node Core WebAssembly',
  package_count: packages.length, public_apis_exercised: covered,
  cases: runs.reduce((n, run) => n + (Array.isArray(run.result.cases)
    ? run.result.cases.length : run.result.packages.reduce((sum, row) => sum + row.cases, 0)), 0),
  evidence: runs.map(({ file, sha256 }) => ({ file, sha256 })), packages, errors,
  q2_ecosystem: 'not_run', q3_release: 'not_run', public_admission: false };
await atomicJson(join(runRoot, 'q1-receipt.json'), result);
console.log(JSON.stringify(result));
if (!result.accepted) process.exitCode = 1;
