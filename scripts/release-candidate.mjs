// Offline product-identity gate. This does not publish, sign or grant authority.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
import {buildClosure} from './lib-route-closure.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const safe=p=>typeof p==='string'&&p.split('/').every(x=>x&&x!=='.'&&x!=='..')&&!p.includes('\\')&&!p.startsWith('/');
const legacyV1ProductSets=Object.freeze({
  '0.0.10':'dd01d2fef9a4010e0bf4ed50f2fbf790a2771c92e4a4252bd6889441bc2059d8',
  '0.0.11':'101a8a3783d52fc3d06e15731b20ec5fbe5a2bdbd7d9e964876f76ce44e33662',
  '0.0.12':'6c5da874b9a3cce2beef0936fa761c45d5e33869db165a30e3e2984622b7bb6b',
  '0.0.13':'e2a1bb7e3bf30092ddda1313a9c20dd37a36e820b076bd64e0ac6ecec6ec36d0'
});
export function validateCandidate(candidate,read) {
  if(!['wasmc.release-product-candidate/v1','wasmc.release-product-candidate/v2'].includes(candidate.schema)||!/^\d+\.\d+\.\d+$/.test(candidate.version))throw Error('candidate schema/version rejected');
  if(candidate.schema==='wasmc.release-product-candidate/v1'&&legacyV1ProductSets[candidate.version]!==candidate.product_set_sha256)throw Error('legacy v1 candidate identity rejected; new candidates require v2 Lib route closure');
  for(const key of ['compiler_source_authority','lib_source_authority'])if(!/^[0-9a-f]{40}$/.test(candidate[key]))throw Error('exact private source authority required');
  const rows=candidate.product_files;
  if(!Array.isArray(rows)||!rows.length||rows.length>10000)throw Error('product inventory rejected');
  let previous='';
  for(const row of rows) {
    if(!safe(row.path)||row.path<=previous||!Number.isSafeInteger(row.bytes)||row.bytes<=0||!/^[0-9a-f]{64}$/.test(row.sha256))throw Error('product row rejected');
    const bytes=read(row.path);if(bytes.length!==row.bytes||hash(bytes)!==row.sha256)throw Error('product drift rejected');previous=row.path;
  }
  if(candidate.product_set_sha256!==hash(JSON.stringify(rows)))throw Error('product set identity rejected');
  if(candidate.schema==='wasmc.release-product-candidate/v2'){
    const closure=candidate.lib_route_closure;
    if(closure?.schema!=='wasmc.release-candidate-lib-route-closure/v1'||!safe(closure.authority_receipt?.path)||!/^[0-9a-f]{64}$/.test(closure.authority_receipt?.sha256??'')||!safe(closure.catalog?.path)||!/^[0-9a-f]{64}$/.test(closure.catalog?.sha256??'')||!safe(closure.search_index?.path)||!/^[0-9a-f]{64}$/.test(closure.search_index?.sha256??'')||!Number.isSafeInteger(closure.release_packages)||closure.release_packages<1||!Number.isSafeInteger(closure.package_routes)||closure.package_routes!==closure.release_packages||!Number.isSafeInteger(closure.api_routes)||closure.api_routes<1||closure.candidate_extras!==0||closure.exact!==true||closure.candidate_extra_grants_release!==false)throw Error('candidate Lib route closure rejected');
  }
  return true;
}

function closureSummary(model){
  return {
    schema:'wasmc.release-candidate-lib-route-closure/v1',
    authority_receipt:model.authority_receipt,
    catalog:{path:model.catalog.path,sha256:model.catalog.sha256},
    search_index:{path:model.search_index.path,sha256:model.search_index.sha256,active_identity:model.search_index.active_identity},
    release_packages:model.release_bindings.length,
    package_routes:model.search_index.package_routes,
    api_routes:model.search_index.api_routes,
    candidate_extras:model.candidate_extras.length,
    exact:model.claims.release_catalog_exact&&model.claims.release_package_routes_exact&&model.claims.release_api_routes_exact&&model.claims.api_parents_closed,
    candidate_extra_grants_release:false
  };
}

function candidateClosure(candidate){
  return closureSummary(buildClosure(undefined,{
    release:{version:candidate.version,tag:`v${candidate.version}`,staged_product_manifest:null},
    stagedProduct:candidate
  }));
}
export function validateTransition(previous,next,candidate) {
  if(next.schema!=='wasmc.release-stage/v1'||next.version!==candidate.version||next.product_set_sha256!==candidate.product_set_sha256||!/^[0-9a-f]{40}$/.test(next.product_candidate_commit))throw Error('stage identity rejected');
  const suffix=next.stage==='prod'?'':next.stage==='dev'?'-dev.':next.stage==='main'?'-main.':null;
  if(suffix===null||!(suffix===''?next.tag===`v${next.version}`:new RegExp(`^v${next.version.replaceAll('.','\\.')}${suffix.replace('.','\\.')}[1-9][0-9]*$`).test(next.tag)))throw Error('stage tag rejected');
  if(next.stage==='dev'){if(previous!==null)throw Error('dev must begin a new candidate');return true;}
  if(!previous||previous.version!==next.version||previous.product_set_sha256!==next.product_set_sha256||previous.product_candidate_commit!==next.product_candidate_commit||previous.stage!==(next.stage==='main'?'dev':'main'))throw Error('promotion cannot rebuild or skip stages');
  if(next.qualification?.accepted!==true||next.qualification?.lib_search_result!=='success'||next.qualification?.full_consumer_result!=='success'||next.qualification?.tested_product_set_sha256!==candidate.product_set_sha256||!/^[0-9a-f]{40}$/.test(next.qualification?.tested_source_commit))throw Error('exact successful qualification required');
  return true;
}
function walk(directory) {
  return readdirSync(resolve(root,directory)).sort().flatMap(name=>{
    if(['target','.DS_Store'].includes(name))return [];
    const path=`${directory}/${name}`,s=lstatSync(resolve(root,path));
    if(s.isSymbolicLink())throw Error('product symlink rejected');
    return s.isDirectory()?walk(path):[path];
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [command,path,source,libSourceOrVersion,explicitVersion]=process.argv.slice(2);
  const read=p=>readFileSync(resolve(root,p));
  if(command==='create') {
    const compilerSource=explicitVersion===undefined?'e69abb73f667f3810b0c40937fd1a1e2d04d4255':source;
    const libSource=explicitVersion===undefined?source:libSourceOrVersion;
    const version=explicitVersion===undefined?libSourceOrVersion:explicitVersion;
    if(!/^[0-9a-f]{40}$/.test(compilerSource))throw Error('exact compiler source required');
    if(!/^[0-9a-f]{40}$/.test(libSource))throw Error('exact Lib source required');
    const productDirectories=[
      'current','standard','sdk','runtime','libs',
      'skills/wasmc-developer','skills/wasmc-lib-discovery','skills/wasmc-sdk-discovery',
      'host/contract','host/sdk','host/drivers/file/rust','host/drivers/memory/rust'
    ];
    const productFiles=[
      'AGENTS.md','README.md','HOSTING.md','LANGUAGE.md',
      'agent-quickstart.json','release-lib-route-readiness.json',
      ...(version==='0.0.19'?['agent-evaluation/fresh-agent-learning-v2.json']:[]),
      'admission/lib-search-v040-v018-admission.json',
      ...(version==='0.0.19'?['admission/compiler-v019-u64-admission.json']:[]),
      'admission/data-foundation-v11/relational-v002-admission.json',
      'admission/mcpgit-resident-memory-v1/formal-admission.json',
      'catalog/libs-v018.json','catalog/discovery-intent-v018.json',
      'examples/lib-search/index-v018-v040.lsi',
      'host/ARCHITECTURE.md','host/architecture.json','host/manifest.json',
      'bench/manifest.json','bench/host-external-load.json',
      'docs/ASMD.md','docs/AGENT_DECISION_MODEL.md','docs/FRESH_AGENT_LEARNING_FLYWHEEL.md','docs/RELEASE_SURFACES.md',version==='0.0.19'?'docs/RELEASE_V019.md':'docs/RELEASE_V018.md','release-surfaces.json',
      'examples/lib-search/client.mjs',
      'scripts/wasmc-lib.mjs',
      'scripts/lib-catalog.mjs','scripts/lib-route-closure.mjs','scripts/release-candidate.mjs',
      'scripts/agent-guidance-contract.mjs',
      ...(version==='0.0.19'?['scripts/update-current-compiler.mjs']:[]),
      'scripts/test-agent-guidance.mjs',
      'scripts/validate-agent-docs.mjs',
      'scripts/validate-sdk-agent-routes.mjs',
      'skills/wasmc-lib/SKILL.md'
    ];
    const paths=[...productDirectories.flatMap(walk),...productFiles];
    const rows=paths.sort().map(path=>{const b=read(path);return {path,bytes:b.length,sha256:hash(b)};});
    const candidate={schema:'wasmc.release-product-candidate/v2',version,compiler_source_authority:compilerSource,lib_source_authority:libSource,product_files:rows,product_set_sha256:hash(JSON.stringify(rows))};
    candidate.lib_route_closure=candidateClosure(candidate);
    if(candidate.lib_route_closure.candidate_extras!==0)throw Error('release candidate blocked: active LibSearch must be inside the product, catalog and exact route set');
    validateCandidate(candidate,read);writeFileSync(path,JSON.stringify(candidate,null,2)+'\n',{flag:'wx'});
  } else if(command==='verify') {
    const candidate=JSON.parse(readFileSync(path));validateCandidate(candidate,read);
    if(candidate.schema==='wasmc.release-product-candidate/v2')assert.deepEqual(candidate.lib_route_closure,candidateClosure(candidate),'candidate Lib route closure drift');
    console.log(JSON.stringify({accepted:true,products:candidate.product_files.length,product_set_sha256:candidate.product_set_sha256}));
  } else throw Error('usage: release-candidate.mjs create FILE [COMPILER_SOURCE] LIB_SOURCE VERSION | verify FILE');
}
