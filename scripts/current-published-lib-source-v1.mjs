// Reuse a formally published complete Root. Do not invent a missing historical
// producer executable identity or relabel this import as a new build/full Q0.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex'),digest=v=>hash(JSON.stringify(v));
const json=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));
const exact=(v,ks)=>assert.deepEqual(Object.keys(v).sort(),ks.sort(),'closed published source schema');
const safe=p=>{assert.ok(typeof p==='string'&&p&&!p.startsWith('/')&&!p.includes('\\')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'));return p;};
const pin=(p,b)=>({path:p,bytes:b.length,sha256:hash(b)});
export function publishedProducerCustody(input,expected,files,manifest){
 const s=expected.source;exact(s,['schema','root','inventory_sha256','source_spec','logic','cargo_manifest','cargo_lock','wit','build_report','publication','authority']);
 assert.equal(s.schema,'wasmc.published-lib-source-input/v1');safe(s.root);
 const packet={};for(const p of input.paths(s.root)){safe(p);assert.ok(p.startsWith(s.root+'/'));const b=input.read(p);packet[p.slice(s.root.length+1)]={bytes:b.length,sha256:hash(b)};}
 assert.equal(digest(packet),s.inventory_sha256,'independent complete published-source packet');
 const get=p=>{safe(p);assert.ok(packet[p]);const b=input.read(s.root+'/'+p);assert.deepEqual({bytes:b.length,sha256:hash(b)},packet[p]);return b;};
 exact(s.authority,['publication_sha256','canonical_source_commit','canonical_source_blob','build_report_sha256']);
 const publicationBytes=get(s.publication);assert.equal(hash(publicationBytes),s.authority.publication_sha256);
 const pub=json(publicationBytes);assert.equal(pub.schema,'wasmc.published-lib-source-custody/v1');
 assert.equal(pub.accepted,true);assert.equal(pub.draft,false);assert.ok(pub.published_at);
 assert.match(pub.repository,/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);assert.match(pub.commit,/^[a-f0-9]{40}$/);assert.match(pub.tag_object,/^[a-f0-9]{40}$/);
 assert.equal(pub.id,expected.id);assert.equal(pub.version,expected.version);assert.equal(pub.root_manifest_sha256,expected.manifest_sha256);
 assert.equal(pub.root_inventory_sha256,expected.root_inventory_sha256);assert.equal(pub.actual_root_files_verified,Object.keys(files).length);
 assert.equal(pub.anonymous_root_download_verified,true);assert.equal(pub.immutable_Git_root_verified,true);
 assert.equal(pub.root_asset.sha256,pub.actual_root_archive_sha256);assert.ok(Number.isSafeInteger(pub.root_asset.bytes)&&pub.root_asset.bytes>0);
 assert.equal(pub.root_asset.url,'https://github.com/'+pub.repository+'/releases/download/'+pub.tag+'/'+pub.root_asset.name);
 const specBytes=get(s.source_spec),spec=json(specBytes),canonical=pub.canonical_source;
 assert.equal(spec.schema,'wasmc.lib-build/v0');assert.equal(spec.skill.name,expected.id);assert.equal(spec.skill.version,expected.version);
 assert.equal(canonical.source_commit,s.authority.canonical_source_commit);assert.equal(canonical.git_blob,s.authority.canonical_source_blob);
 assert.match(canonical.source_commit,/^[a-f0-9]{40}$/);assert.equal(canonical.sha256,hash(specBytes));assert.equal(canonical.bytes,specBytes.length);safe(canonical.path);
 assert.equal(createHash('sha1').update('blob '+specBytes.length+'\0').update(specBytes).digest('hex'),canonical.git_blob);
 const reportBytes=get(s.build_report);assert.equal(hash(reportBytes),s.authority.build_report_sha256);const report=json(reportBytes);
 assert.equal(report.schema,'wasmc.lib-build-receipt/v0');assert.equal(report.accepted,true);assert.equal(report.package,expected.id);assert.equal(report.version,expected.version);
 assert.equal(report.manifest_sha256,expected.manifest_sha256);assert.deepEqual(report.toolchain,manifest.build.toolchain);
 for(const k of ['artifact','component','core_abi'])assert.deepEqual(report[k],files[manifest[k].path]);
 assert.equal(report.generated_source_sha256,hash(get(s.logic)),'original generated Rust source');
 assert.equal(hash(get(s.wit)),files['lib.wit'].sha256);assert.equal(spec.wit,s.wit);
 const cargo=new TextDecoder().decode(get(s.cargo_manifest));assert.ok(cargo.includes('name = '+JSON.stringify(spec.rust.artifact_name.replaceAll('_','-'))));assert.ok(cargo.includes('version = '+JSON.stringify(expected.version)));
 assert.ok(manifest.build.inputs.some(r=>r.kind==='cargo-lock'&&r.path===spec.rust.crate_dir+'/Cargo.lock'&&r.sha256===hash(get(s.cargo_lock))));
 return {spec,report,publication:pub,packet,proof:{kind:'imported-published-root',source_root:s.root,source_inventory_sha256:s.inventory_sha256,publication_sha256:s.authority.publication_sha256,public_commit:pub.commit,public_tag:pub.tag,root_manifest_sha256:expected.manifest_sha256,original_producer_executable_verified:false,fresh_build_performed:false}};
}
export function buildPublishedSource(input,expected){
 const s=expected.source,root={};for(const p of input.paths(expected.root)){const b=input.read(p);root[p.slice(expected.root.length+1)]={bytes:b.length,sha256:hash(b)};}
 assert.equal(digest(root),expected.root_inventory_sha256);const manifest=json(input.read(expected.root+'/lib.json'));const c=publishedProducerCustody(input,expected,root,manifest);
 const desc=p=>pin(p,input.read(p));
 return {schema:'wasmc.current-published-producer-source/v1',id:expected.id,version:expected.version,profile:expected.profile,world:manifest.wit.world,description:c.spec.skill.description,apis:c.spec.apis,
 source_spec:desc(s.root+'/'+s.source_spec),source_packet:{root:s.root,inventory_sha256:s.inventory_sha256,files:Object.entries(c.packet).map(([p,v])=>({path:s.root+'/'+p,...v}))},canonical_source:c.publication.canonical_source,
 publication:{custody:desc(s.root+'/'+s.publication),repository:c.publication.repository,tag:c.publication.tag,commit:c.publication.commit},
 producer:{report:desc(s.root+'/'+s.build_report),driver_sha256:null,observed_build_source:c.publication.canonical_source.source_commit,original_receipt_sha256:null,original_receipt_bytes_verified:false,original_driver_identity_verified:false},
 root:{locator:expected.root,manifest_sha256:expected.manifest_sha256,inventory_sha256:expected.root_inventory_sha256,files:Object.entries(root).map(([p,v])=>({path:expected.root+'/'+p,...v}))},wit:desc(s.root+'/'+s.wit),source_mode:'already-published-complete-root',fresh_build_performed:false,fresh_full_q0:false};
}
