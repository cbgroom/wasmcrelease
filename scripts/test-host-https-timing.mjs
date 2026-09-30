import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {timingEpoch,compatibleHistory,readyEpoch,legacyEpoch} from './host-https-timing.mjs';
assert.equal(timingEpoch({}),legacyEpoch);
const harness={timed_interval:'after-runtime-readiness',readiness:'initialized-runtime-before-client-connect',failed_request_retry:false};
assert.equal(timingEpoch({qualification_harness:harness}),readyEpoch);
assert.equal(compatibleHistory({timing_epoch:readyEpoch},{}),false);
assert.equal(compatibleHistory({timing_epoch:readyEpoch},{timing_epoch:readyEpoch}),true);
assert.equal(compatibleHistory({},{}),true);
for(const key of Object.keys(harness)){
  const altered={...harness,[key]:null};assert.throws(()=>timingEpoch({qualification_harness:altered}));
}
// Exercise the actual aggregator; synthetic platform clones are test fixtures,
// not cross-platform qualification evidence.
const temp=mkdtempSync(join(tmpdir(),'wasmc-https-timing-'));
const input=join(temp,'input');mkdirSync(input);
const base=JSON.parse(readFileSync('admission/current-v2-next/https-startup-macos-aarch64.json'));
const required=JSON.parse(readFileSync('release-surfaces.json')).desktop_platforms.filter(x=>x.release_required).map(x=>x.id);
for(const platform of required){
  const report={...structuredClone(base),platform,commit:'c'.repeat(40)};
  writeFileSync(join(input,platform+'.json'),JSON.stringify(report));
  const best={shards:2,dedicated_ops_p50:100,sharded_ops_p50:200,paired_throughput_pct_p50:100,positive_pairs:6,pairs:6,dedicated_threads:32,shared_threads:2,dedicated_control_per_op:1,shared_control_per_op:1};
  writeFileSync(join(input,platform+'-sweep.json'),JSON.stringify({schema:'wasmc-host-transport-shard-sweep/v1',platform,commit:'c'.repeat(40),semantic_parity:true,best,results:[]}));
}
const history=join(temp,'history.json');
writeFileSync(history,JSON.stringify({schema:'wasmc-host-https-ab-history/v1',entries:[{commit:'b'.repeat(40),summary:required.map(platform=>({platform,candidate_rps_p50:1,paired_rps_ratio_p50:1}))}]}));
const output=join(temp,'output');
execFileSync(process.execPath,['scripts/aggregate-host-https-ab.mjs',input,output,history],{stdio:'pipe'});
const latest=JSON.parse(readFileSync(join(output,'latest.json')));
assert(latest.summary.every(x=>x.timing_epoch===readyEpoch&&!x.history_delta&&x.history_baseline_rejected));
const first=join(input,required[0]+'.json'),legacy=JSON.parse(readFileSync(first));delete legacy.qualification_harness;
writeFileSync(first,JSON.stringify(legacy));
const rejected=spawnSync(process.execPath,['scripts/aggregate-host-https-ab.mjs',input,join(temp,'mixed')],{encoding:'utf8'});
assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/mixed HTTPS timing epochs/);
console.log(JSON.stringify({accepted:true,checks:10,cross_epoch_history_rejected:true,mixed_epoch_aggregate_rejected:true}));
