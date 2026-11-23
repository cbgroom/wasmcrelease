import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildClosure} from './lib-route-closure.mjs';
import {hash,verifyCurrentRelease,pinnedCurrentCatalog,currentProductPaths} from './current-lib-release-v3.mjs';
import {verifyPublicJsonOverlayPinned} from './json-overlay-public-v1.mjs';
const root=new URL('../',import.meta.url).pathname;
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const catalogBytes=read('catalog/libs-current-v2.json');
const {catalog,sha256:pin}=pinnedCurrentCatalog(catalogBytes);
const overlay=catalog.version==='0.0.31';
const model=buildClosure();
assert.equal(model.schema,'wasmc.lib-route-closure/v3');assert.equal(model.release_bindings.length,43);
assert.equal(model.search_index.api_routes,overlay?289:277);assert.equal(model.search_index.entries,overlay?332:320);
assert.deepEqual(model.candidate_extras,[]);assert.equal(model.claims.public_release_admission,false);
const verifier=overlay?verifyPublicJsonOverlayPinned:verifyCurrentRelease;
const verify=(bytes=catalogBytes,p=pin,overrides=new Map(),paths=currentProductPaths(root))=>{
 const readFixture=name=>name==='catalog/libs-current-v2.json'?bytes:overrides.has(name)?overrides.get(name):read(name);
 return verifier(bytes,p,readFixture,paths);
};
let controls=0;
const reject=(name,fn)=>{assert.throws(fn,undefined,name);controls++;};
reject('independent catalog mismatch',()=>verify(catalogBytes,'0'.repeat(64)));
const alter=(name,change)=>{const c=structuredClone(catalog);change(c);const b=Buffer.from(JSON.stringify(c)+'\n');reject(name,()=>verify(b,hash(b)));};
alter('missing whole current package',c=>c.packages.shift());
for(const [name,change] of [
  ['missing indexed package',i=>i.packages.shift()],
  ['missing indexed API',i=>i.packages.find(p=>p.apis.length).apis.pop()],
  ['extra indexed API',i=>i.packages.find(p=>p.apis.length).apis.push({...i.packages.find(p=>p.apis.length).apis[0],route:'unknown#extra'})]
]){
  const c=structuredClone(catalog),i=JSON.parse(read(c.index.path));change(i);const b=Buffer.from(JSON.stringify(i)+'\n');
  c.index.bytes=b.length;c.index.sha256=hash(b);const cb=Buffer.from(JSON.stringify(c)+'\n');
  reject(name,()=>verify(cb,hash(cb),new Map([[c.index.path,b]])));
}
const row=catalog.packages[0],path=row.root+'/lib.wit',b=Buffer.from(read(path));b[0]^=1;
reject('actual selected WIT mutation',()=>verify(catalogBytes,pin,new Map([[path,b]])));
console.log(JSON.stringify({accepted:true,schema:model.schema,release_packages:43,package_routes:43,api_routes:model.search_index.api_routes,entries:model.search_index.entries,negative_tests:controls,public_release_admission:false}));
