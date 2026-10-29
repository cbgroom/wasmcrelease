import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentProductPaths,currentProductReader,checkedCurrentCatalog,resolveCurrentPackage} from './current-lib-release-v3.mjs';
import {verifyMixedFromCatalog} from './mixed-current-product-v1.mjs';
import {verify as verifyQ0} from './resident-portable-q0-v1.mjs';
import {currentIndex} from './lib-current-index-v2.mjs';
import {projectResidentIndex} from './project-resident-search-index-v1.mjs';
import {CurrentSearchCaller,currentIndexEntries} from './current-lib-search-v3.mjs';
import {sha,verifyRoot,digest,inside} from './lib-refresh-cache-v2.mjs';
const serialize=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const descriptor=(path,b)=>({path,bytes:b.length,sha256:sha(b)});
async function put(root,path,b){const dst=inside(root,path);await mkdir(dirname(dst),{recursive:true});await writeFile(dst,b,{flag:'wx'});}
const pinRead=(read,pin)=>{const b=read(pin.path);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256);return b;};
async function derive(oldRoot,oldSha,capsule,receiptSha,witPath,witSha){
 const read=currentProductReader(oldRoot),oldBytes=read('catalog/libs-current-v2.json');verifyMixedFromCatalog(oldBytes,oldSha,read,currentProductPaths(oldRoot));
 const old=JSON.parse(oldBytes),q0=await verifyQ0({capsule,receiptSha,witPath,witSha});
 const receipt=JSON.parse(await readFile(join(capsule,'receipt.json'))),r=receipt.rows[0],root=await verifyRoot(join(capsule,'root'),r.id,r.version,r.profile);
 const prev=old.packages.find(p=>p.id===r.id);assert.ok(prev);const prefix='current-libs/'+r.id+'/'+r.version;
 const source={};for(const [key,name] of [['spec','lib.json'],['wit','lib.wit']]){const path='libspec/'+r.id+'/'+name,b=await readFile(join(capsule,'source',path));source[key]=descriptor(path,b);}
 const copy=x=>({path:x.path,bytes:x.bytes,sha256:x.sha256});
 const resident={...prev,version:r.version,root:prefix,manifest_sha256:r.manifest_sha256,root_inventory_sha256:r.root_inventory_sha256,
  wit_sha256:root.manifest.wit.sha256,source,views:Object.keys(root.manifest.bindings).sort(),
  delivery:{kind:'wasm-core-component',artifact:copy(root.manifest.artifact),component:copy(root.manifest.component),native_status:null,device_qualified:false},
  files:Object.entries(root.files).map(([path,pin])=>({path:prefix+'/'+path,...pin}))};
 const packages=old.packages.map(p=>p.id===r.id?resident:p);
 const fresh=await currentIndex(join(capsule,'source'),[]),item=fresh.index.packages.find(p=>p.package_id===r.id);assert.ok(item);
 item.delivery={manifest_sha256:r.manifest_sha256,receipt_sha256:receiptSha,artifact_kind:'wasm-core-component',
  artifact_path:root.manifest.artifact.path,artifact_sha256:root.manifest.artifact.sha256,component_sha256:root.manifest.component.sha256};
 const projection=projectResidentIndex(JSON.parse(pinRead(read,old.index)),fresh.index,receiptSha);assert.equal(projection.reused,packages.length-1);
 return {read,old,packages,resident,index:projection.index,q0};
}
export async function assemble({oldRoot,oldSha,capsule,receiptSha,witPath,witSha,out,commit,version}){
 for(const p of [oldRoot,capsule,witPath,out])assert.ok(isAbsolute(p));assert.match(commit,/^[0-9a-f]{40}$/);assert.match(version,/^\d+\.\d+\.\d+$/);
 const d=await derive(oldRoot,oldSha,capsule,receiptSha,witPath,witSha);await mkdir(out);
 await mkdir(join(out,'proof'),{recursive:true});
 await cp(oldRoot,join(out,'proof/old-product'),{recursive:true,mode:constants.COPYFILE_FICLONE,errorOnExist:true,force:false});
 await cp(capsule,join(out,'proof/resident-q0'),{recursive:true,mode:constants.COPYFILE_FICLONE,errorOnExist:true,force:false});
 await put(out,d.old.registry.path,d.read(d.old.registry.path));
 for(const row of d.packages){
  for(const p of Object.values(row.source))await put(out,p.path,await readFile(join(capsule,'source',p.path)));
  for(const f of row.files){const bytes=row.id===d.resident.id?await readFile(join(capsule,'root',f.path.slice(row.root.length+1))):d.read(f.path);await put(out,f.path,bytes);}
 }
 const indexPath='catalog/current-index-v2.json',indexBytes=Buffer.from(JSON.stringify(d.index)+'\n');await put(out,indexPath,indexBytes);
 const cohortPath='admission/resident-overlay-cohort-v1.json',cohortBytes=serialize({schema:'wasmc.resident-overlay-cohort/v1',old_catalog_sha256:oldSha,resident_receipt_sha256:receiptSha,public_admission:false});await put(out,cohortPath,cohortBytes);
 const catalogBytes=serialize({schema:'wasmc.public-lib-catalog/v2',version,package_authority_commit:commit,registry:d.old.registry,index:descriptor(indexPath,indexBytes),cohort:descriptor(cohortPath,cohortBytes),packages:d.packages});await put(out,'catalog/libs-current-v2.json',catalogBytes);
 return verify({root:out,catalogSha:sha(catalogBytes),oldSha,receiptSha,witPath,witSha,commit});
}
export async function verify({root,catalogSha,oldSha,receiptSha,witPath,witSha,commit}){
 for(const p of [root,witPath])assert.ok(isAbsolute(p));for(const p of [catalogSha,oldSha,receiptSha,witSha])assert.match(p,/^[0-9a-f]{64}$/);assert.match(commit,/^[0-9a-f]{40}$/);
 const read=currentProductReader(root),catalogBytes=read('catalog/libs-current-v2.json'),catalog=checkedCurrentCatalog(catalogBytes,catalogSha);
 assert.equal(catalog.package_authority_commit,commit);const cohort=JSON.parse(pinRead(read,catalog.cohort));assert.deepEqual(cohort,{schema:'wasmc.resident-overlay-cohort/v1',old_catalog_sha256:oldSha,resident_receipt_sha256:receiptSha,public_admission:false});
 const d=await derive(join(root,'proof/old-product'),oldSha,join(root,'proof/resident-q0'),receiptSha,witPath,witSha);
 assert.deepEqual(catalog.registry,d.old.registry);pinRead(read,catalog.registry);assert.deepEqual(catalog.packages,d.packages);
 const expectedIndex=Buffer.from(JSON.stringify(d.index)+'\n');assert.deepEqual(pinRead(read,catalog.index),expectedIndex);
 const all=[];for(const row of catalog.packages){for(const file of row.files){const b=pinRead(read,file);const original=row.id===d.resident.id?await readFile(join(root,'proof/resident-q0/root',file.path.slice(row.root.length+1))):d.read(file.path);assert.deepEqual(b,original);all.push(file.path);}
  for(const p of Object.values(row.source)){const b=pinRead(read,p);assert.deepEqual(b,await readFile(join(root,'proof/resident-q0/source',p.path)));}}
 assert.deepEqual(currentProductPaths(root).sort(),all.sort(),'selected Root inventory');
 const entries=currentIndexEntries(d.index),search=catalog.packages.find(x=>x.id==='wasmc-lib-search'),caller=new CurrentSearchCaller(expectedIndex,read(search.root+'/artifact.wasm'),read(search.root+'/core-abi.json'));
 assert.deepEqual(caller.snapshot(),{tag:'ok',value:{entry_count:entries.length,package_count:catalog.packages.length,api_count:entries.length-catalog.packages.length,bound_package_count:catalog.packages.length,registry_sha256:catalog.registry.sha256,index_sha256:sha(expectedIndex)}});
 for(const entry of entries)assert.deepEqual(caller.lookup(entry.identity),{tag:'ok',value:entry});
 const pages=[];for(let i=0;i<entries.length;i+=64){const page=caller.search({text:'',package_id:null,profile:null,bound_only:false},i,64);assert.equal(page.tag,'ok');pages.push(...page.value);}assert.deepEqual(pages,entries);
 for(const row of catalog.packages){const lock=resolveCurrentPackage(catalogBytes,catalogSha,row,read);assert.equal(lock.files.length,row.files.length);}
 return {schema:'wasmc.resident-overlay-verification/v1',accepted:true,catalog_sha256:catalogSha,old_catalog_sha256:oldSha,resident_receipt_sha256:receiptSha,authority_commit:commit,index_sha256:sha(expectedIndex),packages:catalog.packages.length,root_files:all.length,entries:entries.length,all_package_locks_verified:true,old_product_closure_verified:true,resident_q0_verified:true,search_snapshot_lookup_pagination:true,public_admission:false,scope:'local candidate proof graph; Git commit contents, CI, production route, release and anonymous install require separate verification'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,...a]=process.argv.slice(2);
 if(mode==='assemble'){const [oldRoot,oldSha,capsule,receiptSha,witPath,witSha,out,commit,version]=a;console.log(JSON.stringify(await assemble({oldRoot,oldSha,capsule,receiptSha,witPath,witSha,out,commit,version})));}
 else if(mode==='verify'){const [root,catalogSha,oldSha,receiptSha,witPath,witSha,commit]=a;console.log(JSON.stringify(await verify({root,catalogSha,oldSha,receiptSha,witPath,witSha,commit})));}
 else throw Error('expected assemble or verify');
}
