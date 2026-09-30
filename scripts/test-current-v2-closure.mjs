import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const catalog=read('catalog/libs-current-v2.json');
const policy=read('catalog/current-v2-policy.json');
const ledger=read('catalog/current-v2-migration.json');
assert.equal(policy.status,'active');
assert.equal(policy.default_agent_view,'runtime');
assert.equal(policy.producer_protocol_authority.commit,'3b797a77d0afa25264a11362603b0d596d2e0ba7');
assert.equal(policy.producer_protocol_authority.manifest_schema,'wasmc.lib/v2');
assert.deepEqual(policy.required_agent_views,['runtime','developer']);
assert.equal(policy.current_package_count,catalog.packages.length);
assert.equal(policy.rebuild_backlog_count,ledger.backlog.length);
assert.equal(ledger.counts.migrated,catalog.packages.length);
assert.equal(ledger.counts.backlog,14);
assert.equal(ledger.counts.blocked_real_provider,1);
assert.equal(ledger.counts.source_recovery_required,3);
assert.equal(new Set(ledger.migrated.map(x=>x.id)).size,ledger.migrated.length);
assert.equal(new Set(ledger.backlog.map(x=>x.id)).size,ledger.backlog.length);
for(const row of catalog.packages){
  const m=read(`${row.root}/lib.json`);
  assert.equal(m.schema,'wasmc.lib/v2',row.id);
  assert.equal(m.agent.default_view,'runtime',row.id);
  assert.deepEqual(Object.keys(m.agent.views).sort(),['developer','runtime'],row.id);
  assert.equal(m.agent.views.developer.includes_runtime,true,row.id);
  assert.equal(ledger.backlog.some(x=>x.id===row.id),false,row.id);
}
for(const row of ledger.backlog){
  assert.equal(catalog.packages.some(x=>x.id===row.id),false,row.id);
  assert(policy.excluded_until_rebuilt.includes(row.id),row.id);
  assert(['rebuild-required','blocked-real-provider','source-recovery-required'].includes(row.status),row.id);
}
const telemetry=ledger.backlog.find(x=>x.id==='wasmc-system-telemetry');
assert(telemetry); assert.equal(telemetry.status,'blocked-real-provider');
console.log(JSON.stringify({accepted:true,current:catalog.packages.length,backlog:ledger.backlog.length,telemetry:telemetry.status}));
