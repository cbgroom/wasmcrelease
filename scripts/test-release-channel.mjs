import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateCandidate,validateTransition} from './release-candidate.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=Buffer.from('product'),rows=[{path:'current/product.wasm',bytes:bytes.length,sha256:hash(bytes)}];
const c={schema:'wasmc.release-product-candidate/v1',version:'0.0.10',compiler_source_authority:'a'.repeat(40),lib_source_authority:'b'.repeat(40),product_files:rows,product_set_sha256:hash(JSON.stringify(rows))};
assert.equal(validateCandidate(c,()=>bytes),true);
const dev={schema:'wasmc.release-stage/v1',version:c.version,product_set_sha256:c.product_set_sha256,product_candidate_commit:'c'.repeat(40),stage:'dev',tag:'v0.0.10-dev.1'};
const q={accepted:true,lib_search_result:'success',full_consumer_result:'success',tested_source_commit:'d'.repeat(40),tested_product_set_sha256:c.product_set_sha256};
const main={...dev,stage:'main',tag:'v0.0.10-main.1',qualification:q};
const prod={...dev,stage:'prod',tag:'v0.0.10',qualification:q};
assert.equal(validateTransition(null,dev,c),true);
assert.equal(validateTransition(dev,main,c),true);
assert.equal(validateTransition(main,prod,c),true);
const negatives=[
 ()=>validateCandidate(c,()=>Buffer.from('changed')),
 ()=>validateCandidate({...c,product_files:[...rows,...rows]},()=>bytes),
 ()=>validateCandidate({...c,product_files:[{...rows[0],path:'../secret'}]},()=>bytes),
 ()=>validateCandidate({...c,product_set_sha256:'0'.repeat(64)},()=>bytes),
 ()=>validateCandidate({...c,lib_source_authority:'main'},()=>bytes),
 ()=>validateTransition(dev,prod,c),
 ()=>validateTransition(dev,{...main,product_candidate_commit:'e'.repeat(40)},c),
 ()=>validateTransition(dev,{...main,qualification:{...q,accepted:false}},c),
 ()=>validateTransition(dev,{...main,qualification:{...q,full_consumer_result:'skipped'}},c),
 ()=>validateTransition(dev,{...main,qualification:{...q,tested_product_set_sha256:'0'.repeat(64)}},c),
 ()=>validateTransition(main,{...prod,tag:'v0.0.10-prod'},c),
 ()=>validateTransition(null,{...dev,tag:'v0.0.10-dev.0'},c)
];
for(const test of negatives)assert.throws(test);
console.log(JSON.stringify({accepted:true,positive_transitions:3,negative_tests:negatives.length,publishes:false}));
