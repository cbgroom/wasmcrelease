// Project only metadata from the exact completed private r13 execution.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyBuildInputsUnchanged} from './current-v2-build-input-snapshot.mjs';
import {captureCargoRegistry} from './current-v2-registry-source-witness.mjs';
import {bindGeneratedAdapterReport} from './current-v2-generated-adapter-snapshot.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),work=resolve(process.argv[2]??'');
const expected='/Users/youxianshi/code/.worktrees/wasmc/current-v2-builder2/target/portable-v2-adapter-observed-owned-r13';
assert.equal(work,expected,'this capture admits only the exact observed r13');assert.equal(realpathSync(work),work);
const json=path=>JSON.parse(readFileSync(path)),sha=b=>createHash('sha256').update(b).digest('hex');
const identity=path=>{const stat=lstatSync(path);assert(stat.isFile()&&!stat.isSymbolicLink());const b=readFileSync(path);return {bytes:b.length,sha256:sha(b)};};
const receiptBytes=readFileSync(join(work,'build-receipt.json')),r=JSON.parse(receiptBytes);
assert.equal(r.source_authority,'c0ac1e389b7f38d9a875fcb1cdda7ecf0200c150');
assert.equal(r.producer_authority,'3b797a77d0afa25264a11362603b0d596d2e0ba7');
assert.equal(r.packages.length,1);const p=r.packages[0];assert.equal(p.id,'wasmc-owned-algorithms');assert.equal(p.version,'0.1.0');assert.equal(p.builds.length,2);
const staged=join(root,'admission/current-v2-next/packages',p.id,p.version),inventory={};
function walk(dir,prefix=''){
  for(const name of readdirSync(dir).sort()){
    const path=join(dir,name),stat=lstatSync(path);assert(!stat.isSymbolicLink());
    if(stat.isDirectory())walk(path,prefix+name+'/');else inventory[prefix+name]=identity(path);
  }
}
walk(staged);assert.equal(Object.keys(inventory).length,9);
const dependencyInventory=json(join(root,'admission/current-v2-next/dependency-inventory.json'));
function snapshot(value){
  assert.equal(value.schema,'wasmc.generated-adapter-input-snapshot/v1');
  const expectedFiles=value.lock_required?['Cargo.lock','Cargo.toml','mapping.json','src/lib.rs']:['Cargo.toml','mapping.json','src/lib.rs'];
  assert.deepEqual(Object.keys(value.files),expectedFiles);
  const files={};for(const path of expectedFiles){const f=value.files[path];assert(Number.isSafeInteger(f.bytes)&&f.bytes>=0&&f.bytes<=8*1024*1024);assert.match(f.sha256,/^[0-9a-f]{64}$/);files[path]={bytes:f.bytes,sha256:f.sha256};}
  assert.equal(sha(Buffer.from(JSON.stringify(files))),value.sha256);
  return {schema:value.schema,lock_required:value.lock_required,files,sha256:value.sha256};
}
const builds=p.builds.map((b,i)=>{
  const pass=['first','second'][i],base=join(work,p.id,pass),workspace=join(base,'workspace');
  verifyBuildInputsUnchanged(workspace,b.source_inputs,{siblingWit:true});
  assert.deepEqual(captureCargoRegistry(dependencyInventory,'/Users/youxianshi/.cargo',workspace),b.registry_sources);
  assert.deepEqual(b.inventory,inventory,'observed package differs from staged complete package');
  for(const [path,value] of Object.entries(inventory))assert.deepEqual(identity(join(base,'package',p.id,path)),value);
  const rows=b.cargo_observer.observations;assert.equal(rows.length,3);
  const lock=rows.find(o=>o.kind==='lock'),build=rows.find(o=>o.kind==='build'),version=rows.find(o=>o.kind==='version');
  assert(lock&&build&&version);assert(lock.generated&&build.generated&&!version.generated);
  for(const o of rows){assert.equal(o.exit_code,0);assert.equal(o.signal,null);for(const key of ['delegate_sha256','observer_sha256','snapshot_sha256'])assert.match(o[key],/^[0-9a-f]{64}$/);}
  assert.equal(lock.adapter,build.adapter);assert.deepEqual(lock.after.files,build.before.files);assert.deepEqual(build.before,build.after);assert.equal(build.real_build_observed,true);
  const manifest=json(join(staged,'lib.json'));
  const binding=bindGeneratedAdapterReport(build.after,{generated_source_sha256:b.report.generated_source_sha256,mapping_sha256:b.report.mapping_sha256,cargo_lock_sha256:manifest.build.inputs[0].sha256});
  return {pass,lock_before:snapshot(lock.before),lock_after:snapshot(lock.after),build_before:snapshot(build.before),build_after:snapshot(build.after),
    delegate_sha256:build.delegate_sha256,observer_sha256:build.observer_sha256,snapshot_sha256:build.snapshot_sha256,
    real_generated_adapter_build_observed:true,inputs_unchanged_during_locked_build:true,source_mapping_lock_bound:binding.source_mapping_lock_bound};
});
for(const path of ['Cargo.lock','mapping.json','src/lib.rs'])assert.deepEqual(builds[0].build_after.files[path],builds[1].build_after.files[path]);
console.log(JSON.stringify({schema:'wasmc.current-v2-owned-generated-adapter-observation/v1',
  source_authority:r.source_authority,producer_authority:r.producer_authority,private_receipt:{bytes:receiptBytes.length,sha256:sha(receiptBytes)},
  package:p.id,version:p.version,profile:'explicit-per-producer-child-Cargo-delegate',builds,delivery_inventory:inventory,
  complete_second_build_byte_identical:true,existing_staged_complete_package_byte_identical:true,
  retained_workspace_and_registry_rechecked:true,generated_source_mapping_lock_independent_equal:true,
  generated_manifest_independently_qualified:false,independent_generated_manifest_comparison:false,
  source_bodies_carried:false,licensed_recipient_delivery:false,full_transitive_license_audit:false,release_qualified:false},null,2));
