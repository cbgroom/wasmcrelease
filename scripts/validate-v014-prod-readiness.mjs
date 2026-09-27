import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json=path=>JSON.parse(readFileSync(path,'utf8'));
const text=path=>readFileSync(path,'utf8');
const candidate=json('channels/candidates/0.0.14.json');
const dev=json('channels/dev.json');
const main=json('channels/main.json');
const prod=json('channels/prod.json');
const quickstart=json('agent-quickstart.json');
const readiness=json('release-lib-route-readiness.json');
const surfaces=json('release-surfaces.json');
const admission=json('admission/lib-search-v020-v014-admission.json');
const ecosystem=json('lib-ecosystem-control-plane.json');
const packageIndex=json('package-index.json');
const agents=text('AGENTS.md');
const ecosystemGenerator=text('scripts/lib-ecosystem-control-plane.mjs');
const surfaceValidator=text('scripts/validate-release-surfaces.mjs');

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
assert.match(ecosystemGenerator,/release\.version === '0\.0\.14'/);
assert.match(ecosystemGenerator,/catalog\/libs-v014\.json/);
assert.match(ecosystemGenerator,/successor_candidates: release\.version === '0\.0\.14' \? \[\] : \[searchCandidate\]/);
assert.match(surfaceValidator,/const prod014=ecosystemModel\.release\.version==='0\.0\.14'/);
assert.match(surfaceValidator,/released LibSearch 0\.2 route missing/);
for(const [path,patterns] of Object.entries({
  'agent-quickstart.json':[/"release": "v0\.0\.13"/,/"first_missing_authority"/],
  'release-lib-route-readiness.json':[/"tag": "v0\.0\.13"/,/"first_missing_authority"/],
  'release-surfaces.json':[/"current_immutable_product": "v0\.0\.13"/,/Stop at dev-stage qualification/]
})){
  const body=text(path);
  for(const pattern of patterns)assert.equal(pattern.test(body),false,`stage-stale guidance remains in ${path}: ${pattern}`);
}
assert.equal(dev.tag,'v0.0.14-dev.2');
assert.equal(dev.product_candidate_commit,'6cb3aafea5334ac27648af0e9ccd684fe721ccb5');
assert.equal(dev.product_set_sha256,candidate.product_set_sha256);
assert.equal(dev.qualification.accepted,true);
assert.equal(dev.qualification.receipt,'admission/qualification-v014-dev2.json');
assert.equal(main.tag,'v0.0.14-main.2');
assert.equal(main.product_candidate_commit,dev.product_candidate_commit);
assert.equal(main.product_set_sha256,candidate.product_set_sha256);
assert.equal(main.qualification.accepted,true);
assert.equal(main.qualification.receipt,'admission/qualification-v014-dev2.json');
assert.equal(prod.tag,'v0.0.14');
assert.equal(prod.product_candidate_commit,main.product_candidate_commit);
assert.equal(prod.product_set_sha256,candidate.product_set_sha256);
assert.equal(prod.qualification.receipt,'admission/qualification-v014-dev2.json');
assert.equal(packageIndex.latest,'0.0.14');
assert.deepEqual({packages:ecosystem.inventory.packages,released:ecosystem.inventory.released,discoverable:ecosystem.inventory.discoverable,installable:ecosystem.inventory.installable},{packages:14,released:14,discoverable:14,installable:14});
assert.equal(ecosystem.inventory.inventory_is_unified,true);
assert.equal(ecosystem.successor_candidates.length,0);
assert.deepEqual(ecosystem.packages.find(row=>row.identity==='wasmc:lib-search@0.2.0')?.states,{qualified:true,admitted:true,released:true,discoverable:true,installable:true});

console.log(JSON.stringify({
  accepted:true,
  product_ready:true,
  prod_ready:true,
  candidate:'0.0.14',
  main:main.tag,
  current_prod:prod.tag,
  dev:dev.tag,
  blocker:null,
  published:true,
  next:null
}));
