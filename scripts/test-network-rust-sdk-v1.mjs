import assert from 'node:assert/strict';
import {access,mkdtemp,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {qualifyNetworkRustSdk} from './qualify-network-rust-sdk-v1.mjs';

const state=process.env.WASMC_QUALIFICATION_STATE;
test('network SDK qualification rejects wrong inputs before compilation',{skip:!state},async()=>{
  const temp=await mkdtemp(join(await realpath(tmpdir()),'network-sdk-'));
  try{
    const o={catalogPath:join(state,'mixed-product-real-authority-20261029/catalog/libs-current-v2.json'),
      catalogSha:'355bcc7cf6e006616f9e7938b9c5222d922ef76590e27db633e88c64036816c2',
      installPath:join(state,'mixed-network-cohort-20261029/receipt.json'),installSha:'4f3050846e2cfc9957753647596faea2214758a95a67e8057db84d4e794df28c',
      networkRoot:join(state,'mixed-network-cohort-20261029'),previousParent:state,out:join(temp,'out'),
      rustc:'/Users/youxianshi/.cargo/bin/rustc',rustcVersion:'rustc 1.99.1 (58cf8f9c3 2026-10-13)'};
    await assert.rejects(qualifyNetworkRustSdk({...o,catalogSha:'0'.repeat(64)}));
    await assert.rejects(qualifyNetworkRustSdk({...o,installSha:'0'.repeat(64)}));
    await assert.rejects(qualifyNetworkRustSdk({...o,rustcVersion:'wrong compiler'}),/Rust compiler identity/);
    await assert.rejects(access(o.out));
  }finally{await rm(temp,{recursive:true,force:true});}
});
