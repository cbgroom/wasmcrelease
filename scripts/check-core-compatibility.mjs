import { readFileSync } from 'node:fs';
import { coreContract, preflightCoreArtifact, currentHost } from './core-compatibility.mjs';
const requested = process.argv.slice(2);
const ids = requested.length ? requested : coreContract.artifacts.map(row => row.id);
const results = ids.map(id => {
  const row = coreContract.artifacts.find(row => row.id === id);
  try {
    if (!row) throw Error('unknown artifact id');
    return preflightCoreArtifact(id, readFileSync(new URL('../' + row.path, import.meta.url)));
  } catch (error) {
    return error.diagnostic ?? {accepted:false, code:'compatibility.contract_invalid', artifact:id};
  }
});
const accepted = results.every(row => row.accepted);
console.log(JSON.stringify({schema:'wasmc.core-compatibility-check/v1', accepted, host:currentHost(), results}));
if (!accepted) process.exitCode = 1;
