import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json=path=>JSON.parse(readFileSync(path,'utf8'));
const text=path=>readFileSync(path,'utf8');
const candidate=json('channels/candidates/0.0.14.json');
const main=json('channels/main.json');
const prod=json('channels/prod.json');
const quickstart=json('agent-quickstart.json');
const readiness=json('release-lib-route-readiness.json');
const surfaces=json('release-surfaces.json');
const admission=json('admission/lib-search-v020-v014-admission.json');
const agents=text('AGENTS.md');

assert.equal(candidate.product_set_sha256,'a09cd071eb293e636bf8b858b0a56570bfdd8a53373544eca68fda8ea825d4d2');
assert.match(agents,/product presence is not lifecycle authority/i);
assert.equal(quickstart.routes['release-orientation'].product_version,'v0.0.14');
assert.match(quickstart.routes['release-orientation'].lifecycle_authority,/release\.json.*channels\/prod\.json/i);
assert.equal(quickstart.routes['release-lib-route-readiness'].product.version,'0.0.14');
assert.equal(readiness.product.version,'0.0.14');
assert.equal(readiness.product.formal_release_ready,true);
assert.equal(readiness.active_search.states.included_in_product,true);
assert.equal(readiness.lifecycle_authority.current_release,'release.json');
assert.equal(surfaces.release_version,'0.0.14');
assert.equal(surfaces.agent_capability_projection.product_release,'v0.0.14');
assert.equal(surfaces.agent_capability_projection.guidance_scope.included_in_product,true);
assert.equal(surfaces.agent_capability_projection.guidance_scope.lifecycle_authority,'release.json and channels/prod.json');
assert.equal(admission.state_scope,'admission-checkpoint-only');
assert.deepEqual(admission.current_lifecycle_authority,['release.json','channels/prod.json']);
for(const [path,patterns] of Object.entries({
  'agent-quickstart.json':[/"release": "v0\.0\.13"/,/"first_missing_authority"/],
  'release-lib-route-readiness.json':[/"tag": "v0\.0\.13"/,/"first_missing_authority"/],
  'release-surfaces.json':[/"current_immutable_product": "v0\.0\.13"/,/Stop at dev-stage qualification/]
})){
  const body=text(path);
  for(const pattern of patterns)assert.equal(pattern.test(body),false,`stage-stale guidance remains in ${path}: ${pattern}`);
}
assert.equal(main.tag,'v0.0.14-main.1');
assert.equal(main.product_set_sha256,'0eb2d0addf9e0cfe9afb11502848bf0a09a55616c5024727ec98729103a138bc');
assert.equal(prod.tag,'v0.0.13');

console.log(JSON.stringify({
  accepted:true,
  product_ready:true,
  prod_ready:false,
  candidate:'0.0.14',
  superseded_main:main.tag,
  current_prod:prod.tag,
  blocker:'exact-dev2-and-main2-qualification-required',
  required_recovery:'qualify this exact product set as v0.0.14-dev.2, then promote the same bytes to v0.0.14-main.2'
}));
