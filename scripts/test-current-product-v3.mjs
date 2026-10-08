import assert from 'node:assert/strict';
import {readFile,readdir,lstat,mkdir,mkdtemp,writeFile,symlink,unlink,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hash,verifyCurrentRelease,resolveCurrentPackage,currentProductReader,currentProductPaths} from './current-lib-release-v3.mjs';
import {installCurrentLib,artifactUrl} from './lib-install.mjs';
const args=process.argv.slice(2),opts={};
for(let i=0;i<args.length;i+=2){assert.ok(['--product','--catalog-sha256','--out'].includes(args[i])&&!opts[args[i]]&&args[i+1]);opts[args[i]]=args[i+1];}
assert.equal(Object.keys(opts).length,3);
const root=resolve(opts['--product']),out=resolve(opts['--out']);await mkdir(out,{recursive:true});
const data=new Map(),read=currentProductReader(root);
const catalogBytes=read('catalog/libs-current-v2.json'),catalogInput=JSON.parse(catalogBytes);
const required=new Set(['LICENSE',...currentProductPaths(root,'licenses'),'catalog/libs-current-v2.json',catalogInput.registry.path,catalogInput.index.path,catalogInput.cohort.path,...currentProductPaths(root)]);
for(const row of catalogInput.packages)for(const pin of Object.values(row.source))required.add(pin.path);
for(const path of required)data.set(path,read(path));
const original=data.get('catalog/libs-current-v2.json'),expected=opts['--catalog-sha256'];
assert.equal(hash(original),expected);const catalog=JSON.parse(original);const results=[];
const verify=(map=data,bytes=original,pin=expected)=>verifyCurrentRelease(bytes,pin,p=>{
  assert.ok(map.has(p),'file missing: '+p);return map.get(p);
},[...map.keys()]);
const pass=(name,fn)=>{fn();results.push({name,passed:true});};
const reject=(name,fn)=>{assert.throws(fn,undefined,name);results.push({name,passed:true,rejected:true});};
const closure=verify();assert.equal(closure.release_packages,42);assert.equal(closure.api_routes,236);assert.equal(closure.entries,278);
results.push({name:'real Core snapshot all278 lookups and full pagination',passed:true});
reject('independent catalog mismatch',()=>verify(data,original,'0'.repeat(64)));
for(const suffix of ['artifact.wasm','component.wasm','lib.wit','LICENSE','Cargo.toml']){
 const row=catalog.packages.find(r=>r.files.some(f=>f.path.endsWith('/'+suffix)));assert.ok(row,suffix);
 const map=new Map(data),path=row.files.find(f=>f.path.endsWith('/'+suffix)).path,b=Buffer.from(map.get(path));b[0]^=1;map.set(path,b);
 reject('actual modified '+suffix,()=>verify(map));
}
const alterCatalog=(name,mutate)=>{
 const c=structuredClone(catalog),map=new Map(data);mutate(c,map);
 const bytes=Buffer.from(JSON.stringify(c)+'\n');reject(name,()=>verify(map,bytes,hash(bytes)));
};
alterCatalog('missing current implementation',(c)=>c.packages.splice(0,1));
alterCatalog('duplicate implementation',(c)=>c.packages.splice(1,0,structuredClone(c.packages[0])));
alterCatalog('native-source cannot claim Wasm',(c)=>{const r=c.packages.find(r=>r.delivery.kind==='native-source');r.delivery.kind='wasm-core-component';});
alterCatalog('unsafe package path',(c)=>c.packages[0].root='../private');
alterCatalog('unsealed extra Root inventory',(c,map)=>{
 const row=c.packages[0],path=row.root+'/hidden.js',b=Buffer.from('extra');
 map.set(path,b);row.files.push({path,bytes:b.length,sha256:hash(b)});row.files.sort((a,b)=>a.path<b.path?-1:1);
});
alterCatalog('self-rehashed artifact fails Q0 root authority',(c,map)=>{
 const row=c.packages.find(r=>r.profile==='value'),path=row.root+'/artifact.wasm',b=Buffer.from(map.get(path));b[b.length-1]^=1;map.set(path,b);
 const f=row.files.find(f=>f.path===path);f.sha256=hash(b);
 const m=JSON.parse(map.get(row.root+'/lib.json'));m.artifact.sha256=f.sha256;
 const mb=Buffer.from(JSON.stringify(m)+'\n');map.set(row.root+'/lib.json',mb);
 Object.assign(row.files.find(f=>f.path===row.root+'/lib.json'),{bytes:mb.length,sha256:hash(mb)});
 row.manifest_sha256=hash(mb);
 row.root_inventory_sha256=hash(JSON.stringify(Object.fromEntries(row.files.map(f=>[f.path.slice(row.root.length+1),{bytes:f.bytes,sha256:f.sha256}]))));
 row.delivery.artifact.sha256=f.sha256;
});
alterCatalog('self-rehashed API omission fails WIT closure',(c,map)=>{
 const index=JSON.parse(map.get(c.index.path));index.packages[0].apis.pop();
 const b=Buffer.from(JSON.stringify(index)+'\n');map.set(c.index.path,b);c.index.bytes=b.length;c.index.sha256=hash(b);
});
alterCatalog('self-rehashed authored source fails Q0 input',(c,map)=>{
 const row=c.packages[0],p=row.source.spec,s=JSON.parse(map.get(p.path));s.version='99.0.0';
 const b=Buffer.from(JSON.stringify(s)+'\n');map.set(p.path,b);p.bytes=b.length;p.sha256=hash(b);
});
const mapExtra=new Map(data);mapExtra.set(catalog.packages[0].root+'/undeclared.bin',Buffer.from('x'));
reject('actual undeclared current file',()=>verify(mapExtra));
for(const row of [catalog.packages.find(r=>r.delivery.kind==='wasm-core-component'),
 catalog.packages.find(r=>r.delivery.kind==='native-source'),catalog.packages.find(r=>r.delivery.kind==='native-module'),
 catalog.packages.find(r=>r.delivery.kind==='native-binary')]){
 assert.ok(row);const request={id:row.id,version:row.version,manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256};
 const lock=resolveCurrentPackage(original,expected,request,p=>data.get(p)),bytes=Buffer.from(JSON.stringify(lock)+'\n');
 const lookup=new Map(row.files.map(f=>[artifactUrl('github',catalog.package_authority_commit,f.path),data.get(f.path)]));
 const fetcher=async url=>{assert.ok(lookup.has(url));return new Response(lookup.get(url),{status:200});};
 const destination=join(out,'success-'+row.delivery.kind);
 const receipt=await installCurrentLib({catalogBytes:original,catalogSha256:expected,lockBytes:bytes,lockSha256:hash(bytes),destination,mirror:'github'},fetcher);
 assert.equal(receipt.files_verified,row.files.length);assert.equal(receipt.delivery_kind,row.delivery.kind);assert.equal(receipt.device_qualified,false);
 for(const file of row.files)assert.equal(hash(await readFile(join(destination,file.path))),file.sha256);
 results.push({name:'controlled install '+row.delivery.kind,passed:true,transport_fixture:true});
 for(const [name,fault]of [
  ['http302',async()=>new Response('redirect',{status:302})],
  ['truncated',async url=>new Response(lookup.get(url).subarray(1),{status:200})],
  ['oversized',async url=>new Response(Buffer.concat([lookup.get(url),Buffer.from('x')]),{status:200})],
  ['digest',async url=>{const b=Buffer.from(lookup.get(url));b[0]^=1;return new Response(b,{status:200});}],
 ]){
  const target=join(out,'fail-'+row.delivery.kind+'-'+name);
  await assert.rejects(installCurrentLib({catalogBytes:original,catalogSha256:expected,lockBytes:bytes,lockSha256:hash(bytes),destination:target,mirror:'github'},fault));
  await assert.rejects(lstat(target),{code:'ENOENT'});
  assert.equal((await readdir(out)).some(p=>p.startsWith('.'+target.split('/').at(-1)+'.wasmc-')),false);
  results.push({name:'install '+row.delivery.kind+' rejects '+name,passed:true});
 }
 const changed={...lock,authority_granted:true},cb=Buffer.from(JSON.stringify(changed)+'\n');
 await assert.rejects(installCurrentLib({catalogBytes:original,catalogSha256:expected,lockBytes:cb,lockSha256:hash(cb),destination:join(out,'authority-'+row.delivery.kind),mirror:'github'},fetcher));
 results.push({name:'self-rehashed lock cannot grant authority '+row.delivery.kind,passed:true});
}
const selected=catalog.packages.find(r=>r.profile==='value'),file=selected.files.find(f=>f.path.endsWith('/lib.wit'));
const path=join(root,file.path),before=await readFile(path);await unlink(path);
await symlink(join(out,'linked-wit'),path);await writeFile(join(out,'linked-wit'),before);
try{reject('actual byte-identical linked input',()=>verifyCurrentRelease(original,expected,currentProductReader(root),currentProductPaths(root)));}
finally{await unlink(path);await writeFile(path,before);}
const extra=join(root,catalog.packages[0].root,'unselected-extra');await writeFile(extra,'extra');
try{reject('actual filesystem extra Root file',()=>verifyCurrentRelease(original,expected,currentProductReader(root),currentProductPaths(root)));}
finally{await unlink(extra);}
assert.equal(hash(await readFile(join(root,'catalog/libs-current-v2.json'))),expected);
verifyCurrentRelease(original,expected,currentProductReader(root),currentProductPaths(root));
const report={schema:'wasmc.current-product-v3-controls/v1',accepted:true,tests:results.length,
 catalog_sha256:expected,test_source_sha256:hash(await readFile(new URL(import.meta.url))),results,
 scope:'Actual42 data/WIT/Root/Core Search and four delivery kinds with controlled transport/faults; immutable public network install and whole release remain independent'};
await writeFile(join(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
