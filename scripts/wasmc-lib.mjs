import { readFileSync } from 'node:fs';
import { repositoryRoot, resolveCatalog, searchCatalog, sha256, catalogAuthorities } from './lib-catalog.mjs';
import { join } from 'node:path';
import { installLib } from './lib-install.mjs';
import {instantiateLibSearch} from '../examples/lib-search/client.mjs';
const [command, ...args] = process.argv.slice(2);
const catalogs=Object.freeze({
  v009:{file:'catalog/libs-v009.json',authority:catalogAuthorities.v009},
  v013:{file:'catalog/libs-v013.json',authority:catalogAuthorities.v013},
  v014:{file:'catalog/libs-v014.json',authority:catalogAuthorities.v014},
  v017:{file:'catalog/libs-v017.json',authority:catalogAuthorities.v017},
  v018:{file:'catalog/libs-v018.json',authority:catalogAuthorities.v018},
  current:{file:'catalog/libs-current-v2.json',authority:catalogAuthorities.currentV2},
});
const catalogSelection=name=>{
  const selected=catalogs[name??'current'];
  if(!selected)throw Object.assign(new Error('catalog.unknown_authority'),{code:'catalog.unknown_authority'});
  return selected;
};
try {
  let result;
  if (command === '--help' || command === 'help') {
    if(args.length)throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});
    result={accepted:true,schema:'wasmc.public-lib-cli-help/v1',default_catalog:'current',current_development_route:'agent-current-lib-quickstart.json',selection_authority:false,commands:{search:{arguments:['query'],options:['--catalog','--historical','--offset','--limit'],example:'node scripts/wasmc-lib.mjs search "base64 decode" --limit 8'},resolve:{arguments:['id','version'],required_options:['--catalog-sha256','--wit-sha256','--artifact-sha256'],optional_options:['--catalog'],identity_source:'catalog/libs-current-v2.json'},install:{arguments:['lock-path','destination'],required_options:['--lock-sha256','--mirror'],mirrors:['github','jsdelivr'],no_clobber:true,preserves_catalog_root:true}},release_qualification:false};
  } else if (command === 'search') {
    const words=[];let historical=false,offset=0,limit=64,catalogName='current';
    for(let i=0;i<args.length;i++) {
      const arg=args[i];
      if(arg==='--historical')historical=true;
      else if(arg==='--offset'||arg==='--limit'||arg==='--catalog') {
        const value=args[++i];
        if(arg==='--catalog'){if(!value)throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});catalogName=value;}
        else {if(!/^(0|[1-9][0-9]*)$/.test(value??''))throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});if(arg==='--offset')offset=Number(value);else limit=Number(value);}
      } else if(arg.startsWith('--'))throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});
      else words.push(arg);
    }
    const selected=catalogSelection(catalogName);
    const bytes=readFileSync(join(repositoryRoot,selected.file));
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(limit) || limit < 1 || limit > 64 || new TextEncoder().encode(words.join(' ')).length > 256)
      throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});
    const packages=searchCatalog(bytes,'',historical,selected.authority);
    const searchRoot='standard/wasmc-lib-search/0.4.0';
    const searchManifest=JSON.parse(readFileSync(join(repositoryRoot,searchRoot,'lib.json')));
    const lib=instantiateLibSearch(readFileSync(join(repositoryRoot,searchRoot,'artifact.wasm')),{
      artifact_sha256:searchManifest.artifact.sha256,
      index_sha256:'8513e628605e8ec05d76729a46fd7dc4427d64a83276368568ae05a0b9070eab',
      wit_package:searchManifest.wit.package,
    });
    const hits=[];
    // Filter before pagination: the retained index contains historical packages
    // which must never become selectable through the current catalog.
    for(let page=0;;page+=64){
      const result=lib.search({text:words.join(' '),include_historical:historical},page,64);
      if(result.error)throw Object.assign(new Error(result.error),{code:result.error});
      for(const hit of result.ok){
        const row=packages.find(row=>hit.identity===row.wit_package||hit.identity.startsWith(row.wit_package+'/'));
        if(row)hits.push({...hit,skill_path:row.root+'/SKILL.md',wit_path:row.root+'/lib.wit',artifact_path:row.root+'/artifact.wasm'});
      }
      if(result.ok.length<64)break;
    }
    for(const row of searchCatalog(bytes,words.join(' '),historical,selected.authority)){
      if(!hits.some(hit=>hit.identity===row.wit_package))hits.push({identity:row.wit_package,signature:'',skill_path:row.root+'/SKILL.md',wit_path:row.root+'/lib.wit',artifact_path:row.root+'/artifact.wasm'});
    }
    const all=hits.sort((a,b)=>a.identity<b.identity?-1:a.identity>b.identity?1:0);
    result={schema:'wasmc.public-lib-search/v2',snapshot:{catalog:selected.file,catalog_sha256:sha256(bytes),release_tag:selected.authority.release_tag,release_commit:selected.authority.release_commit},selection_authority:false,offset,limit,hits:all.slice(offset,offset+limit)};
  } else if (command === 'install') {
    const [lockPath,destination,...flags]=args;
    const values={};const allowed=new Set(['--lock-sha256','--mirror']);
    if(flags.length!==4)throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});
    for(let i=0;i<flags.length;i+=2){
      if(!allowed.has(flags[i])||Object.hasOwn(values,flags[i]))throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});
      values[flags[i]]=flags[i+1];
    }
    const lockBytes=readFileSync(lockPath);
    let lock;try{lock=JSON.parse(lockBytes);}catch{throw Object.assign(new Error('install.lock_invalid'),{code:'install.lock_invalid'});}
    const catalogName=lock?.release_tag==='current-v2-20260930'?'current':lock?.release_tag==='v0.0.18'?'v018':lock?.release_tag==='v0.0.17'?'v017':lock?.release_tag==='v0.0.14'?'v014':lock?.release_tag==='v0.0.13'?'v013':lock?.release_tag==='v0.0.9'?'v009':null;
    if(!catalogName)throw Object.assign(new Error('install.lock_invalid'),{code:'install.lock_invalid'});
    const selected=catalogSelection(catalogName);
    result=await installLib({catalogBytes:readFileSync(join(repositoryRoot,selected.file)),catalogAuthority:selected.authority,lockBytes,lockSha256:values['--lock-sha256'],destination,mirror:values['--mirror']});
  } else if (command === 'resolve') {
    const [id, version, ...flags] = args;
    const allowed = new Set(['--catalog','--catalog-sha256','--wit-sha256','--artifact-sha256']);
    const values = {};
    if (flags.length !== 6 && flags.length !== 8) throw Object.assign(new Error('resolve.exact_lock_required'), {code:'resolve.exact_lock_required'});
    for (let i=0;i<flags.length;i+=2) {
      if (!allowed.has(flags[i]) || Object.hasOwn(values,flags[i])) throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});
      values[flags[i]] = flags[i+1];
    }
    const selected=catalogSelection(values['--catalog']);
    const bytes=readFileSync(join(repositoryRoot,selected.file));
    result = resolveCatalog(bytes,{id,version,catalog_sha256:values['--catalog-sha256'],wit_sha256:values['--wit-sha256'],artifact_sha256:values['--artifact-sha256']},undefined,selected.authority);
  } else throw Object.assign(new Error('cli.command_unsupported'),{code:'cli.command_unsupported'});
  console.log(JSON.stringify(result,null,2));
} catch (error) {
  console.error(JSON.stringify({accepted:false,code:error.code ?? 'catalog.read_failed'}));
  process.exitCode=1;
}
