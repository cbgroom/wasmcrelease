import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {all18Targets,needsFutureLibLicenseGate,validateFutureLibLicenses} from './future-lib-license-admission.mjs';
import {validateCandidate,futureLibProductInputs} from './release-candidate.mjs';
import {makeRouteFixture} from './test-future-current-route-fixture.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const ledger=JSON.parse(readFileSync(new URL('../catalog/current-v2-migration.json',import.meta.url)));
assert.deepEqual([...ledger.migrated,...ledger.backlog].map(x=>x.id).sort(),all18Targets);
for(const v of ['0.0.1','0.0.18','0.0.19','0.0.20'])assert.equal(needsFutureLibLicenseGate(v),false);
for(const v of ['0.0.21','0.1.0','1.0.0'])assert.equal(needsFutureLibLicenseGate(v),true);
function fixture(){
  const bytes=new Map(),packages=[];
  const put=(p,b)=>{b=Buffer.from(b);bytes.set(p,b);return {path:p,bytes:b.length,sha256:hash(b)};};
  for(const id of all18Targets){const root=`current-libs/${id}/9.0.0`,l=Buffer.from('Research grant.\n'),n=Buffer.from('Original third-party notice.\n'),files=[];
    const license={schema:'wasmc.lib-license/v1',identifier:'test-grant',files:[{path:'LICENSE',bytes:l.length,sha256:hash(l)},{path:'licenses/NOTICE.txt',bytes:n.length,sha256:hash(n)}]};
    for(const [p,b]of [['LICENSE',l],['licenses/NOTICE.txt',n],['bindings/rust/Cargo.toml','[package]\nname = "fixture"\nlicense-file = "../../LICENSE"\n'],['lib.json',JSON.stringify({schema:'wasmc.lib/v2',id,version:'9.0.0',license})]])files.push(put(`${root}/${p}`,b));
    packages.push({id,version:'9.0.0',root,files});
  }
  put('catalog/libs-current-v2.json',JSON.stringify({schema:'wasmc.public-lib-catalog/v1',packages}));
  const candidate={schema:'wasmc.release-product-candidate/v2',version:'0.0.21',compiler_source_authority:'a'.repeat(40),lib_source_authority:'b'.repeat(40)};
  const refresh=()=>{candidate.product_files=[...bytes].map(([path,b])=>({path,bytes:b.length,sha256:hash(b)})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);candidate.product_set_sha256=hash(JSON.stringify(candidate.product_files));};refresh();
  const json=p=>JSON.parse(bytes.get(p)),write=(p,v)=>bytes.set(p,Buffer.from(JSON.stringify(v)));
  return {candidate,bytes,packages,read:p=>{if(!bytes.has(p))throw Error('missing');return bytes.get(p);},refresh,json,write};
}
const positive=fixture(),receipt=validateFutureLibLicenses(positive.candidate,positive.read);
assert.equal(receipt.targets.length,18);assert.equal(receipt.all18_explicit_snapshots,true);assert.equal(receipt.legal_compatibility,false);assert.equal(receipt.dependency_notice_completeness,false);
let negative=0;
const reject=(mutate,rebind=true)=>{const f=fixture();mutate(f);if(rebind){const c=f.json('catalog/libs-current-v2.json');for(const p of c.packages)for(const x of p.files){const b=f.bytes.get(x.path);if(b){x.bytes=b.length;x.sha256=hash(b);}}f.write('catalog/libs-current-v2.json',c);}f.refresh();assert.throws(()=>validateFutureLibLicenses(f.candidate,f.read),/future Lib license admission/);negative++;};
const catalog='catalog/libs-current-v2.json',manifest=f=>`${f.packages[0].root}/lib.json`;
reject(f=>{const c=f.json(catalog);c.packages.pop();f.write(catalog,c);});
reject(f=>{const c=f.json(catalog);c.packages[0].id='substituted';f.write(catalog,c);});
reject(f=>{const c=f.json(catalog);c.packages[1]=c.packages[0];f.write(catalog,c);});
reject(f=>{f.bytes.delete(manifest(f));});
reject(f=>{const m=f.json(manifest(f));delete m.license;f.write(manifest(f),m);});
reject(f=>{const m=f.json(manifest(f));m.license.files=[];f.write(manifest(f),m);});
reject(f=>{f.bytes.delete(`${f.packages[0].root}/LICENSE`);});
reject(f=>{f.bytes.set(`${f.packages[0].root}/licenses/NOTICE.txt`,Buffer.from('changed'));});
reject(f=>{f.bytes.set(`${f.packages[0].root}/bindings/rust/Cargo.toml`,Buffer.from('[package]\nlicense = "MIT"\n'));});
reject(f=>{const c=f.json(catalog);c.packages[0].files=c.packages[0].files.filter(x=>!x.path.endsWith('/LICENSE'));f.write(catalog,c);});
reject(f=>{const c=f.json(catalog);c.packages[0].files[0].sha256='0'.repeat(64);f.write(catalog,c);},false);
reject(f=>{const m=f.json(manifest(f));m.license.files[0].path='../LICENSE';f.write(manifest(f),m);});
reject(f=>{const m=f.json(manifest(f));m.license.files[0].bytes=262145;f.write(manifest(f),m);});
reject(f=>{const m=f.json(manifest(f));m.license.files.push(m.license.files[0]);f.write(manifest(f),m);});
reject(f=>{const m=f.json(manifest(f));m.bindings={rust_core:{cargo_toml:{path:'bindings/rust/Cargo.toml',sha256:'0'.repeat(64)}}};f.write(manifest(f),m);});
reject(f=>{const m=f.json(manifest(f));m.bindings={rust_core:{cargo_toml:{path:'bindings/rust/Cargo.toml',sha256:'0'.repeat(64)}}};f.write(manifest(f),m);const p=`${f.packages[0].root}/bindings/rust/Cargo.toml`;f.bytes.delete(p);const c=f.json(catalog);c.packages[0].files=c.packages[0].files.filter(x=>x.path!==p);f.write(catalog,c);});
// Keep catalog and product hashes aligned to isolate invalid text rejection.
reject(f=>{const p=`${f.packages[0].root}/LICENSE`,b=Buffer.from([0]),m=f.json(manifest(f));m.license.files[0]={path:'LICENSE',bytes:1,sha256:hash(b)};f.write(manifest(f),m);f.bytes.set(p,b);const c=f.json(catalog);for(const x of c.packages[0].files){const v=f.bytes.get(x.path);x.bytes=v.length;x.sha256=hash(v);}f.write(catalog,c);});
positive.candidate.lib_license_admission=receipt;
positive.candidate.lib_route_closure={schema:'wasmc.release-candidate-lib-route-closure/v1',authority_receipt:{path:'receipt.json',sha256:'a'.repeat(64)},catalog:{path:catalog,sha256:'a'.repeat(64)},search_index:{path:'index.lsi',sha256:'a'.repeat(64)},release_packages:18,package_routes:18,api_routes:1,candidate_extras:0,exact:true,candidate_extra_grants_release:false};
// This remains a structural license fixture. Candidate-level validation also
// requires its actual public delivery inputs; it does not qualify their behavior.
for(const path of futureLibProductInputs(positive.candidate.version))if(!positive.bytes.has(path))positive.bytes.set(path,readFileSync(new URL('../'+path,import.meta.url)));
positive.refresh();
// License-only structural success cannot stand in for a current-route authority.
assert.throws(()=>validateCandidate(positive.candidate,positive.read),/current-route authority pin required/);negative++;
const complete=makeRouteFixture();
assert.equal(validateCandidate(complete.candidate,complete.read),true);
complete.candidate.lib_license_admission.targets[0].manifest_sha256='0'.repeat(64);
assert.throws(()=>validateCandidate(complete.candidate,complete.read),/license receipt rejected/);negative++;
console.log(JSON.stringify({accepted:true,targets:18,negative_controls:negative,scope:'structural license/catalog/product/SDK binding only; no legal, notice completeness, runtime or public release claim'}));
