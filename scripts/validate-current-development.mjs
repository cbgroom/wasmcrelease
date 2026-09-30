import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=script=>execFileSync(process.execPath,[script],{cwd:root,stdio:['ignore','pipe','pipe'],encoding:'utf8'});
for(const script of ['scripts/test-current-v2-catalog.mjs','scripts/test-current-v2-closure.mjs','scripts/test-current-v2-search.mjs','scripts/test-library-first.mjs'])run(script);
const release=JSON.parse(readFileSync(new URL('../release.json',import.meta.url)));
const releaseBaseline='c49bfcd5971fdd3780303b61378e5a1f2502a45d';
// A development tree cannot reauthorize future bytes with the old manifest.
// Release identities remain bound to the immutable tag even when main moves.
for(const path of ['release.json','manifest.json','SHA256SUMS','provenance.json','channels/prod.json','channels/candidates/0.0.20.json']){
  const frozen=execFileSync('git',['show',`${releaseBaseline}:${path}`],{cwd:root});
  assert.deepEqual(readFileSync(new URL('../'+path,import.meta.url)),frozen,`frozen release identity changed: ${path}`);
}
const result=spawnSync(process.execPath,['scripts/release-candidate.mjs','verify','channels/candidates/0.0.20.json'],{cwd:root,encoding:'utf8'});
assert.notEqual(result.status,0,'future bytes unexpectedly accepted as v0.0.20');
assert.match(result.stderr,/product drift rejected/,'unexpected failure is not a drift rejection');
console.log(JSON.stringify({accepted:true,scope:'current-v2-development',release_tag:release.tag,release_baseline:releaseBaseline,preserved_identity_files:6,old_candidate_rejects_future_bytes:true,release_qualified:false}));
