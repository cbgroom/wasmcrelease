import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const authorities = Object.freeze({
  historical_package_identities: 'catalog/libs-v018.json',
  retired_candidate_identities: '.agents/workstreams/WS-20261006-lib-refresh-v2/legacy-retirement.json',
  current_sources: 'libspec/registry.json',
});

// A reusable current-source gate. Importing it must not run a CLI or depend on
// the importing process's working directory.
export async function identityCoverage(repo = process.cwd()) {
  const json = async path => JSON.parse(await readFile(join(repo, path)));
  const disposition = await json('libspec/identity-dispositions.json');
  assert.equal(disposition.schema, 'wasmc.current-lib-identity-dispositions/v1');
  assert.deepEqual(disposition.inventory_authorities, authorities,
    'identity authority paths cannot be replaced by a smaller convenience inventory');
  const historical = await json(authorities.historical_package_identities);
  const retirement = await json(authorities.retired_candidate_identities);
  const current = await json(authorities.current_sources);
  assert.equal(current.schema, 'wasmc.lib-refresh-registry/v2');
  assert.ok(Array.isArray(historical.packages) && historical.packages.length > 0);
  assert.ok(Array.isArray(retirement.original_candidates) && retirement.original_candidates.length > 0);
  assert.ok(Array.isArray(current.libs) && current.libs.length > 0);
  const prior = new Set([...historical.packages.map(x => x.id), ...retirement.original_candidates]);
  const active = new Set(current.libs.map(x => x.id));
  assert.equal(active.size, current.libs.length, 'duplicate current implementation identity');
  for (const id of [...prior, ...active]) assert.match(id, /^[a-z0-9][a-z0-9-]*$/);
  const missing = [...prior].filter(id => !active.has(id)).sort();
  const pending = disposition.pending.map(x => x.id).sort();
  assert.equal(new Set(pending).size, pending.length, 'duplicate pending identity');
  assert.deepEqual(pending, missing, 'unrecorded identity loss or stale pending disposition');
  assert.deepEqual(disposition.retired_capabilities, [], 'capability retirement requires a separate explicit decision');
  for (const entry of disposition.pending) {
    assert.equal(entry.fallback, false);
    assert.ok(entry.owner && entry.reason && entry.next && entry.state.startsWith('pending_'));
  }
  return { schema: 'wasmc.current-lib-identity-coverage/v1', accepted: true,
    required_identity_count: prior.size, current_source_count: active.size,
    historical_package_count: new Set(historical.packages.map(x => x.id)).size,
    required_ids: [...prior].sort(), current_ids: [...active].sort(),
    pending: missing, implementation_complete: missing.length === 0,
    legacy_fallback: false, public_admission: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--require-complete'),
    'usage: validate-lib-identity-coverage.mjs [--require-complete]');
  const result = await identityCoverage();
  console.log(JSON.stringify(result));
  if (args.includes('--require-complete')) assert.equal(result.pending.length, 0,
    'current implementation identity closure is not complete');
}
