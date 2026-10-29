import assert from 'node:assert/strict';
import {qualifyJsonOverlayCandidate} from './json-overlay-candidate-admission-v1.mjs';
const [privateRoot,publicRoot,catalogSha,oldSha,receiptSha,witPath,witSha,commit,version,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
const args={privateRoot,publicRoot,catalogSha,oldSha,receiptSha,witPath,witSha,commit,version};
const result=await qualifyJsonOverlayCandidate(args);
assert.equal(result.accepted,true);assert.equal(result.private_q0_verified,true);assert.equal(result.public_projection_verified,true);
assert.equal(result.packages,43);assert.equal(result.root_files,822);assert.equal(result.index_entries,332);
assert.ok(result.public_notice_paths>0);assert.ok(result.public_input_paths.includes('admission/json-overlay-prior-catalog-v1.json'));
assert.ok(result.public_input_paths.includes('admission/json-overlay-prior-index-v1.json'));
assert.ok(result.public_input_paths.every(p=>!p.startsWith('proof/')&&!p.includes('json-q0')&&!p.includes('producer')));
for(const change of [{catalogSha:'0'.repeat(64)},{receiptSha:'0'.repeat(64)},{oldSha:'0'.repeat(64)},{witSha:'0'.repeat(64)},{commit:'0'.repeat(40)},{version:'0.0.30'}])
 await assert.rejects(qualifyJsonOverlayCandidate({...args,...change}));
console.log(JSON.stringify({status:'PASS',version:result.version,packages:result.packages,root_files:result.root_files,index_entries:result.index_entries,public_notice_paths:result.public_notice_paths,public_input_count:result.public_input_paths.length,negative_controls:6,formal_release:false}));
