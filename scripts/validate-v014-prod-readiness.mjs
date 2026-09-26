import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json=path=>JSON.parse(readFileSync(path,'utf8'));
const text=path=>readFileSync(path,'utf8');
const candidate=json('channels/candidates/0.0.14.json');
const main=json('channels/main.json');
const prod=json('channels/prod.json');
const stale=[];
for(const [path,patterns] of Object.entries({
  'AGENTS.md':[/pin that tag.*v0\.0\.13|v0\.0\.13 capability contract/s],
  'README.md':[/Current staged version: \*\*v0\.0\.13|Current release: `v0\.0\.13`/],
  'agent-quickstart.json':[/"release": "v0\.0\.13"/,/"first_missing_authority": "dev-stage qualification/],
  'release-lib-route-readiness.json':[/"tag": "v0\.0\.13"/,/"first_missing_authority": "dev-stage qualification/],
  'release-surfaces.json':[/"current_immutable_product": "v0\.0\.13"/,/"answer_boundary": "Stop at dev-stage qualification/],
  'skills/wasmc-lib-discovery/SKILL.md':[/immutable v0\.0\.13 still contains 0\.1\.0/]
})){
  const body=text(path);
  for(const pattern of patterns)if(pattern.test(body))stale.push({path,pattern:String(pattern)});
}
const productPaths=new Set(candidate.product_files.map(row=>row.path));
for(const row of stale)assert.equal(productPaths.has(row.path),true,`stale guidance is outside candidate: ${row.path}`);
assert.equal(candidate.product_set_sha256,'0eb2d0addf9e0cfe9afb11502848bf0a09a55616c5024727ec98729103a138bc');
assert.equal(main.tag,'v0.0.14-main.1');
assert.equal(prod.tag,'v0.0.13');
assert(stale.length>=6,'expected lifecycle-stale candidate guidance was not detected');

console.log(JSON.stringify({
  accepted:true,
  prod_ready:false,
  candidate:'0.0.14',
  main:main.tag,
  current_prod:prod.tag,
  blocker:'candidate-lifecycle-guidance-is-stage-stale',
  stale_assertions:stale.length,
  required_recovery:'create a lifecycle-neutral superseding candidate and requalify it as v0.0.14-dev.2'
}));
