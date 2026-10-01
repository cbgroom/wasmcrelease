// Reopen one exact source-free r14 observation against independent identities.
// Does not execute the private producer or reconstruct deleted adapter bodies.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),sha=b=>createHash('sha256').update(b).digest('hex');
export const generatedManifestWitnessPath='admission/current-v2-next/owned-generated-manifest-qualification.json';
const observedDigest='006ffe631076cccae366e7cfa0e0acaf4da0c1a8318f6e0df8558d2099baf97c';
export function validateGeneratedManifestWitness(value,base=root){
  assert.equal(sha(Buffer.from(JSON.stringify(value,null,2)+'\n')),observedDigest,'exact observed generated witness drift');
  assert.equal(value.schema,'wasmc.current-v2-owned-generated-adapter-observation/v2');
  assert.equal(value.source_authority,'7f4cdf577f4e99032a901f73df5170061ef3902d');
  assert.equal(value.producer_authority,'3b797a77d0afa25264a11362603b0d596d2e0ba7');
  assert.equal(value.package,'wasmc-owned-algorithms');assert.equal(value.version,'0.1.0');
  assert.equal(value.profile,'explicit-per-producer-child-Cargo-delegate');
  for(const key of ['complete_second_build_byte_identical','existing_staged_complete_package_byte_identical',
    'retained_workspace_and_registry_rechecked','generated_source_mapping_lock_independent_equal',
    'generated_manifest_independently_qualified','independent_generated_manifest_comparison'])assert.equal(value[key],true);
  for(const key of ['source_bodies_carried','licensed_recipient_delivery','full_transitive_license_audit','release_qualified'])assert.equal(value[key],false);
  assert.equal(value.builds.length,2);
  for(const b of value.builds){
    assert.deepEqual(b.build_before,b.build_after);assert.deepEqual(b.lock_after.files,b.build_before.files);
    assert.equal(b.manifest_profile.raw_sha256,b.build_after.files['Cargo.toml'].sha256);
    assert.equal(b.manifest_profile.raw_bytes,b.build_after.files['Cargo.toml'].bytes);
    assert.equal(b.manifest_profile.expected_contract_checked,true);
    assert.equal(b.manifest_profile.only_one_expected_path_literal_normalized,true);
    assert.equal(b.manifest_profile.general_TOML_supported,false);
  }
  assert.deepEqual(value.builds[0].manifest_profile.model,value.builds[1].manifest_profile.model);
  assert.equal(value.builds[0].manifest_profile.path_scrubbed_sha256,value.builds[1].manifest_profile.path_scrubbed_sha256);
  const trusted=JSON.parse(readFileSync(join(root,'admission/current-v2-next/build-receipts.json'))).packages.find(p=>p.id===value.package);
  assert.deepEqual(value.delivery_inventory,trusted.builds[0].inventory);
  const dir=resolve(base,trusted.root);assert.equal(realpathSync(dir),dir,'linked generated-witness delivery root');
  const actual={};
  const walk=path=>{for(const name of readdirSync(path).sort()){
    const target=join(path,name),stat=lstatSync(target);assert(!stat.isSymbolicLink(),'linked generated-witness delivery input');
    if(stat.isDirectory())walk(target);else{assert(stat.isFile());const bytes=readFileSync(target);actual[relative(dir,target)]={bytes:bytes.length,sha256:sha(bytes)};}
  }};
  walk(dir);assert.deepEqual(actual,value.delivery_inventory,'generated-witness package drift');
  return {accepted:true,packages:1,independent_builds:2,generated_input_files:4,
    exact_observed_manifest_qualification:true,private_builds_reexecuted:false,
    private_adapter_bodies_reopened:false,full_transitive_license_audit:false,release_qualified:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv.length,2);console.log(JSON.stringify(validateGeneratedManifestWitness(JSON.parse(readFileSync(join(root,generatedManifestWitnessPath))))));
}
