import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewRegistryNotices,validateRegistryNoticeReview} from './current-v2-registry-notice-review.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const inventory=read('admission/current-v2-next/dependency-inventory.json');
const receipt=read('admission/current-v2-next/registry-notice-review.json');
const result=validateRegistryNoticeReview(receipt);let rejected=0;
for(const change of [
  x=>x.full_transitive_license_audit=true,x=>x.release_qualified=true,
  x=>x.target_applicability_reviewed=true,x=>x.toolchain_obligations_reviewed=true,
  x=>x.complete_original_notice_materials=false,x=>x.registry_crates=18,
  x=>x.crates.pop(),x=>x.references.MIT='https://example.invalid/license',
  x=>x.crates.find(c=>c.id.startsWith('arrow-array@')).selected_licenses=['MIT'],
  x=>x.crates.find(c=>c.id.startsWith('encoding_rs@')).selected_licenses=['MIT'],
  x=>x.crates.find(c=>c.id.startsWith('unicode-ident@')).evidence.pop(),
  x=>x.crates.find(c=>c.id.startsWith('fnv@')).selected_licenses=['MIT'],
  x=>x.crates.find(c=>c.id.startsWith('r-efi@')).selected_licenses=['LGPL-2.1-or-later'],
  x=>x.crates[0].retained_notices.pop(),
  x=>x.dependency_inventory_sha256='0'.repeat(64),
  x=>x.delivery_binding_sha256='0'.repeat(64), // Reject a circular/extra field.
]){const value=structuredClone(receipt);change(value);assert.throws(()=>validateRegistryNoticeReview(value));rejected++;}
// These controls attack the review inputs, not just its result status fields.
const crate=name=>inventory.crates.find(x=>x.name===name);
for(const [name,remove] of [
  ['arrow-array',n=>n.path==='LICENSE-MIT'],
  ['arrow-array',n=>n.path==='LICENSE.txt'],
  ['encoding_rs',n=>n.path==='LICENSE-WHATWG'],
  ['unicode-ident',n=>n.path==='LICENSE-UNICODE'],
  ['r-efi',n=>n.path==='AUTHORS'],
  ['fnv',n=>n.path==='LICENSE-APACHE'],
]){
  const value=structuredClone(crate(name));value.notices=value.notices.filter(n=>!remove(n));
  assert.throws(()=>reviewRegistryNotices({crates:[value]}));rejected++;
}
const llvm=structuredClone(crate('cranelift-assembler-x64'));
llvm.supplemental_notices=[];assert.throws(()=>reviewRegistryNotices({crates:[llvm]}));rejected++;
const altered=structuredClone(crate('arrow-array'));
const notice=altered.notices.find(n=>n.path==='LICENSE.txt');
notice.content='Apache-2.0';notice.sha256=createHash('sha256').update(notice.content).digest('hex');
assert.throws(()=>reviewRegistryNotices({crates:[altered]}));rejected++;
for(const license of ['MIT OR Proprietary','GPL-3.0-only','MIT AND Unicode-4.0']){
  assert.throws(()=>reviewRegistryNotices({crates:[{...crate('bytes'),license}]}));rejected++;
}
assert.equal(receipt.crates.find(x=>x.id.startsWith('r-efi@')).selected_licenses[0],'MIT');
assert.equal(receipt.crates.find(x=>x.id.startsWith('arrow-array@')).selected_licenses.length,2);
assert.equal(receipt.crates.find(x=>x.id.startsWith('encoding_rs@')).selected_licenses.length,2);
assert.equal(receipt.crates.find(x=>x.id.startsWith('fnv@')).selected_licenses.length,2);
assert.equal(new Set(receipt.crates.map(x=>x.id)).size,189);
console.log(JSON.stringify({...result,negative_controls:rejected}));
