import { readFileSync } from 'node:fs';
import { repositoryRoot, resolveCatalog, catalogAuthorities } from './lib-catalog.mjs';
import { join } from 'node:path';
import { installLib } from './lib-install.mjs';
import {instantiateLibSearch} from '../examples/lib-search/client.mjs';
const [command, ...args] = process.argv.slice(2);
const catalogs=Object.freeze({
  v009:{file:'catalog/libs-v009.json',authority:catalogAuthorities.v009},
  v012:{file:'catalog/libs-v012.json',authority:catalogAuthorities.v012},
});
const catalogSelection=name=>{
  const selected=catalogs[name??'v009'];
  if(!selected)throw Object.assign(new Error('catalog.unknown_authority'),{code:'catalog.unknown_authority'});
  return selected;
};
try {
  const bytes = command==='search'?null:readFileSync(join(repositoryRoot, 'catalog/libs-v009.json'));
  let result;
  if (command === 'search') {
    const searchRoot=join(repositoryRoot,'candidates/wasmc-lib-search/0.2.0');
    const searchManifest=JSON.parse(readFileSync(join(searchRoot,'lib.json')));
    const lib=instantiateLibSearch(readFileSync(join(searchRoot,'artifact.wasm')),{artifact_sha256:'3dc83d83709527c126620635ea0e8cd0a51b2fbfeef544818d8526406fe62a99',index_sha256:'7f33c20e46499dd016f8656b075c78366a683686c070794d20dec152fbb8cbe5',wit_package:searchManifest.wit.package});
    const words=[];let historical=false,offset=0,limit=64;
    for(let i=0;i<args.length;i++) {
      const arg=args[i];
      if(arg==='--historical')historical=true;
      else if(arg==='--offset'||arg==='--limit') {
        const value=args[++i];if(!/^(0|[1-9][0-9]*)$/.test(value??''))throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});
        if(arg==='--offset')offset=Number(value);else limit=Number(value);
      } else if(arg.startsWith('--'))throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});
      else words.push(arg);
    }
    const page=lib.search({text:words.join(' '),include_historical:historical},offset,limit);
    if(page.error)throw Object.assign(new Error(page.error),{code:page.error});
    result={schema:'wasmc.public-lib-search/v2',snapshot:lib.snapshot(),selection_authority:false,offset,limit,hits:page.ok};
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
    const catalogName=lock?.release_tag==='v0.0.12'?'v012':lock?.release_tag==='v0.0.9'?'v009':null;
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
    const catalogBytes=readFileSync(join(repositoryRoot,selected.file));
    result = resolveCatalog(catalogBytes,{id,version,catalog_sha256:values['--catalog-sha256'],wit_sha256:values['--wit-sha256'],artifact_sha256:values['--artifact-sha256']},undefined,selected.authority);
  } else throw Object.assign(new Error('cli.command_unsupported'),{code:'cli.command_unsupported'});
  console.log(JSON.stringify(result,null,2));
} catch (error) {
  console.error(JSON.stringify({accepted:false,code:error.code ?? 'catalog.read_failed'}));
  process.exitCode=1;
}
