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
  if (command === 'search') {
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
    const all=searchCatalog(bytes,words.join(' '),historical,selected.authority);
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
