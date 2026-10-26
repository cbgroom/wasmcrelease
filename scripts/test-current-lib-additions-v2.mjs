import assert from 'node:assert/strict';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import {composeCurrentLibData,buildCurrentCompositionCandidateData,verifyCurrentCompositionCandidateData} from './lib-current-composition-v1.mjs';
import {checkedCurrentCatalog,verifyCurrentRelease,currentProductReader,currentProductPaths} from './current-lib-release-v3.mjs';
import {verifyCurrentCompositionLineageData} from './current-lib-source-custody-v1.mjs';
import {checkCompositionOptions} from './current-lib-composition-input-v2.mjs';import {digest,sha} from './lib-refresh-cache-v2.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=currentProductReader(root),prior=JSON.parse(read('admission/string-text-v030/previous-cohort-v1.json')),options=JSON.parse(read('admission/string-text-v030/options-v2.json'));
const originalPaths=prior.input_files.map(p=>p.path),original=new Set(originalPaths);
const input={read:p=>original.has(p)?read(prior.input_prefix+'/'+p):read(p),paths:p=>{const old=originalPaths.filter(x=>x.startsWith(p+'/'));return old.length?old:currentProductPaths(root,p);}};
const legacy=composeCurrentLibData(input,prior.input_options);assert.deepEqual(legacy,prior.composition,'prior v1 composition remains exact');assert.equal(verifyCurrentCompositionLineageData(input,prior.input_options,legacy,prior.composition_sha256,prior.source_lineage,{checkedCurrentCatalog,verifyCurrentRelease}).accepted,true);
const composition=composeCurrentLibData(input,options);assert.deepEqual(composition.summary,{packages:43,reused_roots:41,imported_roots:2,apis:277,entries:320,fresh_builds:0});const candidate=buildCurrentCompositionCandidateData(input,options);assert.equal(candidate.index.packages.length,43);assert.equal(candidate.verification.actual_Core_Search_lookups,320);assert.equal(verifyCurrentCompositionCandidateData(input,options,candidate).accepted,true);
let rejected=0;function reject(fn){assert.throws(fn);rejected++;}
for(const mutate of [
 o=>o.schema='invalid',o=>o.unknown=true,o=>delete o.additions,o=>o.additions=[],o=>o.additions.push(structuredClone(o.additions[0])),o=>o.additions[0].id='wasmc-json',o=>o.reused_ids.pop(),o=>o.additions[0].manifest_sha256='0'.repeat(64),o=>o.additions[0].root_inventory_sha256='0'.repeat(64),o=>o.additions[0].source.inventory_sha256='0'.repeat(64),o=>o.additions[0].source.authority.publication_sha256='0'.repeat(64),o=>o.additions[0].source.authority.canonical_source_commit='0'.repeat(40),o=>o.additions[0].source.authority.build_report_sha256='0'.repeat(64),o=>o.additions[0].version='0.0.2'
]){const o=structuredClone(options);mutate(o);reject(()=>composeCurrentLibData(input,o));}
const v1=structuredClone(prior.input_options);v1.additions=options.additions;reject(()=>checkCompositionOptions(v1,legacy.rows.map(r=>r.id)));
const selection=options.additions[0],packet=selection.source.root;
for(const [name,mutate]of [
 ['published',v=>v.anonymous_root_download_verified=false],['Git-root',v=>v.immutable_Git_root_verified=false],['draft',v=>v.draft=true],['manifest',v=>v.root_manifest_sha256='0'.repeat(64)],['archive',v=>v.actual_root_archive_sha256='0'.repeat(64)],['path',v=>v.root_asset.url='https://example.invalid/root']
]){
 const path=packet+'/'+selection.source.publication,publication=JSON.parse(input.read(path));mutate(publication);const raw=Buffer.from(JSON.stringify(publication,null,2)+'\n'),o=structuredClone(options);o.additions[0].source.authority.publication_sha256=sha(raw);const overlay={...input,read:p=>p===path?raw:input.read(p)};
 o.additions[0].source.inventory_sha256=digest(Object.fromEntries(input.paths(packet).map(p=>{const b=overlay.read(p);return[p.slice(packet.length+1),{bytes:b.length,sha256:sha(b)}];})));
 reject(()=>composeCurrentLibData(overlay,o));
}
// Even a self-rehashed packet cannot replace the actual Rust logic observed in the original build report.
{
 const path=packet+'/'+selection.source.logic,raw=Buffer.concat([input.read(path),Buffer.from('\n// changed source\n')]),o=structuredClone(options);const overlay={...input,read:p=>p===path?raw:input.read(p)};
 o.additions[0].source.inventory_sha256=digest(Object.fromEntries(input.paths(packet).map(p=>{const b=overlay.read(p);return[p.slice(packet.length+1),{bytes:b.length,sha256:sha(b)}];})));
 reject(()=>composeCurrentLibData(overlay,o));
}
for(const mutate of [v=>v.source_lineage.admitted_original_sources.at(-1).source.producer.driver_sha256='0'.repeat(64),v=>v.source_lineage.admitted_original_sources.at(-1).source.producer.original_receipt_bytes_verified=true,v=>v.index.packages.pop()]){const v=structuredClone(candidate);mutate(v);reject(()=>verifyCurrentCompositionCandidateData(input,options,v));}
console.log(JSON.stringify({accepted:true,prior_v1_bytes_and_lineage_identical:true,packages:43,apis:277,Core_Search_lookups:320,rejected,new_builds:0}));
