import assert from 'node:assert/strict';
import {test} from 'node:test';
import {currentProductReader} from './current-lib-release-v3.mjs';
import {verifyMixedArtifactAuthority} from './mixed-current-product-v1.mjs';

const mixedRoot=process.env.WASMC_REAL_MIXED_FIXTURE,oldRoot=process.env.WASMC_OLD_PRODUCT;
const newRoot=process.env.WASMC_NEW_PRODUCT,repo=process.env.WASMC_AUTHORITY_REPO;
test('all selected Roots and source pins match the actual authority commit',{skip:!mixedRoot||!oldRoot||!newRoot||!repo},()=>{
  const mixed=currentProductReader(mixedRoot),old=currentProductReader(oldRoot),fresh=currentProductReader(newRoot);
  const catalog=JSON.parse(mixed('catalog/libs-current-v2.json')),cohort=JSON.parse(mixed(catalog.cohort.path));
  const check=(commit,read=fresh)=>verifyMixedArtifactAuthority(repo,commit,catalog.packages,catalog.registry,old,read,cohort.reused);
  assert.equal(check(catalog.package_authority_commit).files,909);
  assert.throws(()=>check('3ed99aa6f558f25940d4baa09a31cbae3336b911'),/artifact authority blob/);
  assert.throws(()=>check(catalog.package_authority_commit,p=>p===catalog.registry.path?Buffer.concat([fresh(p),Buffer.from('x')]):fresh(p)));
});
