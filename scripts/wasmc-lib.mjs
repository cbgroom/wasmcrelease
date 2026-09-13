import { readFileSync } from 'node:fs';
import { repositoryRoot, sha256, searchCatalog, resolveCatalog } from './lib-catalog.mjs';
import { join } from 'node:path';
import { installLib } from './lib-install.mjs';
const [command, ...args] = process.argv.slice(2);
try {
  const bytes = readFileSync(join(repositoryRoot, 'catalog/libs-v009.json'));
  let result;
  if (command === 'search') {
    result = {schema:'wasmc.public-lib-search/v1', catalog_sha256:sha256(bytes), selection_authority:false, packages:searchCatalog(bytes,args.filter(a=>a !== '--historical').join(' '),args.includes('--historical'))};
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
