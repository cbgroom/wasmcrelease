import assert from 'node:assert/strict';
import {collectJsonOverlayNotices} from './current-license-policy-json-overlay-v1.mjs';
const [root,catalogSha,expected,witPath,witSha] = process.argv.slice(2);
assert.ok(root && /^[a-f0-9]{64}$/.test(catalogSha ?? '') && ['accept','reject'].includes(expected) && witPath && /^[a-f0-9]{64}$/.test(witSha ?? ''));
let result, error;
try { result=await collectJsonOverlayNotices({root,catalogSha,oldSha:'355bcc7cf6e006616f9e7938b9c5222d922ef76590e27db633e88c64036816c2',receiptSha:'f047c0bd870d9b2b2c1e0e619fe0993d8041d981d7cd0c781867e5323b731d51',witPath,witSha,commit:'0'.repeat(40)}); }
catch(e) { error=e; }
if(expected==='accept'){if(error)throw error; assert.equal(result.size,2093);assert.equal([...result.keys()].filter(x=>x.startsWith('current-libs/wasmc-json/0.2.2/')).length,13);}
else {assert.ok(error,'changed input unexpectedly accepted');assert.ok(error.name==='AssertionError','unexpected failure kind: '+error);}
console.log(JSON.stringify({expected,accepted:!error,files:result?.size??null,error:error?.message??null,scope:'declared notice provenance, isolated local candidate'}));
