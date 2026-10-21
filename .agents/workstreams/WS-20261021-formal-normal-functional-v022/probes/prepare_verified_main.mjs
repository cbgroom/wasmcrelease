import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validateCandidate,validateTransition} from '../../../../scripts/release-candidate.mjs';
import {hash} from '../../../../scripts/current-lib-release-v3.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const candidate=json('channels/candidates/0.0.22.json');
assert.equal(hash(read('channels/candidates/0.0.22.json')),'59b0d5309ff8d82eda61e7a29421ba4bea09b4d90e72bdda6ec43c8b2942d202');
assert.equal(candidate.product_set_sha256,'deb5321647d7dd1ccc27bd662d0b5b02a0c3300a2351a37045097484cbcf411a');
validateCandidate(candidate,read);
const source='9c34b6030a4e17bf7f08c551d229262e668c897d';
const expected=[['lib-search.yml',39568762596],['source-free-consumer.yml',39568992592],
 ['sdk-agent-guidance.yml',39568762644],['rust-host-sdk.yml',39568762759],
 ['release-surfaces.yml',39568997152],['agent-discovery.yml',39569000890],
 ['client-gateway.yml',39569005080],['portable-std.yml',39569009001],['host-lib-e2e.yml',39569013375]];
// Read every actual remote subject before making any local stage change.
const observed=expected.map(([workflow,id])=>{
 const run=JSON.parse(execFileSync('gh',['api',`repos/cbgroom/wasmcrelease/actions/runs/${id}`],{encoding:'utf8'}));
 assert.equal(run.head_sha,source);assert.equal(run.head_branch,'v0.0.22-dev.2');
 assert.equal(run.path,`.github/workflows/${workflow}`);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 return{workflow,id,status:run.status,conclusion:run.conclusion,source_commit:run.head_sha,url:run.html_url};
});
const previous=json('channels/dev.json');assert.equal(previous.tag,'v0.0.22-dev.2');
const next={schema:'wasmc.release-stage/v1',version:'0.0.22',stage:'main',tag:'v0.0.22-main.1',stable:false,
 product_candidate_commit:previous.product_candidate_commit,product_set_sha256:candidate.product_set_sha256,
 qualification:{...previous.qualification,accepted:true,tested_source_commit:source,
 tested_product_set_sha256:candidate.product_set_sha256,lib_search_result:'success',lib_search_run:observed[0].url,
 full_consumer_result:'success',full_consumer_run:observed[1].url,exact_current_workflows:observed},default_prod_advanced:false};
validateTransition(previous,next,candidate);
const output='channels/0.0.22/main.1.json';assert.equal(existsSync(output),false,'never replace an existing stage');
const bytes=JSON.stringify(next,null,2)+'\n';writeFileSync(output,bytes,{flag:'wx'});writeFileSync('channels/main.json',bytes);
writeFileSync('.agents/workstreams/WS-20261021-formal-normal-functional-v022/evidence/dev2-all-nine-actual-success.json',JSON.stringify({schema:'wasmc.exact-current-CI-observation/v1',source,product_set_sha256:candidate.product_set_sha256,runs:observed},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({accepted:true,stage:next.stage,tag:next.tag,workflows:observed.length,product_set_sha256:next.product_set_sha256,default_prod:json('channels/prod.json').version}));
