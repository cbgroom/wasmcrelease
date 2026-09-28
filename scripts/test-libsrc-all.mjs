import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const portableOnly = process.argv.includes('--portable');
const registry = JSON.parse(await readFile(resolve(root, 'libsrc/registry.json'), 'utf8'));
assert.equal(registry.schema, 'wasmc.libsrc-registry/v1');

const receipts = [];
const skipped = [];
const qualificationByScript = new Map();
for (const candidate of registry.candidates) {
  if (candidate.stage !== 'public-source-candidate') continue;
  const manifest = JSON.parse(
    await readFile(resolve(root, candidate.source_root, 'candidate.json'), 'utf8'),
  );
  assert.equal(manifest.id, candidate.id);
  assert.equal(manifest.qualification?.runner, 'node');
  if (portableOnly && !manifest.build?.artifact?.endsWith('.wasm')) {
    skipped.push({
      id: candidate.id,
      reason: 'not-a-portable-wasm-build',
    });
    continue;
  }
  if (Array.isArray(manifest.qualification.hosts) &&
      !manifest.qualification.hosts.includes(process.platform)) {
    skipped.push({
      id: candidate.id,
      reason: 'incompatible-qualification-host',
      required_hosts: manifest.qualification.hosts,
      actual_host: process.platform,
    });
    continue;
  }
  const script = manifest.qualification.script;
  let receipt = qualificationByScript.get(script);
  if (receipt === undefined) {
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
    receipt = JSON.parse(lines.at(-1));
    qualificationByScript.set(script, receipt);
  }
  assert.equal(receipt.accepted, true, candidate.id + ': qualification not accepted');
  if (receipt.candidate === undefined) {
    assert.ok(
      Array.isArray(receipt.candidates) && receipt.candidates.includes(candidate.id),
      candidate.id + ': shared receipt identity mismatch',
    );
  } else {
    assert.equal(receipt.candidate, candidate.id, candidate.id + ': receipt identity mismatch');
  }
  receipts.push({
    id: candidate.id,
    version: receipt.version ?? candidate.version,
    script,
    receipt,
  });
}

assert.equal(
  receipts.length + skipped.length,
  registry.candidates.filter(c => c.stage === 'public-source-candidate').length,
);
console.log(JSON.stringify({
  accepted: true,
  schema: 'wasmc.libsrc-qualification-suite/v1',
  profile: portableOnly ? 'portable-wasm' : 'all-host-compatible',
  candidates: receipts.length + skipped.length,
  executed: receipts.length,
  skipped: skipped.length,
  skipped_candidates: skipped,
  ids: receipts.map(r => r.id),
  receipts,
}));
