import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateCandidate,validateTransition,currentStageMetadataPaths,validateCurrentStageMetadataPartition,currentCIProductInputs,validateCurrentCIProductInputs} from './release-candidate.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=Buffer.from('product'),rows=[{path:'current/product.wasm',bytes:bytes.length,sha256:hash(bytes)}];
const routeClosure={schema:'wasmc.release-candidate-lib-route-closure/v1',authority_receipt:{path:'admission/route.json',sha256:'1'.repeat(64)},catalog:{path:'catalog/libs.json',sha256:'2'.repeat(64)},search_index:{path:'examples/index.lsi',sha256:'3'.repeat(64)},release_packages:1,package_routes:1,api_routes:1,candidate_extras:0,exact:true,candidate_extra_grants_release:false};
const c={schema:'wasmc.release-product-candidate/v2',version:'0.0.14',compiler_source_authority:'a'.repeat(40),lib_source_authority:'b'.repeat(40),product_files:rows,product_set_sha256:hash(JSON.stringify(rows)),lib_route_closure:routeClosure};
assert.equal(validateCandidate(c,()=>bytes),true);
const dev={schema:'wasmc.release-stage/v1',version:c.version,product_set_sha256:c.product_set_sha256,product_candidate_commit:'c'.repeat(40),stage:'dev',tag:`v${c.version}-dev.1`};
const q={accepted:true,lib_search_result:'success',full_consumer_result:'success',tested_source_commit:'d'.repeat(40),tested_product_set_sha256:c.product_set_sha256};
const main={...dev,stage:'main',tag:`v${c.version}-main.1`,qualification:q};
const prod={...dev,stage:'prod',tag:`v${c.version}`,qualification:q};
assert.equal(validateTransition(null,dev,c),true);
assert.equal(validateTransition(dev,main,c),true);
assert.equal(validateTransition(main,prod,c),true);
const negatives=[
 ()=>validateCandidate(c,()=>Buffer.from('changed')),
 ()=>validateCandidate({...c,product_files:[...rows,...rows]},()=>bytes),
 ()=>validateCandidate({...c,product_files:[{...rows[0],path:'../secret'}]},()=>bytes),
 ()=>validateCandidate({...c,product_set_sha256:'0'.repeat(64)},()=>bytes),
 ()=>validateCandidate({...c,lib_source_authority:'main'},()=>bytes),
 ()=>validateCandidate({...c,lib_route_closure:{...routeClosure,exact:false}},()=>bytes),
 ()=>validateCandidate({...c,lib_route_closure:{...routeClosure,candidate_extras:1,package_routes:2}},()=>bytes),
 ()=>validateCandidate({...c,schema:'wasmc.release-product-candidate/v1'},()=>bytes),
 ()=>validateTransition(dev,prod,c),
 ()=>validateTransition(dev,{...main,product_candidate_commit:'e'.repeat(40)},c),
 ()=>validateTransition(dev,{...main,qualification:{...q,accepted:false}},c),
 ()=>validateTransition(dev,{...main,qualification:{...q,full_consumer_result:'skipped'}},c),
 ()=>validateTransition(dev,{...main,qualification:{...q,tested_product_set_sha256:'0'.repeat(64)}},c),
 ()=>validateTransition(main,{...prod,tag:`v${c.version}-prod`},c),
 ()=>validateTransition(null,{...dev,tag:`v${c.version}-dev.0`},c)
];
const current={product_files:rows,stage_metadata_paths:[...currentStageMetadataPaths]};
assert.equal(validateCurrentStageMetadataPartition(current),true);
for(const mutate of [
 value=>value.stage_metadata_paths.pop(),
 value=>value.stage_metadata_paths.push('current/compiler-release.json'),
 value=>value.stage_metadata_paths.reverse(),
 value=>value.product_files.push({...rows[0],path:'agent-quickstart.json'})
]){
 const changed=structuredClone(current);mutate(changed);
 negatives.push(()=>validateCurrentStageMetadataPartition(changed));
}
const ciRows=currentCIProductInputs.map(path=>({path,bytes:bytes.length,sha256:hash(bytes)}));
assert.equal(validateCurrentCIProductInputs({product_files:ciRows},()=>bytes),true);
const {suiteCases}=await import('./ci-suite.mjs');
for(const family of ['compatibility','integrity','candidate','runtime','security','rust'])for(const test of suiteCases(family))for(const arg of test.args){
  if(/^(scripts|examples|sdk)\/.*\.(mjs|sh|toml)$/.test(arg))assert.ok(currentCIProductInputs.includes(arg),'CI executable omitted: '+arg);
}
for(const path of ['scripts/validate-source-free-runtime.sh','scripts/validate-current.mjs','scripts/pi-pre-release-gate-v1.mjs','Cargo.toml','scripts/run-pi-learning-model-v1.mjs','scripts/aggregate-native-cli-perf.mjs','scripts/qualify-current-compiler.mjs','scripts/fixtures/ios-wss-cert.pem','scripts/fixtures/ios-wss-key.pem','docs/DYNAMIC_LIB_GRAPH_MODEL.md','host/drivers/tcp/rust/Cargo.toml','scripts/lib-refresh-runner-v2.mjs']){
  assert.ok(currentCIProductInputs.includes(path));
  negatives.push(()=>validateCurrentCIProductInputs({product_files:ciRows.filter(row=>row.path!==path)},()=>bytes));
}
negatives.push(()=>validateCurrentCIProductInputs({product_files:ciRows},()=>Buffer.from('changed')));
for(const test of negatives)assert.throws(test);
console.log(JSON.stringify({accepted:true,candidate_schema:c.schema,positive_transitions:3,current_lifecycle_partition_controls:4,current_CI_input_files:currentCIProductInputs.length,current_CI_input_controls:13,negative_tests:negatives.length,publishes:false}));
