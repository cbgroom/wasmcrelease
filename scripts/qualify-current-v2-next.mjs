#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {validateUpstreamReceipt} from './current-v2-upstream-provenance.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const save = process.argv.includes('--receipt');
assert(process.argv.slice(2).every(arg=>arg==='--receipt'));
const batch = JSON.parse(readFileSync(join(root,'admission/current-v2-next/build-receipts.json')));
const dataBatch = JSON.parse(readFileSync(join(root,'admission/current-v2-data-core/build-receipts.json')));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const identities = [];
for (const row of [...batch.packages, ...dataBatch.packages]) {
  assert.equal(row.root, `admission/${row.id==='wasmc-data-core'?'current-v2-data-core':'current-v2-next'}/packages/${row.id}/${row.version}`);
  const expected = row.builds[0].inventory;
  assert.deepEqual(row.builds[1].inventory, expected);
  const actual = {};
  const walk = (dir,prefix='') => { for(const name of readdirSync(dir).sort()) {
    const path = join(dir,name), relative = prefix+name, stat = lstatSync(path);
    assert(!stat.isSymbolicLink(),'linked package entries rejected');
    if(stat.isDirectory()) walk(path,relative+'/');
    else { assert(stat.isFile()); const bytes=readFileSync(path);actual[relative]={bytes:bytes.length,sha256:hash(bytes)}; }
  }};
  walk(join(root,row.root));
  assert.deepEqual(actual,expected,`${row.id}: pinned package inventory drift`);
  identities.push({id:row.id,version:row.version,root:row.root,manifest_sha256:expected['lib.json'].sha256,
    artifact:expected['artifact.wasm'],component:expected['component.wasm']});
}
const run = (cmd,args) => execFileSync(cmd,args,{cwd:root,encoding:'utf8',timeout:600000,maxBuffer:32<<20}).trim();
const jsonRun = (cmd,args) => {const result=JSON.parse(run(cmd,args).split('\n').at(-1));assert.equal(result.accepted,true);return result;};
const http1 = identities.find(row=>row.id==='wasmc-http1');
const behavior = jsonRun('node',['scripts/test-http1-libsrc.mjs','--package',http1.root]);
assert.equal(behavior.candidate_sha256,http1.artifact.sha256);
const dataCore = identities.find(row=>row.id==='wasmc-data-core');
const dataBehavior = jsonRun('node',['scripts/test-data-core-libsrc.mjs','--package',dataCore.root]);
assert.equal(dataBehavior.candidate_sha256,dataCore.artifact.sha256);
run('cargo',['+1.96.0','build','--release','--locked','--offline','--manifest-path','libsrc/qualification/wasmi-core/Cargo.toml']);
const wasmi = jsonRun('libsrc/qualification/wasmi-core/target/release/wasmc-libsrc-wasmi-qualification',['--http1',join(http1.root,'artifact.wasm')]);
const dataWasmi = jsonRun('libsrc/qualification/wasmi-core/target/release/wasmc-libsrc-wasmi-qualification',['--data-core',join(dataCore.root,'artifact.wasm')]);
const fixtureWasmi = ['wasmc-owned-algorithms','wasmc-host-clock','wasmc-resource-counter'].map((id,index)=>{
  const row=identities.find(x=>x.id===id);
  return jsonRun('libsrc/qualification/wasmi-core/target/release/wasmc-libsrc-wasmi-qualification',
    [['--owned','--clock','--counter'][index],join(row.root,'artifact.wasm')]);
});
const upstreamBytes=readFileSync(join(root,'admission/current-v2-next/upstream/review.json'));
const upstreamReview=validateUpstreamReceipt(JSON.parse(upstreamBytes));
const sdk = jsonRun('cargo',['+1.96.0','run','--locked','--offline','--quiet','--manifest-path','libsrc/qualification/current-v2-consumer/Cargo.toml','--','admission/current-v2-next/packages',dataCore.root]);
assert.equal(sdk.packages,identities.length);
const sourceFreeSdk=jsonRun('node',['scripts/qualify-current-v2-source-free-sdk.mjs']);
assert.equal(sourceFreeSdk.source_free_sdk_execution,true);
const ordinaryApp=jsonRun('node',['scripts/test-current-v2-app.mjs']);
assert.equal(ordinaryApp.ordinary_app_qualified_count,1);
assert.equal(ordinaryApp.blocked_count,4);
const appReceiptBytes=readFileSync(join(root,'admission/current-v2-next/ordinary-app.json'));
const licensedDelivery=jsonRun('node',['scripts/test-current-v2-package-license.mjs','--sdk']);
assert.equal(licensedDelivery.package_license_binding,true);
assert.equal(licensedDelivery.source_free_licensed_sdk_execution,true);
assert.equal(licensedDelivery.dependency_materials_carried,true);
assert.equal(licensedDelivery.registry_crates,189);
assert.equal(licensedDelivery.registry_notice_review_carried,true);
const registryNoticeReview=jsonRun('node',['scripts/test-current-v2-registry-notice-review.mjs']);
const registryReviewBytes=readFileSync(join(root,'admission/current-v2-next/registry-notice-review.json'));
const licenseBindingsBytes=readFileSync(join(root,'admission/current-v2-next/package-license-bindings.json'));
const receipt = {schema:'wasmc.current-v2-next-local-qualification/v1',accepted:true,
  oracle_sources:Object.fromEntries(['scripts/test-http1-libsrc.mjs','scripts/test-data-core-libsrc.mjs',
    'scripts/qualify-current-v2-next.mjs','scripts/current-v2-upstream-provenance.mjs','scripts/qualify-current-v2-source-free-sdk.mjs','scripts/test-current-v2-app.mjs',
    'scripts/current-v2-package-license.mjs','scripts/test-current-v2-package-license.mjs',
    'scripts/current-v2-dependency-inventory.mjs','scripts/current-v2-toolchain-notices.mjs','libsrc/qualification/wasmi-core/src/main.rs',
    'scripts/current-v2-registry-notice-review.mjs','scripts/test-current-v2-registry-notice-review.mjs',
    'libsrc/qualification/wasmi-core/Cargo.lock','libsrc/qualification/current-v2-consumer/src/main.rs',
    'libsrc/qualification/current-v2-consumer/Cargo.lock'].map(path=>[path,hash(readFileSync(join(root,path)))])),
  engine_tools:{wasmtime:run('wasmtime',['--version']),wasm_tools:run('wasm-tools',['--version'])},
  build_receipts_sha256:hash(readFileSync(join(root,'admission/current-v2-next/build-receipts.json'))),
  data_build_receipts_sha256:hash(readFileSync(join(root,'admission/current-v2-data-core/build-receipts.json'))),
  packages:identities,http1_behavior:behavior,http1_wasmi:wasmi,data_core_behavior:dataBehavior,data_core_wasmi:dataWasmi,fixture_wasmi:fixtureWasmi,generated_sdk:sdk,
  upstream_review:{...upstreamReview,receipt_sha256:hash(upstreamBytes)},
  source_free_sdk:sourceFreeSdk,
  ordinary_app_probe:{...ordinaryApp,receipt_sha256:hash(appReceiptBytes)},
  package_license_binding:{...licensedDelivery,manifest_sha256:hash(licenseBindingsBytes)},
  registry_notice_review:{...registryNoticeReview,receipt_sha256:hash(registryReviewBytes)},
  selected_current_catalog:false,ordinary_wasmc_app_qualified:false,release_qualified:false,
  pending:['current catalog admission and exact route/install closure','ordinary WAsmC App rich-value/resource Core transport for four staged packages; published compiler identity',
    'complete license-obligation/target-applicability review and admit the material-carrying license envelope with a new candidate',
    'remaining package rebuilds and qualification','exact new-candidate release and live Pi gates']};
if(save) writeFileSync(join(root,'admission/current-v2-next/qualification.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({accepted:true,packages:identities.length,http1_cases:behavior.cases,
  http1_wasmi_rounds:wasmi.rounds,fixture_wasmi:fixtureWasmi,upstream_review:upstreamReview,sdk,release_qualified:false}));
