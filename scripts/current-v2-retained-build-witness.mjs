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
export function validateRetainedBuildWitness(value,base=root){
  assert.equal(value.schema,'wasmc.current-v2-portable-build/v1');
  assert.equal(value.source_authority,'cf26b71c5b9d0d9b121bedfb6499016d42783d18');
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
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv.length,2);
  console.log(JSON.stringify(validateRetainedBuildWitness(JSON.parse(readFileSync(join(root,'admission/current-v2-next/cohort-build-input-witness.json'))))));
}
