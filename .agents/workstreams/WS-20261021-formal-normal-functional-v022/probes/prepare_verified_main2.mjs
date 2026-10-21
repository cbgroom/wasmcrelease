import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validateCandidate,validateTransition} from '../../../../scripts/release-candidate.mjs';
import {hash} from '../../../../scripts/current-lib-release-v3.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const candidate=json('channels/candidates/0.0.22.json');
assert.equal(hash(read('channels/candidates/0.0.22.json')),'429e9f77319a7abc99b63beab0ec9d8043cc78af30ed5fbac6c4db70feffc7af');
assert.equal(candidate.product_set_sha256,'1d31e575b77cb3bdd810ad4601bac242ea1acad8550cd0febf828d80b6b5f9f3');
validateCandidate(candidate,read);
const source='6cb402860df296d11cd6332917a4ac00e38878de';
const expected=[['lib-search.yml',39574131156],['source-free-consumer.yml',39574158039],
 ['sdk-agent-guidance.yml',39574130666],['rust-host-sdk.yml',39574130806],
 ['release-surfaces.yml',39574162684],['agent-discovery.yml',39574167033],
 ['client-gateway.yml',39574171408],['portable-std.yml',39574175212],['host-lib-e2e.yml',39574179407]];
// Read every actual remote subject before making any local stage change.
const observed=expected.map(([workflow,id])=>{
 const run=JSON.parse(execFileSync('gh',['api',`repos/cbgroom/wasmcrelease/actions/runs/${id}`],{encoding:'utf8'}));
 assert.equal(run.head_sha,source);assert.equal(run.head_branch,'v0.0.22-dev.3');
 assert.equal(run.path,`.github/workflows/${workflow}`);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 return{workflow,id,status:run.status,conclusion:run.conclusion,source_commit:run.head_sha,url:run.html_url};
});
const previous=json('channels/dev.json');assert.equal(previous.tag,'v0.0.22-dev.3');
const next={schema:'wasmc.release-stage/v1',version:'0.0.22',stage:'main',tag:'v0.0.22-main.2',stable:false,
 product_candidate_commit:previous.product_candidate_commit,product_set_sha256:candidate.product_set_sha256,
 qualification:{...previous.qualification,scope:'Exact dev3 product1059 independently reopened, actual three-host Runtime receipts, all nine exact current workflows successful, original Native6build/6matchingconsumers with27unchanged inputs. Final clean-tree Pi and independent review remain separate pre-publication requirements.',accepted:true,tested_source_commit:source,
 tested_product_set_sha256:candidate.product_set_sha256,lib_search_result:'success',lib_search_run:observed[0].url,
 full_consumer_result:'success',full_consumer_run:observed[1].url,exact_current_workflows:observed},default_prod_advanced:false};
validateTransition(previous,next,candidate);
const output='channels/0.0.22/main.2.json';assert.equal(existsSync(output),false,'never replace an existing stage');
const bytes=JSON.stringify(next,null,2)+'\n';writeFileSync(output,bytes,{flag:'wx'});writeFileSync('channels/main.json',bytes);
writeFileSync('.agents/workstreams/WS-20261021-formal-normal-functional-v022/evidence/dev3-all-nine-actual-success.json',JSON.stringify({schema:'wasmc.exact-current-CI-observation/v1',source,product_set_sha256:candidate.product_set_sha256,runs:observed},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({accepted:true,stage:next.stage,tag:next.tag,workflows:observed.length,product_set_sha256:next.product_set_sha256,default_prod:json('channels/prod.json').version}));
