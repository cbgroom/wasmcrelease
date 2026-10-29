import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {qualifyMixedReleaseInputs} from './qualify-mixed-release-inputs-v1.mjs';

const state=process.env.WASMC_QUALIFICATION_STATE,repo=process.env.WASMC_AUTHORITY_REPO;
test('mixed release inputs reject independently incorrect evidence pins',{skip:!state||!repo},async()=>{
  const o={product:join(state,'mixed-product-real-authority-20261029'),catalogSha:'355bcc7cf6e006616f9e7938b9c5222d922ef76590e27db633e88c64036816c2',
    sourceRoot:join(state,'cohort43-wit16-union-stage-20261029'),repo,runRoot:join(state,'cohort43-wit16-union-evidence-20261029/runs/refresh-qdwi17'),
    receiptSha:'22be7ccfd4547c099fc8ae0e901a74741fcc56f886550d31cbfc070e22d7d624',producerSha:'924dc71ebaa01f027d0ce8a247b7d22f9743dee1c10bc57aef6470996f373179',
    witTool:'/Users/youxianshi/.cargo/bin/wasm-tools',witToolSha:'40c3d0e890e86cc86ef186fe3e504cd62d03da90fe0a1fc81b6588d078bd0a65',
    refsPath:join(state,'wasmcrelease-all-remote-tags-20261029.txt'),refsSha:'97a88f957ccd9f4a26c3a11723e5d7664165783267ba70f30189590e3aa63a44',
    q2Path:join(state,'cohort43-wit16-union-evidence-20261029/runs/refresh-qdwi17/current-search-app-q2-fj0OdW/receipt.json'),q2Sha:'ca3c73fdf625ca8a0970983abf4521e03d47d805c0788415061814ea0df1d21e',
    networkPath:join(state,'mixed-network-cohort-20261029/receipt.json'),networkSha:'4f3050846e2cfc9957753647596faea2214758a95a67e8057db84d4e794df28c',
    networkRoot:join(state,'mixed-network-cohort-20261029'),previousParent:state};
  const result=await qualifyMixedReleaseInputs(o);assert.equal(result.network_roots,43);assert.equal(result.network_files,822);
  await assert.rejects(qualifyMixedReleaseInputs({...o,catalogSha:'0'.repeat(64)}));
  await assert.rejects(qualifyMixedReleaseInputs({...o,q2Sha:'0'.repeat(64)}),/Q2 receipt pin/);
  await assert.rejects(qualifyMixedReleaseInputs({...o,networkSha:'0'.repeat(64)}),/network receipt pin/);
});
