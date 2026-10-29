import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateCandidate,validateProductModuleImports} from './release-candidate.mjs';
const files=new Map([
  ['scripts/main.mjs',Buffer.from("import './static.mjs'; export {v} from './reexport.mjs'; import('./lazy.mjs'); require('./required.mjs'); import 'node:fs';")],
  ['scripts/static.mjs',Buffer.from("import '../lib/shared.mjs';")],
  ['scripts/reexport.mjs',Buffer.from('export const v=1;')],
  ['scripts/lazy.mjs',Buffer.from('export default 1;')],
  ['scripts/required.mjs',Buffer.from('export default 2;')],
  ['lib/shared.mjs',Buffer.from('export default 3;')],
]);
const rows=()=>[...files.keys()].map(path=>({path}));
const read=path=>{assert.ok(files.has(path),`unexpected outside inventory read ${path}`);return files.get(path);};
assert.equal(validateProductModuleImports(rows(),read,['scripts/main.mjs']),true);
for(const path of ['scripts/static.mjs','scripts/reexport.mjs','scripts/lazy.mjs','scripts/required.mjs','lib/shared.mjs']){
  const shortened=rows().filter(row=>row.path!==path);
  assert.throws(()=>validateProductModuleImports(shortened,read,['scripts/main.mjs']),/product module import missing/);
}
files.set('scripts/main.mjs',Buffer.from("import '../../outside.mjs';"));
assert.throws(()=>validateProductModuleImports(rows(),read,['scripts/main.mjs']),/outside product/);
// The candidate verifier must enforce the check even for an otherwise valid,
// rehashed inventory and a reader that can still access the omitted file.
const delivered=new Map([
  ['scripts/wasmc-lib.mjs',Buffer.from("import './omitted.mjs';")],
  ['scripts/release-candidate.mjs',Buffer.from('export {};')],
]);
const sha=b=>createHash('sha256').update(b).digest('hex');
const inventory=[...delivered].map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha(bytes)})).sort((a,b)=>a.path<b.path?-1:1);
const candidate={schema:'wasmc.release-product-candidate/v3',version:'0.0.31',compiler_source_authority:'1'.repeat(40),lib_source_authority:'2'.repeat(40),product_files:inventory,product_set_sha256:sha(JSON.stringify(inventory))};
assert.throws(()=>validateCandidate(candidate,p=>delivered.get(p)??Buffer.from('still available outside inventory')),/product module import missing/);
console.log(JSON.stringify({accepted:true,missing_controls:5,escape_controls:1,candidate_inventory_control:1,scope:'literal relative module dependency inventory, not a full JavaScript parser or product release'}));
