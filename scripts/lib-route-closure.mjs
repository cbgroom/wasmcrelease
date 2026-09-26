#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCatalog } from './lib-catalog.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const outputPath='catalog/lib-route-closure.json';
const defaultReceipt='admission/lib-search-v020-v014-admission.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFileSync(resolve(root,path));
const json=path=>JSON.parse(read(path));
const fail=code=>{throw Object.assign(new Error(code),{code});};
const exact=(actual,expected,code)=>{
  if(JSON.stringify([...actual].sort())!==JSON.stringify([...expected].sort()))fail(code);
};
const clean=name=>name.startsWith('%')?name.slice(1):name;

function blocks(text,kind){
  const rows=[];
  const pattern=new RegExp(`\\b${kind}\\s+(%?[A-Za-z][A-Za-z0-9-]*)\\s*\\{`,'g');
  for(let match; (match=pattern.exec(text)); ){
    const open=text.indexOf('{',match.index),name=clean(match[1]);
    let depth=1,index=open+1;
    for(;index<text.length&&depth;index++){
      if(text[index]==='{')depth++;
      else if(text[index]==='}')depth--;
    }
    if(depth)fail('route.wit_unbalanced');
    rows.push({name,body:text.slice(open+1,index-1)});
    pattern.lastIndex=index;
  }
  return rows;
}

function topLevel(text){
  let depth=0,out='';
  for(const char of text){
    if(char==='{'){depth++;out+=' ';}
    else if(char==='}'){depth--;if(depth<0)fail('route.wit_unbalanced');out+=' ';}
    else out+=depth?' ':char;
  }
  if(depth)fail('route.wit_unbalanced');
  return out;
}

export function parseWitRoutes(bytes){
  const text=Buffer.from(bytes).toString('utf8').replace(/\/\/[^\n]*/g,' ');
  const packageMatch=/\bpackage\s+([A-Za-z0-9_-]+:[A-Za-z0-9_-]+@\d+\.\d+\.\d+)\s*;/.exec(text);
  if(!packageMatch)fail('route.wit_package_missing');
  const identity=packageMatch[1];
  const exported=new Set(blocks(text,'world').flatMap(world=>[...world.body.matchAll(/\bexport\s+%?([A-Za-z][A-Za-z0-9-]*)\s*;/g)].map(row=>clean(row[1]))));
  const routes=[];
  for(const iface of blocks(text,'interface')){
    if(!exported.has(iface.name))continue;
    const flat=topLevel(iface.body);
    for(const match of flat.matchAll(/\b([A-Za-z][A-Za-z0-9-]*)\s*:\s*func\s*\(/g))routes.push(`${identity}/${iface.name}#${match[1]}`);
    for(const resource of blocks(iface.body,'resource')){
      const resourceFlat=topLevel(resource.body);
      if(/\bconstructor\s*\(/.test(resourceFlat))routes.push(`${identity}/${iface.name}#[constructor]${resource.name}`);
      for(const match of resourceFlat.matchAll(/\b([A-Za-z][A-Za-z0-9-]*)\s*:\s*(static\s+)?func\s*\(/g)){
        routes.push(`${identity}/${iface.name}#[${match[2]?'static':'method'}]${resource.name}.${match[1]}`);
      }
    }
  }
  if(new Set(routes).size!==routes.length)fail('route.wit_duplicate_route');
  return {identity,api_routes:routes.sort()};
}

export function parseLsi(bytes){
  const b=Buffer.from(bytes);
  if(b.length<8||b.subarray(0,4).toString('ascii')!=='LSI1')fail('route.index_invalid');
  const strings=b.readUInt16LE(4),count=b.readUInt16LE(6);
  const rows=8+(strings+1)*4,pool=rows+count*15;
  if(pool>b.length)fail('route.index_invalid');
  const offsets=[];
  for(let id=0;id<=strings;id++)offsets.push(b.readUInt32LE(8+id*4));
  if(offsets[0]!==0||offsets.some((value,index)=>value>(b.length-pool)||(index&&value<offsets[index-1])))fail('route.index_invalid');
  const string=id=>{
    if(id>=strings)fail('route.index_invalid');
    return b.subarray(pool+offsets[id],pool+offsets[id+1]).toString('utf8');
  };
  const entries=[];
  for(let row=0;row<count;row++){
    const base=rows+row*15;
    const fields=Array.from({length:6},(_,field)=>string(b.readUInt16LE(base+3+field*2)));
    entries.push({identity:fields[0],signature:fields[1]});
  }
  if(new Set(entries.map(row=>row.identity)).size!==entries.length)fail('route.index_duplicate_identity');
  return entries;
}

export function validateRouteSets({releasePackages,catalogPackages,indexEntries,activePackage}){
  const releaseIdentities=releasePackages.map(row=>row.identity);
  if(new Set(releaseIdentities).size!==releaseIdentities.length)fail('route.release_duplicate_identity');
  exact(catalogPackages.map(row=>`${row.identity}\0${row.root}`),releasePackages.map(row=>`${row.identity}\0${row.root}`),'route.catalog_release_set_mismatch');
  const candidateExtra=releaseIdentities.includes(activePackage.identity)?[]:[activePackage];
  const expectedPackages=[...releasePackages,...candidateExtra];
  const packageEntries=indexEntries.filter(row=>row.signature==='');
  const apiEntries=indexEntries.filter(row=>row.signature!=='');
  exact(packageEntries.map(row=>row.identity),expectedPackages.map(row=>row.identity),'route.package_set_mismatch');
  const expectedApis=expectedPackages.flatMap(row=>row.api_routes);
  exact(apiEntries.map(row=>row.identity),expectedApis,'route.api_set_mismatch');
  for(const row of apiEntries){
    const parents=expectedPackages.filter(parent=>row.identity.startsWith(parent.identity+'/'));
    if(parents.length!==1)fail('route.api_parent_unbound');
  }
  const bindings=releasePackages.map(row=>({
    identity:row.identity,
    root:row.root,
    catalog_bound:true,
    package_route_bound:true,
    api_routes:row.api_routes.length,
    api_routes_exact:true
  }));
  return {bindings,candidateExtra,packageRoutes:packageEntries.length,apiRoutes:apiEntries.length};
}

export function buildClosure(receiptPath=defaultReceipt,overrides={}){
  const release=overrides.release??json('release.json');
  const staged=overrides.stagedProduct??json(release.staged_product_manifest);
  const receiptBytes=read(receiptPath),receipt=JSON.parse(receiptBytes);
  const productMetadataRows=staged.product_files.filter(row=>/^(?:libs\/[^/]+|standard\/[^/]+\/[^/]+)\/lib\.json$/.test(row.path));
  const releasePackages=productMetadataRows.map(row=>{
    const bytes=read(row.path);
    if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)fail('route.release_metadata_drift');
    const metadata=JSON.parse(bytes),wit=read(`${row.path.slice(0,-8)}lib.wit`),parsed=parseWitRoutes(wit);
    if(metadata.wit?.package!==parsed.identity)fail('route.release_metadata_identity_drift');
    return {identity:parsed.identity,root:row.path.slice(0,-9),metadata_sha256:row.sha256,wit_sha256:metadata.wit.sha256,api_routes:parsed.api_routes};
  }).sort((a,b)=>a.identity.localeCompare(b.identity));
  const catalogBytes=read(receipt.catalog.path);
  if(sha(catalogBytes)!==receipt.catalog.sha256)fail('route.catalog_digest_mismatch');
  const rawCatalog=JSON.parse(catalogBytes);
  const catalog=parseCatalog(catalogBytes,{release_tag:rawCatalog.release_tag,release_commit:rawCatalog.release_commit});
  const catalogPackages=catalog.packages.map(row=>({identity:row.wit_package,root:row.root}));
  const activeRoot=receipt.candidate.public_root,activeMetadataBytes=read(`${activeRoot}/lib.json`);
  if(sha(activeMetadataBytes)!==receipt.artifact.manifest_sha256)fail('route.active_manifest_digest_mismatch');
  const activeMetadata=JSON.parse(activeMetadataBytes),activeWit=parseWitRoutes(read(`${activeRoot}/lib.wit`));
  if(activeMetadata.wit.package!==activeWit.identity)fail('route.active_metadata_identity_drift');
  const activePackage={identity:activeWit.identity,root:activeRoot,api_routes:activeWit.api_routes};
  const indexBytes=read(receipt.index.path);
  if(sha(indexBytes)!==receipt.index.sha256)fail('route.index_digest_mismatch');
  const indexEntries=parseLsi(indexBytes);
  if(indexEntries.length!==receipt.index.entries)fail('route.index_entry_count_mismatch');
  const validated=validateRouteSets({releasePackages,catalogPackages,indexEntries,activePackage});
  return {
    schema:'wasmc.lib-route-closure/v1',
    authority_receipt:{path:receiptPath,sha256:sha(receiptBytes)},
    release:{version:release.version,tag:release.tag,staged_product_manifest:release.staged_product_manifest??null,product_set_sha256:staged.product_set_sha256},
    catalog:{path:receipt.catalog.path,sha256:receipt.catalog.sha256,role:receipt.catalog.role,package_routes:catalogPackages.length},
    search_index:{path:receipt.index.path,sha256:receipt.index.sha256,active_identity:activePackage.identity,entries:indexEntries.length,package_routes:validated.packageRoutes,api_routes:validated.apiRoutes},
    release_bindings:validated.bindings,
    candidate_extras:validated.candidateExtra.map(row=>({identity:row.identity,root:row.root,package_route_bound:true,api_routes:row.api_routes.length,api_routes_exact:true,released:false})),
    blocking_conditions:validated.candidateExtra.length?['active-lib-search-candidate-extra']:[],
    claims:{release_catalog_exact:true,release_package_routes_exact:true,release_api_routes_exact:true,api_parents_closed:true,formal_release_ready:validated.candidateExtra.length===0,automatic_version_selection:false,candidate_extra_grants_release:false}
  };
}

function main(){
  const [action,arg,productPath]=process.argv.slice(2);
  if(!['--write','--check'].includes(action))throw Error('usage: lib-route-closure.mjs --write [ADMISSION_RECEIPT] | --check');
  if(action==='--write'){
    const overrides=productPath?{release:{version:'0.0.14',tag:'v0.0.14',staged_product_manifest:productPath},stagedProduct:json(productPath)}:{};
    const model=buildClosure(arg??defaultReceipt,overrides);
    writeFileSync(resolve(root,outputPath),JSON.stringify(model,null,2)+'\n');
    console.log(JSON.stringify({accepted:true,action:'write',path:outputPath,release_packages:model.release_bindings.length,package_routes:model.search_index.package_routes,api_routes:model.search_index.api_routes,candidate_extras:model.candidate_extras.length}));
  }else{
    const retained=json(outputPath);
    const stagedPath=retained.release.staged_product_manifest;
    const overrides=stagedPath&&stagedPath!==releasePath()?{release:retained.release,stagedProduct:json(stagedPath)}:{};
    const actual=buildClosure(retained.authority_receipt.path,overrides);
    assert.deepEqual(retained,actual,'retained Lib route closure drift');
    console.log(JSON.stringify({accepted:true,action:'check',path:outputPath,release_packages:actual.release_bindings.length,package_routes:actual.search_index.package_routes,api_routes:actual.search_index.api_routes,candidate_extras:actual.candidate_extras.length}));
  }
}
function releasePath(){return json('release.json').staged_product_manifest;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
