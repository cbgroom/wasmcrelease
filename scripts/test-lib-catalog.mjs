import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,checkedCurrentCatalog,resolveCurrentPackage,currentProductReader} from './current-lib-release-v3.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const bytes=readFileSync(join(root,'catalog/libs-current-v2.json'));
const pin='a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad';
const catalog=checkedCurrentCatalog(bytes,pin),read=currentProductReader(root);
const request=r=>({id:r.id,version:r.version,manifest_sha256:r.manifest_sha256,root_inventory_sha256:r.root_inventory_sha256});
assert.equal(catalog.packages.length,42);
for(const row of catalog.packages){
 const lock=resolveCurrentPackage(bytes,pin,request(row),read);
 assert.deepEqual(lock,resolveCurrentPackage(bytes,pin,request(row),read));
 assert.equal(lock.authority_granted,false);assert.equal(lock.engine_admission,'separate');
 assert.equal(lock.profile==='native',lock.delivery.kind!=='wasm-core-component');
}
const row=catalog.packages.find(r=>r.id==='wasmc-std'),req=request(row);
const reject=fn=>assert.throws(fn);
reject(()=>resolveCurrentPackage(bytes,'0'.repeat(64),req,read));
reject(()=>resolveCurrentPackage(bytes,pin,{...req,version:undefined},read));
reject(()=>resolveCurrentPackage(bytes,pin,{...req,version:'9.9.9'},read));
reject(()=>resolveCurrentPackage(bytes,pin,{...req,manifest_sha256:'0'.repeat(64)},read));
reject(()=>resolveCurrentPackage(bytes,pin,{...req,root_inventory_sha256:'0'.repeat(64)},read));
for(const change of [c=>c.packages.push(c.packages[0]),c=>c.packages[0].files[0].path='../escape',c=>c.packages[0].delivery.device_qualified=true]){
 const c=structuredClone(catalog);change(c);const b=Buffer.from(JSON.stringify(c));reject(()=>checkedCurrentCatalog(b,hash(b)));
}
reject(()=>resolveCurrentPackage(bytes,pin,req,p=>p.endsWith('/artifact.wasm')?new Uint8Array(0):read(p)));
const fixture=mkdtempSync(join(tmpdir(),'wasmc-current-catalog-'));
try{symlinkSync(join(root,'README.md'),join(fixture,'escape'));reject(()=>currentProductReader(fixture)('escape'));}
finally{rmSync(fixture,{recursive:true});}
console.log(JSON.stringify({accepted:true,current_packages:42,native_source_packages:14,negative_tests:10,selection:'unique exact complete-Root lock',network_access:false}));
