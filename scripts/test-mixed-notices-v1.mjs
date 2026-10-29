import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentProductPaths,currentProductReader } from './current-lib-release-v3.mjs';
import { collectMixedDeclaredNotices } from './current-license-policy-mixed-v1.mjs';

const root=process.env.WASMC_MIXED_NOTICE_FIXTURE;
test('mixed notice collector verifies both historical and current declarations', {skip:!root},async()=>{
  const r=currentProductReader(root),paths=currentProductPaths(root),catalog=r('catalog/libs-current-v2.json');
  const policy={schema:'wasmc.current-license-policy/mixed-v1',version:'0.0.31',package_authority_commit:'0'.repeat(40),
    current_packages:43,catalog_sha256:'2b9edba0f3f9c085f881ef0f385644829e483779200624b3035fa5e16779651b'};
  const collect=(read=async p=>r(p),p=policy)=>collectMixedDeclaredNotices(catalog,p,read,paths);
  const result=await collect();assert.equal(result.size,1620);
  const old=[...result.keys()].filter(p=>p.startsWith('admission/mixed-product-inputs-v1/old/'));
  const fresh=[...result.keys()].filter(p=>p.startsWith('admission/mixed-product-inputs-v1/candidate/'));
  const selected=[...result.keys()].filter(p=>p.startsWith('current-libs/'));
  assert.equal(old.length,588);assert.equal(fresh.length,572);assert.equal(selected.length,447);
  await assert.rejects(()=>collect(undefined,{...policy,catalog_sha256:'0'.repeat(64)}));
  const target=selected[0];
  await assert.rejects(()=>collect(async p=>p===target?Buffer.concat([r(p),Buffer.from('x')]):r(p)));
});
