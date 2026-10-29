import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentProductPaths,currentProductReader,resolveCurrentPackage} from './current-lib-release-v3.mjs';
import {verifyMixedFromCatalog,verifyMixedArtifactAuthority} from './mixed-current-product-v1.mjs';
import {currentReleasePreflight} from './lib-current-release-preflight.mjs';
import {auditTaggedRoots} from './audit-tagged-root-identities-v1.mjs';
import {checkQ2Evidence} from './lib-q2-evidence-v2.mjs';
import {sha} from './lib-refresh-cache-v2.mjs';

// Binds existing evidence; this is not Source admission or a release decision.
export async function qualifyMixedReleaseInputs(o) {
  for(const k of ['product','sourceRoot','repo','runRoot','refsPath','q2Path','networkPath','networkRoot','previousParent','witTool'])assert.ok(isAbsolute(o[k]??''),k);
  for(const k of ['catalogSha','receiptSha','producerSha','witToolSha','refsSha','q2Sha','networkSha'])assert.match(o[k]??'',/^[0-9a-f]{64}$/);
  const read=currentProductReader(o.product),catalogBytes=read('catalog/libs-current-v2.json');
  const closure=verifyMixedFromCatalog(catalogBytes,o.catalogSha,read,currentProductPaths(o.product));assert.equal(closure.accepted,true);
  const catalog=JSON.parse(catalogBytes),cohort=JSON.parse(read(catalog.cohort.path));
  assert.notEqual(catalog.package_authority_commit,'0'.repeat(40));
  const prefix='admission/mixed-product-inputs-v1',old=p=>read(`${prefix}/old/${p}`),fresh=p=>read(`${prefix}/candidate/${p}`);
  const authority=verifyMixedArtifactAuthority(o.repo,catalog.package_authority_commit,catalog.packages,catalog.registry,old,fresh,cohort.reused);
  const candidateCatalog=JSON.parse(fresh('catalog/libs-current-v2.json')),candidateCohort=JSON.parse(fresh(candidateCatalog.cohort.path));
  assert.equal(candidateCohort.refresh_receipt_sha256,o.receiptSha);assert.equal(candidateCohort.producer_sha256,o.producerSha);
  const q0=await currentReleasePreflight(o.sourceRoot,{run_root:o.runRoot,receipt_sha256:o.receiptSha,
    producer_sha256:o.producerSha,wit_tool:o.witTool,wit_tool_sha256:o.witToolSha});
  assert.equal(q0.accepted,true,JSON.stringify(q0.blockers));assert.equal(q0.index.index_sha256,candidateCatalog.index.sha256);
  const refs=await readFile(o.refsPath);assert.equal(sha(refs),o.refsSha);
  const live=()=>execFileSync('git',['ls-remote','--refs','--tags','origin'],{cwd:o.repo,maxBuffer:4*1024*1024});
  assert.deepEqual(live(),refs,'remote tag list changed');const tags=await auditTaggedRoots({repo:o.repo,product:o.product,catalogSha:o.catalogSha,refsPath:o.refsPath,refsSha:o.refsSha});
  assert.deepEqual(live(),refs,'remote tag list changed during audit');
  const q2Bytes=await readFile(o.q2Path);assert.equal(sha(q2Bytes),o.q2Sha,'Q2 receipt pin');const q2=JSON.parse(q2Bytes);
  assert.equal(q2.schema,'wasmc.current-lib-search-ordinary-q2/v2');assert.equal(q2.accepted,true);assert.equal(q2.public_admission,false);
  assert.equal(q2.index_sha256,catalog.index.sha256);const search=catalog.packages.find(r=>r.id==='wasmc-lib-search');assert.ok(search);
  assert.equal(q2.root_manifest_sha256,search.manifest_sha256);
  const names=['snapshot','lookup','missing','search','bound','reject','limit','wide_page'];assert.equal(q2.results.length,names.length);
  let cases=[];for(let i=0;i<names.length;i++){
    const name=names[i],expected=JSON.parse(await readFile(join(dirname(o.q2Path),name+'-cases.json')));
    assert.equal(expected.length,1);assert.equal(expected[0].export,name);cases.push(...expected);
    const source=await readFile(join(dirname(o.q2Path),name+'.wasmc'));
    checkQ2Evidence(q2.results[i],expected,{root:search.manifest_sha256,source:sha(source),
      wasmi:q2.tooling.engines.wasmi,wasmtime:q2.tooling.engines.wasmtime},4);
  }
  assert.equal(sha(Buffer.from(JSON.stringify(cases))),q2.cases_sha256);assert.equal(q2.calls_per_engine,32);
  for(const name of ['runner','provider','merge_tool'])assert.equal(sha(await readFile(q2.tooling[name].path)),q2.tooling[name].sha256);
  const networkBytes=await readFile(o.networkPath);assert.equal(sha(networkBytes),o.networkSha,'network receipt pin');const net=JSON.parse(networkBytes);
  assert.equal(net.schema,'wasmc.mixed-network-cohort-install/v1');assert.equal(net.accepted,true);
  assert.equal(net.catalog_sha256,o.catalogSha);assert.equal(net.artifact_commit,catalog.package_authority_commit);
  assert.equal(net.rows.length,catalog.packages.length);assert.equal(new Set(net.rows.map(r=>r.id)).size,net.rows.length);
  let count=0;for(const row of catalog.packages){const item=net.rows.find(x=>x.id===row.id);assert.ok(item&&item.accepted);
    assert.equal(item.version,row.version);assert.equal(item.manifest_sha256,row.manifest_sha256);
    const lock=resolveCurrentPackage(catalogBytes,o.catalogSha,row,read),lockSha=sha(Buffer.from(JSON.stringify(lock)));
    assert.equal(item.lock_sha256,lockSha);assert.equal(item.receipt.artifact_commit,catalog.package_authority_commit);
    const destination=item.reused?join(o.previousParent,`mixed-network-installed-${row.id}-20261029`):join(o.networkRoot,'packages',row.id);
    for(const f of row.files){const b=await readFile(join(destination,f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);count++;}
  }
  assert.equal(count,net.files);assert.equal(net.roots,catalog.packages.length);
  return {schema:'wasmc.mixed-release-inputs/v1',accepted:true,catalog_sha256:o.catalogSha,authority_commit:authority.commit,
    authority_files:authority.files,q0_receipt_sha256:o.receiptSha,q0_packages:q0.packages.length,tag_refs_sha256:o.refsSha,
    tags:tags.tags,search_q2_sha256:o.q2Sha,search_q2_cases:names.length,calls_per_engine:q2.calls_per_engine,
    network_receipt_sha256:o.networkSha,network_roots:net.roots,network_files:count,
    source_admitted:false,full_product_ci:false,hosted_qualified:false,formal_release:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const keys=['product','catalogSha','sourceRoot','repo','runRoot','receiptSha','producerSha','witTool','witToolSha','refsPath','refsSha','q2Path','q2Sha','networkPath','networkSha','networkRoot','previousParent'];
  assert.equal(process.argv.length,2+keys.length,'all independent qualification inputs required');
  const options=Object.fromEntries(keys.map((k,i)=>[k,process.argv[i+2]]));
  qualifyMixedReleaseInputs(options).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
}
