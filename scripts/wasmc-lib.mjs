import { readFileSync } from 'node:fs';
import { repositoryRoot, sha256, searchCatalog, resolveCatalog } from './lib-catalog.mjs';
import { join } from 'node:path';
const [command, ...args] = process.argv.slice(2);
try {
  const bytes = readFileSync(join(repositoryRoot, 'catalog/libs-v009.json'));
  let result;
  if (command === 'search') {
    result = {schema:'wasmc.public-lib-search/v1', catalog_sha256:sha256(bytes), selection_authority:false, packages:searchCatalog(bytes,args.filter(a=>a !== '--historical').join(' '),args.includes('--historical'))};
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
