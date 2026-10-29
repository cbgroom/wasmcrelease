import assert from 'node:assert/strict';
import {join} from 'node:path';
import {test} from 'node:test';
import {currentCandidateArguments,currentProductVariant,currentProductInputsForVersion,verifyCurrentCandidateMixed} from './release-candidate.mjs';
import {currentProductReader} from './current-lib-release-v3.mjs';

const state=process.env.WASMC_QUALIFICATION_STATE,repo=process.env.WASMC_AUTHORITY_REPO;
test('mixed candidate selects exact source graphs and independently pinned inputs',{skip:!state||!repo},async()=>{
  const flags=['--mixed-catalog-sha256','355bcc7cf6e006616f9e7938b9c5222d922ef76590e27db633e88c64036816c2',
    '--mixed-source-root',join(state,'cohort43-wit16-union-stage-20261029'),'--mixed-authority-repo',repo,
    '--mixed-run-root',join(state,'cohort43-wit16-union-evidence-20261029/runs/refresh-qdwi17'),
    '--mixed-receipt-sha256','22be7ccfd4547c099fc8ae0e901a74741fcc56f886550d31cbfc070e22d7d624',
    '--mixed-producer-sha256','924dc71ebaa01f027d0ce8a247b7d22f9743dee1c10bc57aef6470996f373179',
    '--mixed-wit-tool','/Users/youxianshi/.cargo/bin/wasm-tools','--mixed-wit-tool-sha256','40c3d0e890e86cc86ef186fe3e504cd62d03da90fe0a1fc81b6588d078bd0a65',
    '--mixed-refs-path',join(state,'wasmcrelease-all-remote-tags-20261029.txt'),'--mixed-refs-sha256','97a88f957ccd9f4a26c3a11723e5d7664165783267ba70f30189590e3aa63a44',
    '--mixed-q2-path',join(state,'cohort43-wit16-union-evidence-20261029/runs/refresh-qdwi17/current-search-app-q2-fj0OdW/receipt.json'),
    '--mixed-q2-sha256','ca3c73fdf625ca8a0970983abf4521e03d47d805c0788415061814ea0df1d21e',
    '--mixed-network-path',join(state,'mixed-network-cohort-20261029/receipt.json'),
    '--mixed-network-sha256','4f3050846e2cfc9957753647596faea2214758a95a67e8057db84d4e794df28c',
    '--mixed-network-root',join(state,'mixed-network-cohort-20261029'),'--mixed-previous-parent',state];
  const options=await currentCandidateArguments(flags),product=join(state,'mixed-product-real-authority-20261029');
  assert.equal(options.kind,'mixed');const r=currentProductReader(product),bytes=r('catalog/libs-current-v2.json');
  assert.equal(currentProductVariant(bytes,options.catalogSha,r),'mixed');
  const required=currentProductInputsForVersion('0.0.31','mixed');
  assert.ok(required.includes('catalog/current-mixed-license-policy-v1.json'));
  const result=await verifyCurrentCandidateMixed(product,options);
  assert.equal(result.closure.packages,43);assert.equal(result.qualification.network_files,822);
  for(const name of ['old','candidate'])assert.ok(result.product_inputs.some(p=>p.startsWith(`admission/mixed-product-inputs-v1/${name}/`)));
  assert.ok(result.product_inputs.includes('current-libs/wasmc-json/0.2.1/lib.json'));
  await assert.rejects(currentCandidateArguments(flags.slice(0,-2)));
  await assert.rejects(currentCandidateArguments([...flags,'--mixed-q2-sha256','0'.repeat(64)]));
  await assert.rejects(verifyCurrentCandidateMixed(product,{...options,catalogSha:'0'.repeat(64)}));
});
