import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCatalog, catalogAuthorities } from './lib-catalog.mjs';
import { buildClosure } from './lib-route-closure.mjs';
import { validateTransition } from './release-candidate.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(resolve(root,path));
const json=path=>JSON.parse(read(path));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const release=json('release.json'),prod=json('channels/prod.json');
const candidate=json('channels/candidates/0.0.14.json');
const admission=json('admission/lib-search-v020-v014-admission.json');
const qualification=json('admission/qualification-v014.json');
const dev=json('channels/dev.json');
const libSearchWorkflow=read('.github/workflows/lib-search.yml').toString('utf8');
const rustManifest=read('examples/lib-search/rust/Cargo.toml').toString('utf8');
const rustWasmi=read('examples/lib-search/rust/tests/wasmi_portable.rs').toString('utf8');

assert.equal(release.version,'0.0.13');
assert.equal(release.stage,'prod');
assert.equal(prod.version,'0.0.13');
assert.equal(prod.tag,'v0.0.13');
assert.equal(candidate.schema,'wasmc.release-product-candidate/v2');
assert.equal(candidate.version,'0.0.14');
assert.equal(candidate.lib_source_authority,'03e093452fbc18c082df371627c15f439195ccb6');
assert.equal(candidate.product_set_sha256,sha(JSON.stringify(candidate.product_files)));
assert.equal(qualification.accepted,true);
assert.equal(qualification.tested_source_commit,'7811eb769176d98d4c3f02fbd0a7beaa386ddf20');
assert.equal(qualification.product_candidate.commit,'f43dd8445717cc0dc38f41077ff239635b8e809d');
assert.equal(qualification.product_candidate.product_set_sha256,candidate.product_set_sha256);
assert.equal(qualification.required.lib_search.result,'success');
assert.equal(qualification.required.full_consumer.result,'success');
assert.equal(qualification.required.lib_search.head_sha,qualification.tested_source_commit);
assert.equal(qualification.required.full_consumer.head_sha,qualification.tested_source_commit);
assert.equal(validateTransition(null,dev,candidate),true);
assert.equal(dev.qualification.receipt,'admission/qualification-v014.json');
assert.equal(admission.schema,'wasmc.lib-search-product-admission/v1');
assert.deepEqual(admission.states,{qualified:true,admitted:true,released:false,discoverable:false,installable:false});
assert.equal(admission.catalog.release_commit,'e6bc230c29df89b7004935eb5895b7fc3a8bc3f1');
assert.equal(admission.catalog.sha256,sha(read(admission.catalog.path)));
assert.equal(admission.index.sha256,sha(read(admission.index.path)));
assert.equal(admission.artifact.core_sha256,sha(read('standard/wasmc-lib-search/0.2.0/artifact.wasm')));
assert.equal(admission.artifact.component_sha256,sha(read('standard/wasmc-lib-search/0.2.0/component.wasm')));
assert.equal(admission.artifact.manifest_sha256,sha(read('standard/wasmc-lib-search/0.2.0/lib.json')));
for(const exactRoute of [
  'channels/candidates/0.0.14.json',
  'examples/lib-search/index-v014-v020.lsi',
  'standard/wasmc-lib-search/0.2.0'
])assert.equal(libSearchWorkflow.includes(exactRoute),true,`LibSearch workflow route missing: ${exactRoute}`);
assert.equal(rustManifest.includes('../../../standard/wasmc-lib-search/0.2.0/bindings/rust'),true);
assert.equal(rustWasmi.includes('wasmc:lib-search/catalog@0.2.0#'),true);
assert.equal(libSearchWorkflow.includes('channels/candidates/0.0.13.json'),false);
assert.equal(libSearchWorkflow.includes('standard/wasmc-lib-search/0.1.0'),false);
const catalog=parseCatalog(read(admission.catalog.path),catalogAuthorities.v014);
assert.equal(catalog.packages.length,14);
assert.equal(catalog.packages.some(row=>row.wit_package==='wasmc:lib-search@0.2.0'&&row.root==='standard/wasmc-lib-search/0.2.0'),true);
const closure=buildClosure('admission/lib-search-v020-v014-admission.json',{release:{version:'0.0.14',tag:'v0.0.14',staged_product_manifest:'channels/candidates/0.0.14.json'},stagedProduct:candidate});
assert.equal(closure.release_bindings.length,14);
assert.equal(closure.search_index.package_routes,14);
assert.equal(closure.search_index.api_routes,108);
assert.equal(closure.candidate_extras.length,0);
assert.equal(closure.claims.formal_release_ready,true);
const verified=spawnSync(process.execPath,['scripts/release-candidate.mjs','verify','channels/candidates/0.0.14.json'],{cwd:root,encoding:'utf8'});
assert.equal(verified.status,0,verified.stderr+verified.stdout);
const old=spawnSync(process.execPath,['scripts/release-candidate.mjs','verify','channels/candidates/0.0.13.json'],{cwd:root,encoding:'utf8'});
assert.notEqual(old.status,0);
assert.match(old.stderr+old.stdout,/product drift rejected/);

console.log(JSON.stringify({accepted:true,schema:candidate.schema,version:candidate.version,products:candidate.product_files.length,product_set_sha256:candidate.product_set_sha256,release_packages:14,package_routes:14,api_routes:108,candidate_extras:0,qualification_routes_bound:true,lib_search_states:admission.states,dev_stage:dev.tag,current_prod:'v0.0.13',publishes:false,next:'metadata-only-main-promotion'}));
