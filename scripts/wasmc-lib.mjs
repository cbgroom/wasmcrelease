#!/usr/bin/env node
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,lstatSync} from 'node:fs';
import {checkedCurrentCatalog,hash,resolveCurrentPackage,searchCurrentRelease,searchCurrentReleaseV4,verifyCurrentRelease,verifyCurrentReleaseV4,currentProductReader,currentProductPaths} from './current-lib-release-v3.mjs';
import {installCurrentLib} from './lib-install.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=currentProductReader(root);
const [command,...args]=process.argv.slice(2);
const flags=(values,allowed)=>{
  if(values.length%2)throw Error('paired options required');
  const out={};for(let i=0;i<values.length;i+=2){if(!allowed.includes(values[i])||Object.hasOwn(out,values[i])||!values[i+1])throw Error('invalid option');out[values[i]]=values[i+1];}
  return out;
};
try{
  const bytes=read('catalog/libs-current-v2.json');let output;
  const policyFor=async pin=>{
    const catalog=checkedCurrentCatalog(bytes,pin),cohortBytes=read(catalog.cohort.path);
    if(cohortBytes.length!==catalog.cohort.bytes||hash(cohortBytes)!==catalog.cohort.sha256)throw Error('cohort identity mismatch');
    const schema=JSON.parse(cohortBytes).schema;
    if(schema==='wasmc.public-current-refresh-cohort/v2')return {verify:verifyCurrentReleaseV4,search:searchCurrentReleaseV4};
    if(schema==='wasmc.json-overlay-cohort/v1'||schema==='wasmc.json-derived-overlay-cohort/v1'){
      const {verifyPublicJsonOverlayPinned,searchPublicJsonOverlay}=await import('./json-overlay-public-v1.mjs');
      return {verify:verifyPublicJsonOverlayPinned,search:searchPublicJsonOverlay};
    }
    if(schema==='wasmc.mixed-current-cohort/v1'){
      const {verifyMixedFromCatalog,searchMixedCurrentRelease}=await import('./mixed-current-product-v1.mjs');
      return {verify:verifyMixedFromCatalog,search:searchMixedCurrentRelease};
    }
    if(schema==='wasmc.public-current-refresh-cohort/v1'||schema==='wasmc.public-current-composition-cohort/v1')return {verify:verifyCurrentRelease,search:searchCurrentRelease};
    throw Error('unsupported current cohort schema');
  };
  if(command==='search'){
    const words=[],pairs=[];
    for(let i=0;i<args.length;i++){if(args[i].startsWith('--')){pairs.push(args[i],args[++i]);}else words.push(args[i]);}
    const v=flags(pairs,['--catalog-sha256','--offset','--limit','--package','--profile','--bound-only']);
    if(!v['--catalog-sha256'])throw Error('independent catalog SHA256 required');
    for(const key of ['--offset','--limit'])if(v[key]&&!/^(0|[1-9][0-9]*)$/.test(v[key]))throw Error('invalid pagination');
    if(v['--bound-only']&&!['true','false'].includes(v['--bound-only']))throw Error('invalid bound-only');
    output=(await policyFor(v['--catalog-sha256'])).search(bytes,v['--catalog-sha256'],read,
      {text:words.join(' '),package_id:v['--package']??null,profile:v['--profile']??null,bound_only:v['--bound-only']==='true'},
      Number(v['--offset']??0),Number(v['--limit']??64),currentProductPaths(root));
  }else if(command==='resolve'){
    const [id,version,...options]=args,v=flags(options,['--catalog-sha256','--manifest-sha256','--root-inventory-sha256']);
    if(Object.keys(v).length!==3)throw Error('exact catalog/manifest/root identities required');
    (await policyFor(v['--catalog-sha256'])).verify(bytes,v['--catalog-sha256'],read,currentProductPaths(root));
    output=resolveCurrentPackage(bytes,v['--catalog-sha256'],{id,version,manifest_sha256:v['--manifest-sha256'],root_inventory_sha256:v['--root-inventory-sha256']},read);
  }else if(command==='install'){
    const [lockPath,destination,...options]=args,v=flags(options,['--catalog-sha256','--lock-sha256','--mirror']);
    if(Object.keys(v).length!==3)throw Error('exact catalog/lock identities and mirror required');
    output=await installCurrentLib({catalogBytes:bytes,catalogSha256:v['--catalog-sha256'],lockBytes:readFileSync(lockPath),lockSha256:v['--lock-sha256'],destination,mirror:v['--mirror']});
  }else throw Error('usage: wasmc-lib.mjs search | resolve | install with explicit current identities');
  console.log(JSON.stringify(output,null,2));
}catch(e){console.error(JSON.stringify({accepted:false,code:e.code??'current_product_rejected',message:e.message}));process.exitCode=1;}
