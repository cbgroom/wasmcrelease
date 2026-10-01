import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,cpSync,writeFileSync,rmSync,realpathSync,renameSync,symlinkSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {validateGeneratedManifestWitness,generatedManifestWitnessPath} from './current-v2-generated-manifest-witness.mjs';
const value=JSON.parse(readFileSync(generatedManifestWitnessPath));validateGeneratedManifestWitness(value);
let rejected=0;
for(const mutate of [v=>v.source_authority='0'.repeat(40),v=>v.producer_authority='0'.repeat(40),v=>v.builds.pop(),
  v=>v.generated_manifest_independently_qualified=false,v=>v.independent_generated_manifest_comparison=false,
  v=>v.licensed_recipient_delivery=true,v=>v.full_transitive_license_audit=true,v=>v.release_qualified=true,
  v=>v.builds[0].manifest_profile.model.dependency_package='other',v=>v.builds[0].manifest_profile.path_scrubbed_sha256='0'.repeat(64),
  v=>{for(const b of v.builds){b.build_after.files['src/lib.rs'].sha256='0'.repeat(64);b.build_before=structuredClone(b.build_after);b.lock_after.files=structuredClone(b.build_after.files);
    for(const s of [b.build_before,b.build_after,b.lock_after])s.sha256=createHash('sha256').update(JSON.stringify(s.files)).digest('hex');}},
]){const altered=structuredClone(value);mutate(altered);assert.throws(()=>validateGeneratedManifestWitness(altered));rejected++;}
const temp=mkdtempSync(join(realpathSync(tmpdir()),'wasmc-generated-witness-test-'));
try{
  const root='admission/current-v2-next/packages/wasmc-owned-algorithms/0.1.0',dest=join(temp,root);
  mkdirSync(dirname(dest),{recursive:true});cpSync(root,dest,{recursive:true,errorOnExist:true,force:false});
  validateGeneratedManifestWitness(value,temp);
  writeFileSync(join(dest,'unexpected.rs'),'extra');assert.throws(()=>validateGeneratedManifestWitness(value,temp));rejected++;rmSync(join(dest,'unexpected.rs'));
  const artifact=join(dest,'artifact.wasm'),target=join(temp,'artifact-target');renameSync(artifact,target);
  assert.throws(()=>validateGeneratedManifestWitness(value,temp));rejected++;
  symlinkSync(target,artifact);assert.throws(()=>validateGeneratedManifestWitness(value,temp));rejected++;rmSync(artifact);renameSync(target,artifact);
  writeFileSync(artifact,Buffer.concat([readFileSync(artifact),Buffer.from([0])]));assert.throws(()=>validateGeneratedManifestWitness(value,temp));rejected++;
  assert.equal(rejected,15);
  console.log(JSON.stringify({accepted:true,negative_controls:rejected,actual_package_reopened:true,
    private_builds_reexecuted:false,release_qualified:false}));
}finally{rmSync(temp,{recursive:true,force:true});}
