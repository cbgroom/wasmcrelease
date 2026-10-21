import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {validateCandidate,validateTransition} from '../../../../scripts/release-candidate.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),put=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const candidate=json('channels/candidates/0.0.22.json');validateCandidate(candidate,read);
assert.equal(candidate.product_set_sha256,'deb5321647d7dd1ccc27bd662d0b5b02a0c3300a2351a37045097484cbcf411a');
const main=json('channels/main.json');assert.equal(main.tag,'v0.0.22-main.1');
assert.equal(main.qualification.exact_current_workflows.length,9);
for(const r of main.qualification.exact_current_workflows){assert.equal(r.conclusion,'success');assert.equal(r.source_commit,'9c34b6030a4e17bf7f08c551d229262e668c897d');}
const prod={...main,stage:'prod',tag:'v0.0.22',qualification:{...main.qualification,
 final_local_prod_Pi:'Required separate exact final local commit/tree bound two-model Pi receipt and independent review; publisher must verify before suffix-free tag or push.'},
 promotion:'Identical immutable dev2/main1 product. This local final rehearsal requires actual independent Pi qualification before formal tag or publication.'};
delete prod.default_prod_advanced;validateTransition(main,prod,candidate);
assert.equal(existsSync('channels/0.0.22/prod.json'),false);writeFileSync('channels/0.0.22/prod.json',JSON.stringify(prod,null,2)+'\n',{flag:'wx'});put('channels/prod.json',prod);
const release=json('release.json');assert.equal(release.version,'0.0.21');
Object.assign(release,{version:'0.0.22',tag:'v0.0.22',staged_product_manifest:'channels/candidates/0.0.22.json',source_commit:candidate.compiler_source_authority,
 source_tree:'ecfac993dcf8df0bb9a04e15df5be8776c314faf',cdn:'https://cdn.jsdelivr.net/gh/cbgroom/wasmcrelease@v0.0.22',release_date:'2026-10-21',
 product_candidate_commit:main.product_candidate_commit,evidence_commit:main.qualification.tested_source_commit});
Object.assign(release.runtime,{compiler_bytes:1527770,compiler_sha256:'620a6b5f7b9a4565f14857975e37a03196f8f7e4279a2f4da388882638f2a658',
 product_candidate_commit:'9c34b6030a4e17bf7f08c551d229262e668c897d',evidence_commit:'9c34b6030a4e17bf7f08c551d229262e668c897d',
 source_free_archive_sha256:'022fe99dce868b2074cf90412bfac8f6b2d7c969b47aabf10e6b7804977e6c55'});
release.capabilities.push('integrated ordinary-call, record-value, scalar-comparison, invalid adapter-return cleanup and copied-byte correctness repairs');
release.nonclaims.push('Map/Core4.11 and JSON0.0.2 publication; these remain separately versioned successors');put('release.json',release);
const index=json('package-index.json');assert.equal(index.latest,'0.0.21');index.latest='0.0.22';index.versions.unshift({manifest:'manifest.json',release_date:release.release_date,stable:false,tag:release.tag,version:release.version});put('package-index.json',index);
const surface=json('release-surfaces.json');for(const path of json('.agents/workstreams/WS-20261021-formal-normal-functional-v022/evidence/stage-status-paths.json').paths){let o=surface;for(const k of path.slice(0,-1))o=o[k];assert.equal(o[path.at(-1)],'candidate');o[path.at(-1)]='published';}
surface.agent_capability_projection.type_decisions.u64_ordinary_source.status='released';
const telemetry=surface.agent_status_queries['direct-wasmc-system-telemetry-resource'].related_released_product;
for(const k of ['released','discoverable','installable'])telemetry[k]=true;
put('release-surfaces.json',surface);
console.log(JSON.stringify({accepted:true,scope:'local-final-prod-rehearsal-only',product:candidate.product_set_sha256,formal_publication:false}));
