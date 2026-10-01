// Source-free verification of the observed guarded rebuild, not license admission.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const observed={
  'wasmc-http1':'e8b820ab371b414fd1cc4b21702f427b1d60fefc986f2bfe1312dbdd97e2db2a',
  'wasmc-data-core':'b1d072c7487726b586eff5a1fe201b6620323a58e78f7e0bae56c93baf03dbc6',
  'wasmc-host-clock':'eca7b17560a685861c163bc2b32e8db9e1ee583a80317bb40c43be3d84b90036',
  'wasmc-owned-algorithms':'492f170598ad5b2eba0a810a9d71d6f1c73a779e251b90f6e3befb98fc672901',
  'wasmc-resource-counter':'057fa63881e9f295145ed703a66d821a241276db023a017179cc7fb87c53a806',
};
// Existing qualification inventories are independent of the new audit receipt.
const trusted=['admission/current-v2-next/build-receipts.json','admission/current-v2-data-core/build-receipts.json']
  .flatMap(path=>JSON.parse(readFileSync(join(root,path))).packages);
function validateWorkspaceWitness(value,base,authority,schema){
  assert.equal(value.schema,schema);
  assert.equal(value.source_authority,authority);
  assert.equal(value.producer_authority,'3b797a77d0afa25264a11362603b0d596d2e0ba7');
  for(const key of ['retained_inputs_rechecked','existing_staged_complete_packages_byte_identical'])assert.equal(value[key],true);
  for(const key of ['full_transitive_license_audit','historical_builds_attested','release_qualified'])assert.equal(value[key],false);
  assert.deepEqual(value.packages.map(p=>p.id).sort(),Object.keys(observed).sort());
  let inputFiles=0,deliveryFiles=0;
  for(const p of value.packages){
    const old=trusted.find(x=>x.id===p.id);assert(old);
    assert.equal(p.version,old.version);assert.equal(p.builds.length,2);
    assert.equal(p.strict_reopen,true);assert.equal(p.complete_second_build_byte_identical,true);
    assert.equal(p.release_qualified,false);
    const canonical=['wasmc-host-clock','wasmc-owned-algorithms','wasmc-resource-counter'].includes(p.id);
    assert.equal(p.canonical_source_recovered,canonical);
    assert.equal(p.implementation_source_authority,canonical?value.producer_authority:value.source_authority);
    assert.deepEqual(p.builds[0].source_inputs,p.builds[1].source_inputs);
    for(const b of p.builds){
      assert.equal(b.build_inputs_unchanged,true);assert.deepEqual(b.inventory,old.builds[0].inventory);
      assert.deepEqual(b.report,old.builds[0].report);
      const s=b.source_inputs;
      assert.equal(s.schema,'wasmc.current-v2-build-input-snapshot/v1');
      assert.equal(s.scope,'retained-workspace-and-declared-sibling-wit-license-excluding-Cargo-target-output');
      const files=Object.fromEntries(Object.entries(s.files).sort(([a],[b])=>Buffer.compare(Buffer.from(a),Buffer.from(b))));
      for(const [path,id]of Object.entries(files)){
        assert(!path.startsWith('/')&&!path.split('/').includes('..'));
        assert(/^(workspace|license-input|wit-input)\//.test(path));
        assert(Number.isSafeInteger(id.bytes)&&id.bytes>=0);assert.match(id.sha256,/^[a-f0-9]{64}$/);
      }
      assert.equal(sha(Buffer.from(JSON.stringify(files))),s.sha256);
      assert.equal(s.sha256,observed[p.id],'observed input identity drift');
    }
    inputFiles+=Object.keys(p.builds[0].source_inputs.files).length;
    const dir=resolve(base,old.root);assert.equal(realpathSync(dir),dir,'linked delivery root');
    const actual={};
    const walk=path=>{for(const name of readdirSync(path).sort()){
      const target=join(path,name),stat=lstatSync(target);assert(!stat.isSymbolicLink(),'linked delivery entry');
      if(stat.isDirectory())walk(target);
      else{assert(stat.isFile());const bytes=readFileSync(target);actual[relative(dir,target)]={bytes:bytes.length,sha256:sha(bytes)};}
    }};
    walk(dir);assert.deepEqual(actual,old.builds[0].inventory,'actual complete package drift');
    deliveryFiles+=Object.keys(actual).length;
  }
  return {accepted:true,packages:5,input_files:inputFiles,delivery_files:deliveryFiles,
    exact_observed_witnesses:true,existing_complete_packages_byte_identical:true,
    private_inputs_reexecuted:false,historical_builds_attested:false,
    full_transitive_license_audit:false,release_qualified:false};
}
export function validateRetainedBuildWitness(value,base=root){
  return validateWorkspaceWitness(value,base,'cf26b71c5b9d0d9b121bedfb6499016d42783d18','wasmc.current-v2-portable-build/v1');
}
export function validateRegistryBuildWitness(value,base=root){
  const result=validateWorkspaceWitness(value,base,'1e3d3e4ab96704184c9498cc1cb189afa5ace122','wasmc.observed-registry-guarded-cohort/v1');
  assert.equal(value.no_nested_config_in_captured_workspaces,true);
  assert.equal(value.new_nested_guard_executed_during_original_build,false);
  const witness=value.registry_witness;
  assert.equal(witness.schema,'wasmc.current-v2-registry-source-witness/v1');
  assert.equal(witness.scope,'conservative-locked-crates-archive-and-extracted-source');
  const inventory=JSON.parse(readFileSync(join(root,'admission/current-v2-next/dependency-inventory.json')));
  assert.equal(witness.inventory_sha256,sha(Buffer.from(JSON.stringify(inventory))));
  assert.equal(witness.crates.length,inventory.crates.length);
  assert.equal(witness.sha256,sha(Buffer.from(JSON.stringify(witness.crates))));
  assert.equal(witness.sha256,'92d24d209afa0b99e83811d6d45909c513b861f300559a9a8009a275d93f14cd','observed registry input identity drift');
  for(let i=0;i<witness.crates.length;i++){
    const row=witness.crates[i],expected=inventory.crates[i];
    assert.equal(row.name,expected.name);assert.equal(row.version,expected.version);
    assert.equal(row.archive_sha256,expected.checksum);assert(row.source_files>0);
    assert.match(row.source_tree_sha256,/^[a-f0-9]{64}$/);
  }
  assert.equal(witness.historical_builds_attested,false);assert.equal(witness.release_qualified,false);
  const config={bytes:34,sha256:'cfcc4d6056a0637c71868be9bbea3cc90ab503002d965f6045e8c19e14793097'};
  const routing={schema:'wasmc.retained-cargo-routing/v1',explicit_cargo_home:true,
    reviewed_registry_layout:'index.crates.io-1949cf8c6b5b557f',configs:{'cargo-home/config.toml':config,'workspace-ancestor-9/config.toml':config},
    temporary_adapter_contents_attested:false};
  assert.deepEqual(witness.routing,routing,'observed Cargo routing drift');
  for(const p of value.packages)for(const b of p.builds){
    assert.equal(b.registry_sources_unchanged,true);assert.equal(b.registry_source_sha256,witness.sha256);
    assert.deepEqual(b.registry_routing,routing);
    assert(!Object.keys(b.source_inputs.files).some(path=>/\/\.cargo\/config(\.toml)?$/.test(path)));
  }
  return {...result,registry_crates:witness.crates.length,registry_source_files:witness.crates.reduce((n,c)=>n+c.source_files,0),
    exact_observed_registry_witness:true,registry_cache_reexecuted:false,temporary_adapter_contents_attested:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const registry=process.argv[2]==='--registry';assert.equal(process.argv.length,registry?3:2);
  const path=registry?'cohort-registry-build-witness.json':'cohort-build-input-witness.json';
  const value=JSON.parse(readFileSync(join(root,'admission/current-v2-next',path)));
  console.log(JSON.stringify(registry?validateRegistryBuildWitness(value):validateRetainedBuildWitness(value)));
}
