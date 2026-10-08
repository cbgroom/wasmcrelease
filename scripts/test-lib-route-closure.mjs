import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildClosure} from './lib-route-closure.mjs';
import {hash,verifyCurrentRelease,currentProductReader,currentProductPaths} from './current-lib-release-v3.mjs';
const root=new URL('../',import.meta.url).pathname;
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const catalogBytes=read('catalog/libs-current-v2.json'),catalog=JSON.parse(catalogBytes);
const pin='01fda278b3c74363643879f71cc739488a57e9d934f217ab07af3460b88923d4';
assert.equal(hash(catalogBytes),pin);
const model=buildClosure();
assert.equal(model.schema,'wasmc.lib-route-closure/v3');assert.equal(model.release_bindings.length,42);
assert.equal(model.search_index.api_routes,236);assert.equal(model.search_index.entries,278);
assert.deepEqual(model.candidate_extras,[]);assert.equal(model.claims.public_release_admission,false);
const verify=(bytes=catalogBytes,p=pin,overrides=new Map(),paths=currentProductPaths(root))=>verifyCurrentRelease(bytes,p,n=>overrides.has(n)?overrides.get(n):read(n),paths);
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
console.log(JSON.stringify({accepted:true,schema:model.schema,release_packages:42,package_routes:42,api_routes:236,entries:278,negative_tests:controls,public_release_admission:false}));
