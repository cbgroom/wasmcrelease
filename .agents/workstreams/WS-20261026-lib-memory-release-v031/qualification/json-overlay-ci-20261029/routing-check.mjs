import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const project=process.cwd(),fixture='/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-v023-q0-20261029/public-product-git';
const temp=mkdtempSync(join(tmpdir(),'wasmc-overlay-ci-'));mkdirSync(join(temp,'scripts'));mkdirSync(join(temp,'catalog'));mkdirSync(join(temp,'admission'));mkdirSync(join(temp,'channels/candidates'),{recursive:true});
copyFileSync(join(project,'scripts/ci-suite.mjs'),join(temp,'scripts/ci-suite.mjs'));
const bytes=readFileSync(join(fixture,'catalog/libs-current-v2.json')),catalog=JSON.parse(bytes),sha=createHash('sha256').update(bytes).digest('hex');
writeFileSync(join(temp,'catalog/libs-current-v2.json'),bytes);copyFileSync(join(fixture,catalog.cohort.path),join(temp,catalog.cohort.path));
const {suiteCases}=await import(pathToFileURL(join(temp,'scripts/ci-suite.mjs')).href);
assert.throws(()=>suiteCases('candidate'),/ENOENT/);
const manifestPath=join(temp,'channels/candidates',catalog.version+'.json');const candidate={schema:'wasmc.release-product-candidate/v3',version:catalog.version,current_catalog:{path:'catalog/libs-current-v2.json',sha256:sha}};
writeFileSync(manifestPath,JSON.stringify(candidate));
for(const runtime of ['node','bun','deno'])for(const family of ['candidate','integrity']){
 const cases=suiteCases(family,runtime),product=cases.find(x=>x.id==='current-complete-product-reopen-negatives'),notice=cases.find(x=>x.id==='json-overlay-declared-notice-bytes');
 assert.ok(product.args.includes('scripts/test-json-overlay-product-ci-v1.mjs'));assert.ok(product.args.includes(sha));assert.ok(notice.args.includes('notices'));assert.ok(notice.args.includes(sha));
}
candidate.current_catalog.sha256='0'.repeat(64);writeFileSync(manifestPath,JSON.stringify(candidate));assert.throws(()=>suiteCases('candidate'),/candidate catalog identity drift/);
console.log(JSON.stringify({accepted:true,scope:'routing fixture with synthetic manifest; no release admission',missing_manifest_rejected:true,wrong_pin_rejected:true,runtimes:['node','bun','deno']}));
