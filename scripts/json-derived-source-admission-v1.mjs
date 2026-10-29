// Private Source custody check for the one pinned Lib API producer. It reads
// remote master and Git trees only; it does not modify a checkout or a ref.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
const sourceCommit='6fcfe8d86b19b491919b96b9bade8d8556477671';
const producerSha='1813308d058e38b511e7ff0011507631be2a828c4d2b5a77e7669f31cf3b25af';
const paths=['Cargo.toml','Cargo.lock','src','crates','examples/wasmc_lib_tool_v0_document.wasmc','docs/wasmc-lib-tool-v0-document.wit'];
function git(repo,...args){return execFileSync('git',['-C',repo,...args],{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});}
function entries(repo,commit){
 const rows=git(repo,'ls-tree','-r','-z','--full-tree',commit,'--',...paths).split('\0').filter(Boolean).map(row=>{
  const m=/^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/.exec(row);assert.ok(m,'unsupported source tree entry');return {path:m[3],mode:m[1],blob:m[2]};
 }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 assert.ok(rows.length>0);assert.equal(new Set(rows.map(x=>x.path)).size,rows.length);return rows;
}
export function validateJsonDerivedSourceAdmission(value){
 assert.deepEqual(Object.keys(value??{}).sort(),['producer_sha256','schema','source_ci_verified','source_commit','source_input_match','source_inputs','source_inventory_sha256','source_master'].sort(),'complete derived Source admission receipt');
 assert.equal(value.schema,'wasmc.json-derived-source-admission/v1');assert.equal(value.source_commit,sourceCommit);assert.equal(value.producer_sha256,producerSha);
 assert.match(value.source_master,/^[0-9a-f]{40}$/);assert.equal(value.source_inputs,123);assert.equal(value.source_inventory_sha256,'db392db650e13909b60da609ec9246b6e4e0b2d9de6ca172880440f9a8e41173');
 assert.equal(value.source_input_match,true);assert.equal(value.source_ci_verified,false);return true;
}
export function verifyJsonDerivedSource({sourceRepo,buildSource,producerSha256}){
 assert.ok(isAbsolute(sourceRepo??''),'absolute Source repository required');assert.equal(buildSource,sourceCommit,'producer Source identity');assert.equal(producerSha256,producerSha,'qualified Lib API producer required');
 const origin=git(sourceRepo,'remote','get-url','origin').trim();assert.equal(origin,'https://github.com/yxsicd/wasmc.git','canonical Source origin');
 const line=git(sourceRepo,'ls-remote','--exit-code','origin','refs/heads/master').trim();const m=/^([0-9a-f]{40})\s+refs\/heads\/master$/.exec(line);assert.ok(m,'remote Source master required');
 const master=m[1],built=entries(sourceRepo,buildSource),admitted=entries(sourceRepo,master);
 assert.deepEqual(admitted,built,'producer Source inputs are not identical to current Source master');
 const second=git(sourceRepo,'ls-remote','--exit-code','origin','refs/heads/master').trim();assert.equal(second,line,'Source master changed during verification');
 const result={schema:'wasmc.json-derived-source-admission/v1',source_commit:buildSource,source_master:master,producer_sha256:producerSha,source_inputs:built.length,source_inventory_sha256:createHash('sha256').update(JSON.stringify(built)).digest('hex'),source_input_match:true,source_ci_verified:false};
 validateJsonDerivedSourceAdmission(result);return result;
}
