import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { platform, arch } from 'node:os';
import { fileURLToPath } from 'node:url';
import {requiresIfBranchScopeQualification,requiresUnusedHostImportsQualification,requiresUnitResultMatchQualification,requiresCanonicalCheckedResultsQualification,requiresStringStorageQualification,currentStringQualificationScript} from './current-release-version.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
if(existsSync(root+'.git'))throw Error('qualification must run from a source-free public archive');
if(existsSync(root+'src/language')||existsSync(root+'crates/wasmc_wasm_cdylib'))throw Error('private compiler source must not be present');
const manifest=readFileSync(root+'current/compiler-release.json');
const product=JSON.parse(manifest),runs=[];
for(const engine of ['node','bun','deno']) {
  const version=spawnSync(engine,['--version'],{encoding:'utf8',timeout:30000});
  if(version.status!==0)throw Error(`missing ${engine}`);
  const commands=[
    engine==='deno'?['run','--allow-read','--allow-write','--allow-run','--allow-env','scripts/test-current-compiler.mjs']:['scripts/test-current-compiler.mjs'],
    engine==='deno'?['run','--allow-read','examples/current/standard.mjs']:['examples/current/standard.mjs'],
    engine==='deno'?['run','--allow-read','scripts/test-current-lib-api-v021.mjs']:['scripts/test-current-lib-api-v021.mjs'],
    engine==='deno'?['run','--allow-read','scripts/test-current-private-helpers.mjs']:['scripts/test-current-private-helpers.mjs'],
    engine==='deno'?['run','--allow-read','scripts/test-canonical-host-sdk.mjs']:['scripts/test-canonical-host-sdk.mjs'],
    ...(requiresIfBranchScopeQualification(product.version)?[engine==='deno'?['run','--allow-read','scripts/test-if-branch-scope.mjs']:['scripts/test-if-branch-scope.mjs']]:[]),
    ...(requiresUnusedHostImportsQualification(product.version)?[engine==='deno'?['run','--allow-read','scripts/test-canonical-host-import-demand.mjs']:['scripts/test-canonical-host-import-demand.mjs']]:[]),
    ...(requiresUnitResultMatchQualification(product.version)?[engine==='deno'?['run','--allow-read','scripts/test-unit-result-match.mjs']:['scripts/test-unit-result-match.mjs']]:[]),
    ...(requiresCanonicalCheckedResultsQualification(product.version)?[engine==='deno'?['run','--allow-read','scripts/test-canonical-checked-results.mjs']:['scripts/test-canonical-checked-results.mjs']]:[]),
    ...(requiresStringStorageQualification(product.version)?[engine==='deno'?['run','--allow-read',currentStringQualificationScript(product.version)]:[currentStringQualificationScript(product.version)]]:[])
  ];
  for(const args of commands) {
    const r=spawnSync(engine,args,{cwd:root,encoding:'utf8',timeout:60000});
    if(r.status!==0)throw Error(`${engine} ${args.at(-1)} failed: ${r.stderr}`);
    const result=JSON.parse(r.stdout);
    if(result.accepted!==true)throw Error('acceptance missing');
    runs.push({engine,version:version.stdout.trim(),args,exit_code:r.status,result});
  }
}
const booleanRuns=runs.filter(r=>r.args.at(-1)==='scripts/test-current-lib-api-v021.mjs');
assert.equal(booleanRuns.length,3);
for(const r of booleanRuns){assert.equal(r.result.calls,768);assert.equal(r.result.boolean_conditional_calls,1536);assert.equal(r.result.boolean_numeric_rejections,6);}
const booleanConditionalCalls=booleanRuns.reduce((n,r)=>n+r.result.boolean_conditional_calls,0);
const booleanNumericRejections=booleanRuns.reduce((n,r)=>n+r.result.boolean_numeric_rejections,0);
const helpers=runs.filter(r=>r.args.at(-1)==='scripts/test-current-private-helpers.mjs');assert.equal(helpers.length,3);
for(const r of helpers){assert.equal(r.result.source_cases,20);assert.equal(r.result.guest_calls,66);assert.equal(r.result.invalid_sources_rejected,5);assert.equal(r.result.long_helper_terms,2098);}
const control=spawnSync(process.execPath,['scripts/test-current-compiler-integrity.mjs'],{cwd:root,encoding:'utf8',timeout:420000});
if(control.status!==0)throw Error('current compiler integrity controls failed: '+String(control.error ?? control.signal ?? control.stderr));
const receipt={schema:'wasmc.current-compiler-qualification/v1',accepted:true,
  version:product.version,compiler_sha256:product.compiler.sha256,
  product_manifest_sha256:createHash('sha256').update(manifest).digest('hex'),
  source_free:true,compiler_private_source_present:false,
  platform:platform(),arch:arch(),runs,
  boolean_conditional_calls:booleanConditionalCalls,boolean_numeric_rejections:booleanNumericRejections,
  private_helper_guest_calls:helpers.reduce((n,r)=>n+r.result.guest_calls,0),
  rejection_controls:{exit_code:control.status,result:JSON.parse(control.stdout)},
  nonclaims:['whole-product release','whole42 Lib runtime qualification','Pi model-pair qualification','native SDK requalification','real browser qualification']};
writeFileSync(root+'current/qualification.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({accepted:true,engines:3,api_cli_outputs:180,execution_oracles:runs.length,standard_consumer_calls:23040,actual_rejections:6,compileLib_oracles:9,instantiateLib_oracles:9,managed_Lib_calls:2304,boolean_conditional_calls:booleanConditionalCalls,boolean_numeric_rejections:booleanNumericRejections,product_manifest_sha256:receipt.product_manifest_sha256}));
