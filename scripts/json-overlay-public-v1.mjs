// Public-byte projection verification. Private Q0/producer qualification is a
// separate prerequisite and is deliberately neither imported nor distributed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkedCurrentCatalog,resolveCurrentPackage} from './current-lib-release-v3.mjs';
import {CurrentSearchCaller,currentIndexEntries} from './current-lib-search-v3.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const parse=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));
const pinned=(pin,read)=>{const b=read(pin.path);assert.equal(b.length,pin.bytes,'pinned byte count');assert.equal(hash(b),pin.sha256,'pinned digest');return b;};
const inventory=row=>Object.fromEntries(row.files.map(f=>[f.path.slice(row.root.length+1),{bytes:f.bytes,sha256:f.sha256}]));
const normalizedIndex=p=>{const{version,wit_sha256,wit_route,delivery,...rest}=p;return rest;};
const fixedRow=p=>{const{version,root,manifest_sha256,root_inventory_sha256,wit_sha256,source,views,delivery,files,...rest}=p;return rest;};
export function verifyPublicJsonOverlay({catalogBytes,catalogSha,priorCatalogBytes,priorCatalogSha,priorIndexBytes,read,productPaths,receiptSha,authorityCommit}){
  assert.match(receiptSha,/^[a-f0-9]{64}$/);assert.match(authorityCommit,/^[a-f0-9]{40}$/);
  const catalog=checkedCurrentCatalog(catalogBytes,catalogSha), prior=checkedCurrentCatalog(priorCatalogBytes,priorCatalogSha);
  assert.equal(catalog.package_authority_commit,authorityCommit,'independent artifact authority');
  assert.deepEqual(read('catalog/libs-current-v2.json'),catalogBytes,'current catalog bytes');
  const cohort=parse(pinned(catalog.cohort,read));assert.deepEqual(cohort,{schema:'wasmc.json-overlay-cohort/v1',old_catalog_sha256:priorCatalogSha,json_receipt_sha256:receiptSha,public_admission:false});
  assert.deepEqual(catalog.registry,prior.registry,'registry retained');pinned(catalog.registry,read);
  assert.equal(priorIndexBytes.length,prior.index.bytes);assert.equal(hash(priorIndexBytes),prior.index.sha256,'independent previous index pin');
  const previous=new Map(prior.packages.map(row=>[row.id,row]));assert.equal(previous.size,catalog.packages.length);
  for(const row of catalog.packages){const old=previous.get(row.id);assert.ok(old,'package not in previous catalog');
    if(row.id==='wasmc-json'){assert.equal(old.version,'0.2.1');assert.equal(row.version,'0.2.2');assert.deepEqual(fixedRow(row),fixedRow(old),'JSON fixed metadata drift');}
    else assert.deepEqual(row,old,'unchanged package row drift: '+row.id);
  }
  const indexBytes=pinned(catalog.index,read),index=parse(indexBytes),oldIndex=parse(priorIndexBytes);
  assert.equal(index.schema,'wasmc.current-lib-search-index/v2');assert.equal(oldIndex.schema,index.schema);
  assert.equal(index.registry_sha256,catalog.registry.sha256);assert.equal(oldIndex.registry_sha256,prior.registry.sha256);
  const oldItems=new Map(oldIndex.packages.map(p=>[p.package_id,p]));assert.equal(oldItems.size,index.packages.length);
  assert.deepEqual(index.packages.map(p=>p.package_id).sort(),catalog.packages.map(p=>p.id).sort(),'index and catalog identities');
  assert.deepEqual(oldIndex.packages.map(p=>p.package_id).sort(),prior.packages.map(p=>p.id).sort(),'previous index and catalog identities');
  for(const p of index.packages){const old=oldItems.get(p.package_id);assert.ok(old,'index package not in previous');
    if(p.package_id==='wasmc-json'){const row=catalog.packages.find(x=>x.id===p.package_id);assert.equal(old.version,'0.2.1');assert.equal(p.version,row.version);assert.equal(p.wit_sha256,row.wit_sha256);assert.equal(p.wit_route,'wasmc:json@'+row.version);assert.deepEqual(normalizedIndex(p),normalizedIndex(old),'JSON API projection drift');
      assert.deepEqual(p.delivery,{manifest_sha256:row.manifest_sha256,receipt_sha256:receiptSha,artifact_kind:row.delivery.kind,artifact_path:row.delivery.artifact.path,artifact_sha256:row.delivery.artifact.sha256,component_sha256:row.delivery.component.sha256});
    }else assert.deepEqual(p,old,'unchanged index entry drift: '+p.package_id);
  }
  const paths=[];
  for(const row of catalog.packages){
    const lock=resolveCurrentPackage(catalogBytes,catalogSha,row,read);assert.equal(lock.files.length,row.files.length);
    const files=inventory(row);assert.equal(hash(Buffer.from(JSON.stringify(files))),row.root_inventory_sha256,'Root inventory identity');
    const manifestBytes=read(row.root+'/lib.json');assert.equal(hash(manifestBytes),row.manifest_sha256);const manifest=parse(manifestBytes);
    assert.equal(manifest.id,row.id);assert.equal(manifest.version,row.version);assert.equal(manifest.wit.sha256,row.wit_sha256);if(row.profile!=='native'||manifest.wit.world!==undefined)assert.equal(manifest.wit.world,row.wit_world);
    for(const pin of Object.values(row.source))pinned(pin,read);
    if(row.id==='wasmc-json'){
      const spec=parse(pinned(row.source.spec,read));assert.equal(spec.id,row.id);assert.equal(spec.version,row.version);assert.equal(spec.profile,row.profile);
      assert.deepEqual(pinned(row.source.wit,read),read(row.root+'/lib.wit'),'JSON source and Root WIT');
      assert.deepEqual(Object.keys(manifest.bindings).sort(),row.views);
      for(const [field,pin] of [['artifact',row.delivery.artifact],['component',row.delivery.component]]){
        const descriptor=manifest[field];assert.equal(descriptor.path,pin.path);assert.equal(descriptor.bytes,pin.bytes);assert.equal(descriptor.sha256,pin.sha256);
        assert.deepEqual(files[pin.path],{bytes:pin.bytes,sha256:pin.sha256});
      }
    }
    for(const f of row.files)paths.push(f.path);
  }
  assert.ok(Array.isArray(productPaths),'independent Root inventory required');assert.deepEqual([...productPaths].sort(),paths.sort(),'complete Root inventory');
  const entries=currentIndexEntries(index),search=catalog.packages.find(p=>p.id==='wasmc-lib-search');assert.ok(search);
  const caller=new CurrentSearchCaller(indexBytes,read(search.root+'/artifact.wasm'),read(search.root+'/core-abi.json'));
  assert.deepEqual(caller.snapshot(),{tag:'ok',value:{entry_count:entries.length,package_count:catalog.packages.length,api_count:entries.length-catalog.packages.length,bound_package_count:catalog.packages.length,registry_sha256:catalog.registry.sha256,index_sha256:hash(indexBytes)}});
  for(const entry of entries)assert.deepEqual(caller.lookup(entry.identity),{tag:'ok',value:entry});
  const pages=[];for(let i=0;i<entries.length;i+=64){const page=caller.search({text:'',package_id:null,profile:null,bound_only:false},i,64);assert.equal(page.tag,'ok');pages.push(...page.value);}assert.deepEqual(pages,entries);
  return {schema:'wasmc.public-json-overlay-projection/v1',accepted:true,catalog_sha256:catalogSha,prior_catalog_sha256:priorCatalogSha,receipt_sha256:receiptSha,authority_commit:authorityCommit,packages:catalog.packages.length,root_files:paths.length,index_entries:entries.length,private_provenance_verified:false,release:false};
}
