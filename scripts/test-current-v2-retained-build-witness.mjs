import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,realpathSync,mkdirSync,cpSync,writeFileSync,rmSync,renameSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRetainedBuildWitness,validateRegistryBuildWitness} from './current-v2-retained-build-witness.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const value=JSON.parse(readFileSync(join(root,'admission/current-v2-next/cohort-build-input-witness.json')));
const trusted=['admission/current-v2-next/build-receipts.json','admission/current-v2-data-core/build-receipts.json']
  .flatMap(path=>JSON.parse(readFileSync(join(root,path))).packages);
const temp=realpathSync(mkdtempSync(join(tmpdir(),'wasmc-retained-witness-')));let negatives=0;
const reject=mutate=>{const v=structuredClone(value);mutate(v);assert.throws(()=>validateRetainedBuildWitness(v,temp));negatives++;};
try{
  for(const p of trusted){const target=join(temp,p.root);mkdirSync(dirname(target),{recursive:true});cpSync(join(root,p.root),target,{recursive:true});}
  assert.equal(validateRetainedBuildWitness(value,temp).delivery_files,45);
  reject(v=>v.packages.pop());reject(v=>v.packages.push(v.packages[0]));
  reject(v=>v.source_authority='0'.repeat(40));reject(v=>v.producer_authority='0'.repeat(40));
  reject(v=>v.release_qualified=true);reject(v=>v.historical_builds_attested=true);
  reject(v=>v.full_transitive_license_audit=true);reject(v=>v.retained_inputs_rechecked=false);
  reject(v=>v.existing_staged_complete_packages_byte_identical=false);
  for(let i=0;i<5;i++){
    reject(v=>v.packages[i].builds[1].build_inputs_unchanged=false);
    reject(v=>{
      const p=v.packages[i];for(const b of p.builds){
        const s=b.source_inputs;Object.values(s.files)[0].sha256='0'.repeat(64);
        s.sha256=createHash('sha256').update(JSON.stringify(s.files)).digest('hex');
      }
    }); // Coordinated self-rehash must not authorize new source identity.
    const p=trusted[i],path=join(temp,p.root,'artifact.wasm'),bytes=readFileSync(path);
    writeFileSync(path,Buffer.concat([bytes,Buffer.from([0])]));
    assert.throws(()=>validateRetainedBuildWitness(value,temp));negatives++;
    writeFileSync(path,bytes);
  }
  const dir=join(temp,trusted[0].root),extra=join(dir,'unbound-file');writeFileSync(extra,'extra');
  assert.throws(()=>validateRetainedBuildWitness(value,temp));negatives++;rmSync(extra);
  const path=join(dir,'lib.wit'),saved=join(temp,'saved-wit');renameSync(path,saved);symlinkSync(saved,path);
  assert.throws(()=>validateRetainedBuildWitness(value,temp));negatives++;rmSync(path);renameSync(saved,path);
  const savedRoot=join(temp,'saved-root');renameSync(dir,savedRoot);symlinkSync(savedRoot,dir);
  assert.throws(()=>validateRetainedBuildWitness(value,temp));negatives++;rmSync(dir);renameSync(savedRoot,dir);
  assert.equal(validateRetainedBuildWitness(value,temp).packages,5);
  const workspaceNegatives=negatives;
  const registry=JSON.parse(readFileSync(join(root,'admission/current-v2-next/cohort-registry-build-witness.json')));
  assert.equal(validateRegistryBuildWitness(registry,temp).registry_crates,189);
  const rejectRegistry=fn=>{const v=structuredClone(registry);fn(v);assert.throws(()=>validateRegistryBuildWitness(v,temp));negatives++;};
  rejectRegistry(v=>v.source_authority='0'.repeat(40));rejectRegistry(v=>v.packages.pop());
  rejectRegistry(v=>v.registry_witness.crates.pop());rejectRegistry(v=>v.registry_witness.inventory_sha256='0'.repeat(64));
  rejectRegistry(v=>{
    const w=v.registry_witness;w.crates[0].source_tree_sha256='0'.repeat(64);
    w.sha256=createHash('sha256').update(JSON.stringify(w.crates)).digest('hex');
    for(const p of v.packages)for(const b of p.builds)b.registry_source_sha256=w.sha256;
  }); // Coordinated registry rehash must not replace independently observed identity.
  rejectRegistry(v=>{
    v.registry_witness.routing.configs['cargo-home/config.toml'].sha256='0'.repeat(64);
    for(const p of v.packages)for(const b of p.builds)b.registry_routing=structuredClone(v.registry_witness.routing);
  });
  for(let i=0;i<5;i++){
    rejectRegistry(v=>v.packages[i].builds[0].registry_sources_unchanged=false);
    rejectRegistry(v=>v.packages[i].builds[1].registry_source_sha256='0'.repeat(64));
  }
  rejectRegistry(v=>v.registry_witness.routing.temporary_adapter_contents_attested=true);
  rejectRegistry(v=>v.full_transitive_license_audit=true);
  rejectRegistry(v=>v.new_nested_guard_executed_during_original_build=true);
  rejectRegistry(v=>v.no_nested_config_in_captured_workspaces=false);
  const file=join(dir,'artifact.wasm'),bytes=readFileSync(file);writeFileSync(file,Buffer.concat([bytes,Buffer.from([0])]));
  assert.throws(()=>validateRegistryBuildWitness(registry,temp));negatives++;writeFileSync(file,bytes);
  assert.equal(validateRegistryBuildWitness(registry,temp).delivery_files,45);
  console.log(JSON.stringify({accepted:true,negative_controls:negatives,coordinated_self_rehash_rejected:true,
    workspace_negative_controls:workspaceNegatives,registry_negative_controls:negatives-workspaceNegatives,
    actual_delivery_faults_rejected:true,private_inputs_reexecuted:false,release_qualified:false}));
}finally{rmSync(temp,{recursive:true});} // Exact owned fixture only.
