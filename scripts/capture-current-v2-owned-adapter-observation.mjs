// Project only metadata from exact completed private r13/r14 executions.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyBuildInputsUnchanged,readCommittedBuildInput} from './current-v2-build-input-snapshot.mjs';
import {captureCargoRegistry} from './current-v2-registry-source-witness.mjs';
import {bindGeneratedAdapterReport} from './current-v2-generated-adapter-snapshot.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),work=resolve(process.argv[2]??'');
const producer='/Users/youxianshi/code/.worktrees/wasmc/current-v2-builder2';
const executions={
  [join(producer,'target/portable-v2-adapter-observed-owned-r13')]:{authority:'c0ac1e389b7f38d9a875fcb1cdda7ecf0200c150',manifestQualified:false},
  [join(producer,'target/portable-v2-adapter-manifest-qualified-owned-r14')]:{authority:'7f4cdf577f4e99032a901f73df5170061ef3902d',manifestQualified:true},
};
const execution=executions[work];assert(execution,'this capture admits only exact observed r13/r14');assert.equal(realpathSync(work),work);
const json=path=>JSON.parse(readFileSync(path)),sha=b=>createHash('sha256').update(b).digest('hex');
const identity=path=>{const stat=lstatSync(path);assert(stat.isFile()&&!stat.isSymbolicLink());const b=readFileSync(path);return {bytes:b.length,sha256:sha(b)};};
const receiptBytes=readFileSync(join(work,'build-receipt.json')),r=JSON.parse(receiptBytes);
assert.equal(r.source_authority,execution.authority);
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
const originalSpec=JSON.parse(readCommittedBuildInput(producer,r.producer_authority,'examples/wasmc_lib_dual_view_candidate_v0/lib.build.json'));
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
  for(const [key,path] of [['observer_sha256','scripts/current-v2-cargo-adapter-observer.mjs'],['snapshot_sha256','scripts/current-v2-generated-adapter-snapshot.mjs']])
    assert.equal(build[key],sha(readCommittedBuildInput(root,r.source_authority,path)));
  let manifestProfile=null;
  if(execution.manifestQualified){
    assert.deepEqual(json(join(workspace,'lib.build.json')),originalSpec);
    assert(build.manifest_independently_qualified&&lock.manifest_independently_qualified);
    assert(b.cargo_observer.manifest_independently_qualified&&b.cargo_observer.independent_generated_manifest_comparison);
    assert.deepEqual(build.manifest_profile,lock.manifest_profile);
    const profile=build.manifest_profile;
    assert.equal(profile.raw_sha256,build.after.files['Cargo.toml'].sha256);assert.equal(profile.raw_bytes,build.after.files['Cargo.toml'].bytes);
    const model={package_name:'wasmc-lib-adapter',version:originalSpec.skill.version,edition:'2024',crate_type:'cdylib',panic:'abort',
      dependency_alias:originalSpec.rust.dependency_alias,dependency_package:originalSpec.rust.dependency_package,
      dependency_path:'workspace/'+originalSpec.rust.crate_dir,isolated_workspace:true};
    assert.deepEqual(profile.model,model);assert.equal(profile.semantic_sha256,sha(Buffer.from(JSON.stringify(model))));
    assert.match(profile.path_scrubbed_sha256,/^[0-9a-f]{64}$/);
    assert.equal(profile.expected_contract_checked,true);assert.equal(profile.only_one_expected_path_literal_normalized,true);
    assert.equal(profile.general_TOML_supported,false);assert.equal(profile.full_transitive_license_audit,false);assert.equal(profile.release_qualified,false);
    assert.equal(build.manifest_auditor_sha256,sha(readCommittedBuildInput(root,r.source_authority,'scripts/current-v2-generated-manifest-profile.mjs')));
    manifestProfile={schema:profile.schema,raw_bytes:profile.raw_bytes,raw_sha256:profile.raw_sha256,
      path_scrubbed_sha256:profile.path_scrubbed_sha256,semantic_sha256:profile.semantic_sha256,model,
      expected_contract_checked:true,only_one_expected_path_literal_normalized:true,general_TOML_supported:false,
      full_transitive_license_audit:false,release_qualified:false};
  }
  const manifest=json(join(staged,'lib.json'));
  const binding=bindGeneratedAdapterReport(build.after,{generated_source_sha256:b.report.generated_source_sha256,mapping_sha256:b.report.mapping_sha256,cargo_lock_sha256:manifest.build.inputs[0].sha256});
  return {pass,lock_before:snapshot(lock.before),lock_after:snapshot(lock.after),build_before:snapshot(build.before),build_after:snapshot(build.after),
    delegate_sha256:build.delegate_sha256,observer_sha256:build.observer_sha256,snapshot_sha256:build.snapshot_sha256,
    real_generated_adapter_build_observed:true,inputs_unchanged_during_locked_build:true,source_mapping_lock_bound:binding.source_mapping_lock_bound,
    ...(manifestProfile?{manifest_profile:manifestProfile,manifest_auditor_sha256:build.manifest_auditor_sha256}:{})};
});
for(const path of ['Cargo.lock','mapping.json','src/lib.rs'])assert.deepEqual(builds[0].build_after.files[path],builds[1].build_after.files[path]);
if(execution.manifestQualified){
  assert.deepEqual(builds[0].manifest_profile.model,builds[1].manifest_profile.model);
  assert.equal(builds[0].manifest_profile.path_scrubbed_sha256,builds[1].manifest_profile.path_scrubbed_sha256);
}
console.log(JSON.stringify({schema:execution.manifestQualified?'wasmc.current-v2-owned-generated-adapter-observation/v2':'wasmc.current-v2-owned-generated-adapter-observation/v1',
  source_authority:r.source_authority,producer_authority:r.producer_authority,private_receipt:{bytes:receiptBytes.length,sha256:sha(receiptBytes)},
  package:p.id,version:p.version,profile:'explicit-per-producer-child-Cargo-delegate',builds,delivery_inventory:inventory,
  complete_second_build_byte_identical:true,existing_staged_complete_package_byte_identical:true,
  retained_workspace_and_registry_rechecked:true,generated_source_mapping_lock_independent_equal:true,
  generated_manifest_independently_qualified:execution.manifestQualified,independent_generated_manifest_comparison:execution.manifestQualified,
  source_bodies_carried:false,licensed_recipient_delivery:false,full_transitive_license_audit:false,release_qualified:false},null,2));
