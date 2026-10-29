import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const fixture=process.env.WASMC_MIXED_CLI_FIXTURE,old=process.env.WASMC_V030_CLI_FIXTURE;
const pin='1eb246739e0ac6db2e9a19c3e7dfbd8eae7277a45a7afd3f4f6a03a40d62864c';
function cli(root,args){return spawnSync(process.execPath,[join(root,'scripts/wasmc-lib.mjs'),...args],{encoding:'utf8',maxBuffer:4*1024*1024});}
test('mixed CLI discovers and resolves new and frozen Roots', {skip:!fixture},()=>{
  const search=cli(fixture,['search','json','--catalog-sha256',pin,'--limit','2']);assert.equal(search.status,0,search.stderr);
  const result=JSON.parse(search.stdout);assert.equal(result.result.tag,'ok');
  assert.ok(result.result.value.some(x=>x.identity==='wasmc-json@0.2.1'));
  const catalog=JSON.parse(readFileSync(join(fixture,'catalog/libs-current-v2.json')));
  for(const id of ['wasmc-json','wasmc-resource-counter']){
    const r=catalog.packages.find(x=>x.id===id);
    const call=cli(fixture,['resolve',id,r.version,'--catalog-sha256',pin,'--manifest-sha256',r.manifest_sha256,'--root-inventory-sha256',r.root_inventory_sha256]);
    assert.equal(call.status,0,call.stderr);const lock=JSON.parse(call.stdout);assert.equal(lock.verified,true);assert.equal(lock.manifest_sha256,r.manifest_sha256);
  }
  const bad=cli(fixture,['search','json','--catalog-sha256','0'.repeat(64)]);assert.notEqual(bad.status,0);
});
test('older cohort works without the mixed verifier modules', {skip:!old},()=>{
  const r=cli(old,['search','json','--catalog-sha256','e12684efb3e475ad551eddabda12bc4c196f19edb48e7ace9069fda1ef5e7871','--limit','2']);
  assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).result.tag,'ok');
});
