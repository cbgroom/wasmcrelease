#!/usr/bin/env node
// Finite notice review for the retained registry closure, not legal approval.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateInventory} from './current-v2-dependency-inventory.mjs';
import {validatePackageLicenseBindings} from './current-v2-package-license.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const inventoryPath='admission/current-v2-next/dependency-inventory.json';
const bindingPath='admission/current-v2-next/package-license-bindings.json';
const receiptPath='admission/current-v2-next/registry-notice-review.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=p=>readFileSync(resolve(root,p));
// Explicit reviewed choices. This is deliberately not an SPDX expression parser.
// Unknown expressions require new review; slash is NOT silently treated as OR.
const choices=new Map([
  ['MIT',['MIT']],['Apache-2.0',['Apache-2.0']],
  ['Apache-2.0 OR MIT',['MIT']],['MIT OR Apache-2.0',['MIT']],
  ['Apache-2.0 AND MIT',['Apache-2.0','MIT']],
  ['MIT/Apache-2.0',['MIT','Apache-2.0']],['Apache-2.0 / MIT',['Apache-2.0','MIT']],
  ['Apache-2.0 WITH LLVM-exception',['Apache-2.0 WITH LLVM-exception']],
  ['Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT',['MIT']],
  ['(Apache-2.0 OR MIT) AND BSD-3-Clause',['MIT','BSD-3-Clause']],
  ['(MIT OR Apache-2.0) AND Unicode-3.0',['MIT','Unicode-3.0']],
  ['BSD-2-Clause OR MIT OR Apache-2.0',['MIT']],
  ['BSD-2-Clause OR Apache-2.0 OR MIT',['MIT']],
  ['Unlicense OR MIT',['MIT']],['MIT OR Apache-2.0 OR LGPL-2.1-or-later',['MIT']],
  ['Zlib',['Zlib']],['CC0-1.0',['CC0-1.0']],
]);
const references=Object.fromEntries(['MIT','Apache-2.0','BSD-3-Clause','Unicode-3.0','Zlib','CC0-1.0','LLVM-exception'].map(id=>[id,`https://spdx.org/licenses/${id}.html`]));
function supports(license,text){
  const t=text.replace(/\s+/g,' ').toLowerCase();
  const has=(...parts)=>parts.every(part=>t.includes(part));
  switch(license){
    case 'MIT': return has('permission is hereby granted','copyright notice and this permission notice','shall be included','without warranty');
    case 'Apache-2.0': return text.length>8000&&has('terms and conditions','redistribution','trademarks','end of terms and conditions');
    case 'Apache-2.0 WITH LLVM-exception': return supports('Apache-2.0',text)&&has('llvm exceptions','sections 4(a), 4(b) and 4(d)','gplv2');
    case 'BSD-3-Clause': return has('redistributions in binary form','neither the name','endorse or promote','copyright','disclaimer');
    case 'Unicode-3.0': return has('unicode license v3','copyright and permission notice','associated documentation','advertising');
    case 'Zlib': return has('origin of this software','altered source versions','notice may not be removed');
    case 'CC0-1.0': return has('creative commons','waiver','public license fallback','disclaimer');
    default: return false;
  }
}
export function reviewRegistryNotices(inventory){
  return inventory.crates.map(crate=>{
    const selected=choices.get(crate.license);
    assert(selected,`unreviewed license expression: ${crate.name}: ${crate.license}`);
    const notices=[...crate.notices.map(n=>({origin:'archive',identity:n.path,...n})),
      ...crate.supplemental_notices.map(n=>({origin:'exact-upstream',identity:n.url,...n}))];
    assert(crate.archive_verified,`unverified registry archive: ${crate.name}`);
    for(const notice of notices)assert.equal(sha(Buffer.from(notice.content)),notice.sha256,'reviewed notice content drift');
    const evidence=selected.map(license=>{
      const matched=notices.filter(n=>supports(license,n.content));
      assert(matched.length,`missing selected notice evidence: ${crate.name}: ${license}`);
      return {license,notices:matched.map(n=>({origin:n.origin,identity:n.identity,sha256:n.sha256}))};
    });
    return {id:`${crate.name}@${crate.version}`,archive_sha256:crate.checksum,
      declared_expression:crate.license,selected_licenses:selected,
      selection:crate.license.includes('/')?'conservative-retain-both-no-OR-inference':crate.license.includes(' OR ')?'explicit-alternative-with-all-AND-terms':'all-declared-terms',
      evidence,retained_notices:notices.map(n=>({origin:n.origin,identity:n.identity,sha256:n.sha256}))};
  });
}
function expected(){
  const inventoryBytes=bytes(inventoryPath),inventory=JSON.parse(inventoryBytes);
  validateInventory(inventory);
  const bindingBytes=bytes(bindingPath),binding=JSON.parse(bindingBytes);
  validatePackageLicenseBindings(binding);
  assert(binding.files[inventoryPath],'reviewed complete notices are not carried');
  assert.equal(binding.files[inventoryPath].sha256,sha(inventoryBytes));
  const crates=reviewRegistryNotices(inventory);
  return {schema:'wasmc.current-v2-registry-notice-review/v1',
    scope:'conservative-all-lockfile-registry-packages-for-five-staged-roots-and-SDK-consumer',
    dependency_inventory_sha256:sha(inventoryBytes),delivery_binding_sha256:sha(bindingBytes),
    registry_crates:crates.length,declared_expressions:new Set(crates.map(x=>x.declared_expression)).size,
    references,crates,selected_notice_texts_present:true,complete_original_notices_carried:true,
    obligations:{copyright_and_permission_texts:'all retained without rewriting',
      apache_NOTICE:'all captured NOTICE materials retained; no applicability exclusions',
      upstream_relicense:'not permitted by this review',
      upstream_modification:'not attested; verify build sources and any patches separately',
      trademark_and_endorsement:'no permission inferred',
      LLVM_exception:'retained; no exception waiver relied upon'},
    review_receipt_carried:false,target_applicability_reviewed:false,toolchain_obligations_reviewed:false,
    full_transitive_license_audit:false,release_qualified:false,
    pending:['bind-review-receipt-into-delivery','verify-build-source-modifications-and-patches',
      'target-and-toolchain-obligation-review','remaining-thirteen-target-package-audits']};
}
export function validateRegistryNoticeReview(value){assert.deepEqual(value,expected(),'registry notice review drift');return {accepted:true,registry_crates:value.registry_crates,declared_expressions:value.declared_expressions,full_transitive_license_audit:false,release_qualified:false};}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const args=process.argv.slice(2);assert(args.length===0||(args.length===1&&args[0]==='--receipt'));
  const value=expected();if(args[0])writeFileSync(resolve(root,receiptPath),JSON.stringify(value,null,2)+'\n');
  console.log(JSON.stringify(validateRegistryNoticeReview(args[0]?value:JSON.parse(bytes(receiptPath)))));
}
