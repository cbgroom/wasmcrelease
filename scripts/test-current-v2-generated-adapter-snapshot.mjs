import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {snapshotGeneratedAdapter,verifyGeneratedAdapterUnchanged,bindGeneratedAdapterReport} from './current-v2-generated-adapter-snapshot.mjs';
const temp=mkdtempSync(join(realpathSync(tmpdir()),'wasmc-adapter-witness-test-'));
let rejected=0;
const reject=fn=>{assert.throws(fn);rejected++;};
try{
  const workspace=join(temp,'workspace'),adapter=join(workspace,'.wasmc-rust-adapter-123-0');
  mkdirSync(join(adapter,'src'),{recursive:true});
  const inputs={'Cargo.toml':'[package]\nname="fixture"\n','Cargo.lock':'lock fixture\n','mapping.json':'{}\n','src/lib.rs':'pub fn fixture() {}\n'};
  for(const [path,body] of Object.entries(inputs))writeFileSync(join(adapter,path),body);
  const before=snapshotGeneratedAdapter(workspace,adapter);
  assert.equal(Object.keys(before.files).length,4);
  assert.deepEqual(verifyGeneratedAdapterUnchanged(workspace,adapter,before),before);
  const expected={generated_source_sha256:before.files['src/lib.rs'].sha256,mapping_sha256:before.files['mapping.json'].sha256,cargo_lock_sha256:before.files['Cargo.lock'].sha256};
  assert.deepEqual(bindGeneratedAdapterReport(before,expected),{source_mapping_lock_bound:true,manifest_independently_qualified:false,real_build_observed:false,full_transitive_license_audit:false,release_qualified:false});
  for(const [path,body] of Object.entries(inputs)){
    writeFileSync(join(adapter,path),body+'changed');
    reject(()=>verifyGeneratedAdapterUnchanged(workspace,adapter,before));
    writeFileSync(join(adapter,path),body);
    rmSync(join(adapter,path));reject(()=>snapshotGeneratedAdapter(workspace,adapter));
    writeFileSync(join(adapter,path),body);
  }
  for(const key of Object.keys(expected))reject(()=>bindGeneratedAdapterReport(before,{...expected,[key]:'0'.repeat(64)}));
  reject(()=>bindGeneratedAdapterReport(before,{}));
  // A Cargo output directory alone does not change the input snapshot.
  mkdirSync(join(adapter,'target'));writeFileSync(join(adapter,'target','output.wasm'),'output');
  assert.deepEqual(snapshotGeneratedAdapter(workspace,adapter),before);
  mkdirSync(join(adapter,'src','target'));writeFileSync(join(adapter,'src','target','input.rs'),'input');
  reject(()=>verifyGeneratedAdapterUnchanged(workspace,adapter,before));
  rmSync(join(adapter,'src','target'),{recursive:true});
  symlinkSync(join(adapter,'src','lib.rs'),join(adapter,'linked.rs'));
  reject(()=>snapshotGeneratedAdapter(workspace,adapter));rmSync(join(adapter,'linked.rs'));
  const linked=join(temp,'linked-workspace');symlinkSync(workspace,linked);
  reject(()=>snapshotGeneratedAdapter(linked,join(linked,'.wasmc-rust-adapter-123-0')));
  reject(()=>snapshotGeneratedAdapter(temp,adapter));
  const unknown=join(workspace,'other-crate');mkdirSync(unknown);
  reject(()=>snapshotGeneratedAdapter(workspace,unknown));
  const linkedAdapter=join(workspace,'.wasmc-rust-adapter-123-1');symlinkSync(adapter,linkedAdapter);
  reject(()=>snapshotGeneratedAdapter(workspace,linkedAdapter));
  mkdirSync(join(adapter,'.git'));reject(()=>snapshotGeneratedAdapter(workspace,adapter));
  rmSync(join(adapter,'.git'),{recursive:true});
  writeFileSync(join(adapter,'oversized'),Buffer.alloc(8*1024*1024+1));
  reject(()=>snapshotGeneratedAdapter(workspace,adapter));rmSync(join(adapter,'oversized'));
  for(const name of ['large-one','large-two'])writeFileSync(join(adapter,name),Buffer.alloc(8*1024*1024));
  reject(()=>snapshotGeneratedAdapter(workspace,adapter));
  for(const name of ['large-one','large-two'])rmSync(join(adapter,name));
  for(let i=0;i<125;i++)writeFileSync(join(adapter,`extra-${i}`),'');
  reject(()=>snapshotGeneratedAdapter(workspace,adapter));
  assert.equal(rejected,22);
  console.log(JSON.stringify({accepted:true,negative_controls:rejected,complete_generated_inputs_captured:true,
    root_Cargo_output_excluded:true,nested_target_retained:true,source_bodies_retained:false,
    real_build_observed:false,release_qualified:false}));
}finally{rmSync(temp,{recursive:true,force:true});}
