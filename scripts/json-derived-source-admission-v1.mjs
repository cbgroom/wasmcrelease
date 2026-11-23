// Private Source custody check for independently reproduced Lib API producers. It reads
// remote master and Git trees only; it does not modify a checkout or a ref.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
const sourcePins = {
  '6fcfe8d86b19b491919b96b9bade8d8556477671': {
    producer: '1813308d058e38b511e7ff0011507631be2a828c4d2b5a77e7669f31cf3b25af',
    inventory: 'db392db650e13909b60da609ec9246b6e4e0b2d9de6ca172880440f9a8e41173',
  },
  'c92b70b1c7c3db2a10a0ae42f9859624db7caf65': {
    producer: 'a56a49677e7fab7eb477610078ebce8eb99416cfa21472c06a16aff5edcbb470',
    inventory: '3bab1a5cf78d7497a5d8a646ca128aad0da3c396160670723f73b254054d1f06',
  },
  '51ddc3c2c790d25186e4441274edb8d2bd665f20': {
    producer: 'd92f4700253e5855226ccf8234749045533f759fa4d28fa00c46901a655c37de',
    inventory: '1324a0a9e68db0fdd448108f8fbe2f87c54a413db8891b77b0785b0dad91a167',
  },
};
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
 assert.equal(value.schema,'wasmc.json-derived-source-admission/v1');
 assert.ok(Object.hasOwn(sourcePins,value.source_commit),'qualified producer Source identity required');
 const pin=sourcePins[value.source_commit];
 assert.equal(value.producer_sha256,pin.producer);
 assert.match(value.source_master,/^[0-9a-f]{40}$/);assert.equal(value.source_inputs,123);assert.equal(value.source_inventory_sha256,pin.inventory);
 assert.equal(value.source_input_match,true);assert.equal(value.source_ci_verified,false);return true;
}
export function verifyJsonDerivedSource({sourceRepo,buildSource,producerSha256}){
 assert.ok(isAbsolute(sourceRepo??''),'absolute Source repository required');
 assert.ok(Object.hasOwn(sourcePins,buildSource),'qualified producer Source identity required');
 assert.equal(producerSha256,sourcePins[buildSource].producer,'qualified Lib API producer required');
 const origin=git(sourceRepo,'remote','get-url','origin').trim();assert.equal(origin,'https://github.com/yxsicd/wasmc.git','canonical Source origin');
 const line=git(sourceRepo,'ls-remote','--exit-code','origin','refs/heads/master').trim();const m=/^([0-9a-f]{40})\s+refs\/heads\/master$/.exec(line);assert.ok(m,'remote Source master required');
 const master=m[1],built=entries(sourceRepo,buildSource),admitted=entries(sourceRepo,master);
 assert.deepEqual(admitted,built,'producer Source inputs are not identical to current Source master');
 const second=git(sourceRepo,'ls-remote','--exit-code','origin','refs/heads/master').trim();assert.equal(second,line,'Source master changed during verification');
 const result={schema:'wasmc.json-derived-source-admission/v1',source_commit:buildSource,source_master:master,producer_sha256:producerSha256,source_inputs:built.length,source_inventory_sha256:createHash('sha256').update(JSON.stringify(built)).digest('hex'),source_input_match:true,source_ci_verified:false};
 validateJsonDerivedSourceAdmission(result);return result;
}
