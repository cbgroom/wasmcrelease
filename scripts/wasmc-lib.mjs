import { readFileSync } from 'node:fs';
import { repositoryRoot, resolveCatalog } from './lib-catalog.mjs';
import { join } from 'node:path';
import { installLib } from './lib-install.mjs';
import {instantiateLibSearch} from '../examples/lib-search/client.mjs';
const [command, ...args] = process.argv.slice(2);
try {
  const bytes = command==='search'?null:readFileSync(join(repositoryRoot, 'catalog/libs-v009.json'));
  let result;
  if (command === 'search') {
    const lib=instantiateLibSearch(readFileSync(join(repositoryRoot,'standard/wasmc-lib-search/0.1.0/artifact.wasm')),{artifact_sha256:'44944d542d818b8ad8a9794a555694b8e56ed4f147d4370b1ff975e26b204c80',index_sha256:'c1ccd8f5086b3d3ae0643383f2d3e3e682358b4ccc4a99042233bd35fa73b534'});
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
    result=await installLib({catalogBytes:bytes,lockBytes:readFileSync(lockPath),lockSha256:values['--lock-sha256'],destination,mirror:values['--mirror']});
  } else if (command === 'resolve') {
    const [id, version, ...flags] = args;
    const allowed = new Set(['--catalog-sha256','--wit-sha256','--artifact-sha256']);
    const values = {};
    if (flags.length !== 6) throw Object.assign(new Error('resolve.exact_lock_required'), {code:'resolve.exact_lock_required'});
    for (let i=0;i<flags.length;i+=2) {
      if (!allowed.has(flags[i]) || Object.hasOwn(values,flags[i])) throw Object.assign(new Error('cli.arguments_invalid'),{code:'cli.arguments_invalid'});
      values[flags[i]] = flags[i+1];
    }
    result = resolveCatalog(bytes,{id,version,catalog_sha256:values['--catalog-sha256'],wit_sha256:values['--wit-sha256'],artifact_sha256:values['--artifact-sha256']});
  } else throw Object.assign(new Error('cli.command_unsupported'),{code:'cli.command_unsupported'});
  console.log(JSON.stringify(result,null,2));
} catch (error) {
  console.error(JSON.stringify({accepted:false,code:error.code ?? 'catalog.read_failed'}));
  process.exitCode=1;
}
