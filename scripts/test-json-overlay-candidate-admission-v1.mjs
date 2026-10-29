import assert from 'node:assert/strict';
import {qualifyJsonOverlayCandidate} from './json-overlay-candidate-admission-v1.mjs';
import {relativeModuleImports} from './release-candidate.mjs';
import {readFileSync} from 'node:fs';
const [privateRoot,publicRoot,catalogSha,oldSha,receiptSha,witPath,witSha,commit,version,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
// Inspect the actual transitive product entrypoint graph, not just Root files.
// The private preflight can use Q0, but neither delivered entrypoint may import it.
const forbidden=new Set(['scripts/json-overlay-candidate-admission-v1.mjs','scripts/json-combined-product-v1.mjs','scripts/json-portable-q0-v1.mjs','scripts/current-license-policy-json-overlay-v1.mjs']);
function publicGraph(read){
 const queue=['scripts/wasmc-lib.mjs','scripts/release-candidate.mjs'],visited=new Set();
 while(queue.length){const path=queue.pop();if(visited.has(path))continue;
  assert.ok(!forbidden.has(path)&&!path.startsWith('proof/')&&!path.includes('/producer/'),'private preflight in public graph: '+path);
  visited.add(path);for(const dep of relativeModuleImports(path,read(path)))if(/\.(mjs|js)$/.test(dep))queue.push(dep);
 }return visited;
}
const realRead=p=>readFileSync(new URL('../'+p,import.meta.url));
const graph=publicGraph(realRead);assert.ok(graph.has('scripts/json-overlay-public-v1.mjs'));
assert.throws(()=>publicGraph(p=>p==='scripts/release-candidate.mjs'?Buffer.concat([realRead(p),Buffer.from('\nimport("./json-overlay-candidate-admission-v1.mjs");\n')]):realRead(p)),/private preflight in public graph/);
const args={privateRoot,publicRoot,catalogSha,oldSha,receiptSha,witPath,witSha,commit,version};
const result=await qualifyJsonOverlayCandidate(args);
assert.equal(result.accepted,true);assert.equal(result.private_q0_verified,true);assert.equal(result.public_projection_verified,true);
assert.equal(result.packages,43);assert.equal(result.root_files,822);assert.equal(result.index_entries,332);
assert.ok(result.public_notice_paths>0);assert.ok(result.public_input_paths.includes('admission/json-overlay-prior-catalog-v1.json'));
assert.ok(result.public_input_paths.includes('admission/json-overlay-prior-index-v1.json'));
assert.ok(result.public_input_paths.every(p=>!p.startsWith('proof/')&&!p.includes('json-q0')&&!p.includes('producer')));
for(const change of [{catalogSha:'0'.repeat(64)},{receiptSha:'0'.repeat(64)},{oldSha:'0'.repeat(64)},{witSha:'0'.repeat(64)},{commit:'0'.repeat(40)},{version:'0.0.30'}])
 await assert.rejects(qualifyJsonOverlayCandidate({...args,...change}));
console.log(JSON.stringify({status:'PASS',version:result.version,packages:result.packages,root_files:result.root_files,index_entries:result.index_entries,public_notice_paths:result.public_notice_paths,public_input_count:result.public_input_paths.length,negative_controls:7,public_entrypoint_modules:graph.size,private_preflight_in_public_graph:false,formal_release:false}));
