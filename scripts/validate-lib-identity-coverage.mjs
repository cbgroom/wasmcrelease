import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const json=async path=>JSON.parse(await readFile(path));
const disposition=await json('libspec/identity-dispositions.json');
assert.equal(disposition.schema,'wasmc.current-lib-identity-dispositions/v1');
const paths=disposition.inventory_authorities;
const historical=await json(paths.historical_package_identities);
const retirement=await json(paths.retired_candidate_identities);
const current=await json(paths.current_sources);
const prior=new Set([...historical.packages.map(x=>x.id),...retirement.original_candidates]);
const active=new Set(current.libs.map(x=>x.id));
const missing=[...prior].filter(id=>!active.has(id)).sort();
const pending=disposition.pending.map(x=>x.id).sort();
assert.equal(new Set(pending).size,pending.length,'duplicate pending identity');
assert.deepEqual(pending,missing,'unrecorded identity loss or stale pending disposition');
assert.deepEqual(disposition.retired_capabilities,[],'capability retirement requires a separate explicit decision');
for(const entry of disposition.pending) {
  assert.equal(entry.fallback,false);
  assert.ok(entry.owner&&entry.reason&&entry.next&&entry.state.startsWith('pending_'));
}
const result={schema:'wasmc.current-lib-identity-coverage/v1',accepted:true,
  required_identity_count:prior.size,current_source_count:active.size,
  historical_package_count:new Set(historical.packages.map(x=>x.id)).size,
  pending:missing,implementation_complete:missing.length===0,legacy_fallback:false,public_admission:false};
console.log(JSON.stringify(result));
if(process.argv.includes('--require-complete'))assert.equal(missing.length,0,'current implementation identity closure is not complete');
