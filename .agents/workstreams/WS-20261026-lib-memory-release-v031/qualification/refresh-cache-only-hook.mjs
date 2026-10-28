// Test-only loader guard. The runner and its digest on disk remain untouched;
// abort before any build if even one object is missing or rebuild is requested.
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
const pin=process.env.WASMC_TEST_RUNNER_SHA256;
assert.match(pin??'',/^[a-f0-9]{64}$/);
let seen=false;
registerHooks({load(url,context,nextLoad){
 const result=nextLoad(url,context);
 if (!url.endsWith('/scripts/lib-refresh-runner-v2.mjs')) return result;
 assert.equal(seen,false,'multiple refresh runners');seen=true;
 const bytes=Buffer.from(result.source),sha=createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha,pin,'runner source pin');
 const before='if (cached && !args.rebuild) {';
 assert.equal(bytes.toString().split(before).length,2,'cache branch identity');
 const guard="if (!cached || args.rebuild) throw new Error('TEST_CACHE_ONLY_MISSING_OR_REBUILD: ' + id);\n      "+before;
 return {...result,source:bytes.toString().replace(before,guard)};
}});
