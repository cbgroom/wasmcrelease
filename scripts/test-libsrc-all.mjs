import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const registry = JSON.parse(await readFile(resolve(root, 'libsrc/registry.json'), 'utf8'));
assert.equal(registry.schema, 'wasmc.libsrc-registry/v1');

const receipts = [];
for (const candidate of registry.candidates) {
  if (candidate.stage !== 'public-source-candidate') continue;
  const manifest = JSON.parse(
    await readFile(resolve(root, candidate.source_root, 'candidate.json'), 'utf8'),
  );
  assert.equal(manifest.id, candidate.id);
  assert.equal(manifest.qualification?.runner, 'node');
  const script = manifest.qualification.script;
  const result = spawnSync(process.execPath, [resolve(root, script)], {
    cwd: root,
    encoding: 'utf8',
    timeout: 600000,
    maxBuffer: 128 << 20,
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      candidate.id + ' qualification failed (' + result.status + '):\n' +
      result.stderr + '\n' + result.stdout,
    );
  }
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.ok(lines.length > 0, candidate.id + ': empty qualification output');
  const receipt = JSON.parse(lines.at(-1));
  assert.equal(receipt.accepted, true, candidate.id + ': qualification not accepted');
  assert.equal(receipt.candidate, candidate.id, candidate.id + ': receipt identity mismatch');
  receipts.push({
    id: candidate.id,
    version: receipt.version ?? candidate.version,
    script,
    receipt,
  });
}

assert.equal(receipts.length, registry.candidates.filter(c => c.stage === 'public-source-candidate').length);
console.log(JSON.stringify({
  accepted: true,
  schema: 'wasmc.libsrc-qualification-suite/v1',
  candidates: receipts.length,
  ids: receipts.map(r => r.id),
  receipts,
}));
