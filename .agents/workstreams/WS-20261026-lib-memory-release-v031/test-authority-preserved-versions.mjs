import fs from 'node:fs';import assert from 'node:assert/strict';import {verifyCurrentCandidateComposition} from '../../../scripts/release-candidate.mjs';
const c=JSON.parse(fs.readFileSync('catalog/libs-current-v2.json'));
const options={catalog_sha256:'a6208adff2416f6a332b6ad9d002140f1014a8661b2dbd79d758ffbe098e13c6',composition_cohort_sha256:c.cohort.sha256,source_lineage_sha256:'c47870d087a96448470ab50f28f4ce5743f65826941029e38e9bd43830bd315f'};
assert.ok(fs.existsSync('current-libs/wasmc-json/0.0.6'));assert.ok(fs.existsSync('libspec/wasmc-compression/adapter.rs'));
const result=verifyCurrentCandidateComposition(process.cwd(),options);assert.equal(result.closure.release_packages,43);assert.equal(result.closure.root_files_verified,666);
assert.ok(!result.product_inputs.includes('libspec/wasmc-compression/adapter.rs'));
const hidden='current-libs/wasmc-json/0.2.0/.qualification-unexpected-file-20261027';fs.writeFileSync(hidden,'not part of selected root',{flag:'wx'});
try{assert.throws(()=>verifyCurrentCandidateComposition(process.cwd(),options),/no unselected current Roots/)}finally{fs.unlinkSync(hidden)}
console.log(JSON.stringify({accepted:true,preserved_historical_roots:true,preserved_old_source:true,selected_root_extra_rejected:true,formal_release:false}));
