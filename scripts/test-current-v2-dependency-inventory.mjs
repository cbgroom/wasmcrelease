#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {registryRows,validateInventory} from './current-v2-dependency-inventory.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const receipt=JSON.parse(readFileSync(join(root,'admission/current-v2-next/dependency-inventory.json')));
const result=validateInventory(receipt);let rejected=0;
const reject=mutation=>{const copy=structuredClone(receipt);mutation(copy);assert.throws(()=>validateInventory(copy));rejected++;};
reject(x=>x.inputs.pop());reject(x=>x.inputs[0].sha256='0'.repeat(64));
reject(x=>x.inputs[0].registry.pop());reject(x=>x.crates.pop());reject(x=>x.crates.push(x.crates[0]));
reject(x=>x.crates[0].checksum='0'.repeat(64));reject(x=>x.crates.reverse());
reject(x=>x.registry_inventory_complete=false);reject(x=>x.archive_inventory_complete=!x.archive_inventory_complete);
reject(x=>x.packaged_notice_inventory_complete=!x.packaged_notice_inventory_complete);
reject(x=>x.notice_material_inventory_complete=!x.notice_material_inventory_complete);
reject(x=>x.full_transitive_license_audit=true);reject(x=>x.release_qualified=true);reject(x=>x.pending_scopes.pop());
reject(x=>x.toolchain_notices.receipt_sha256='0'.repeat(64));
const withNotice=receipt.crates.findIndex(x=>x.notices.length);
assert(withNotice>=0);
reject(x=>x.crates[withNotice].notices[0].content+='tamper');
reject(x=>x.crates[withNotice].notices[0].path='../LICENSE');
reject(x=>x.crates[withNotice].notices=[]);
reject(x=>{x.crates[withNotice].license=null;x.crates[withNotice].license_file=null;});
const supplemented=receipt.crates.findIndex(x=>x.supplemental_notices?.length);
assert(supplemented>=0);
reject(x=>x.crates[supplemented].repository_commit='0'.repeat(40));
reject(x=>x.crates[supplemented].supplemental_notices[0].url=x.crates[supplemented].supplemental_notices[0].url.replace(x.crates[supplemented].repository_commit,'main'));
reject(x=>x.crates[supplemented].supplemental_notices[0].content+='tamper');
assert.throws(()=>registryRows('[[package]]\nname = "x"\nversion = "1"\nsource = "git+https://example.org/x"\n'));rejected++;
assert.throws(()=>registryRows('[[package]]\nname = "../x"\nversion = "1"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\nchecksum = "bad"\n'));rejected++;
// Actual files, not just JSON fields: retained adapter inputs cannot be omitted,
// tampered with, or replaced by a linked input/directory.
const fixture=mkdtempSync(join(tmpdir(),'wasmc-dependency-inputs-'));
try{
  const files=[...new Set(receipt.inputs.flatMap(x=>[x.path,...(x.manifest?[x.manifest]:[])]))];
  for(const path of files){const target=join(fixture,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,readFileSync(join(root,path)));}
  validateInventory(receipt,fixture);
  const adapter=receipt.inputs.find(x=>x.id==='host-clock');assert(adapter);
  const path=join(fixture,adapter.path),original=readFileSync(path);
  writeFileSync(path,Buffer.concat([original,Buffer.from('\n# changed\n')]));
  assert.throws(()=>validateInventory(receipt,fixture));rejected++;writeFileSync(path,original);
  rmSync(path);assert.throws(()=>validateInventory(receipt,fixture));rejected++;
  symlinkSync(join(root,adapter.path),path);assert.throws(()=>validateInventory(receipt,fixture));rejected++;rmSync(path);writeFileSync(path,original);
  const inputDir=dirname(path);rmSync(inputDir,{recursive:true});symlinkSync(join(root,'admission/current-v2-next/dependency-inputs'),inputDir,'dir');
  assert.throws(()=>validateInventory(receipt,fixture));rejected++;
}finally{rmSync(fixture,{recursive:true,force:true});}
console.log(JSON.stringify({...result,negative_controls:rejected}));
