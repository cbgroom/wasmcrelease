import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { repositoryRoot, sha256, resolveCatalog, packageReader } from './lib-catalog.mjs';
const catalogBytes=readFileSync(join(repositoryRoot,'catalog/libs-v009.json'));
const row=JSON.parse(catalogBytes).packages.find(row=>row.id==='wasmc-std');
const lock=resolveCatalog(catalogBytes,{id:row.id,version:row.version,catalog_sha256:sha256(catalogBytes),wit_sha256:row.wit_sha256,artifact_sha256:row.artifact_sha256});
const lockBytes=Buffer.from(JSON.stringify(lock,null,2)+'\n');
const mirror=process.argv[2]??'github';
const fixture=mkdtempSync(join(tmpdir(),'wasmc-live-install-'));
const host=globalThis.Bun?'bun':globalThis.Deno?'deno':'node';
const run=(script,args,permissions)=>{
  let result;
  if(host==='deno') {
    const output=new Deno.Command(process.execPath,{args:['run',...permissions,script,...args],cwd:repositoryRoot,env:{},clearEnv:true,stdout:'piped',stderr:'piped'}).outputSync();
    result={status:output.code,stdout:new TextDecoder().decode(output.stdout),stderr:new TextDecoder().decode(output.stderr)};
  } else result=spawnSync(process.execPath,[script,...args],{cwd:repositoryRoot,env:{},encoding:'utf8',timeout:150000});
  if(result.status!==0)throw new Error(JSON.stringify({code:'install.journey_failed',host,status:result.status,diagnostic:result.stderr.split(fixture).join('<install-fixture>')}));
  return JSON.parse(result.stdout);
};
try{
  const lockPath=join(fixture,'lock.json'),destination=join(fixture,'installed');
  writeFileSync(lockPath,lockBytes);
  const receipt=run('scripts/wasmc-lib.mjs',['install',lockPath,destination,'--lock-sha256',sha256(lockBytes),'--mirror',mirror],['--allow-read','--allow-write','--allow-net=raw.githubusercontent.com,cdn.jsdelivr.net']);
  const installed=resolveCatalog(catalogBytes,lock,packageReader(destination));
  if(JSON.stringify(installed)!==JSON.stringify(lock))throw Error('installed receipt differs');
  const execution=run('examples/current/standard.mjs',['--installed',destination],['--allow-read']);
  console.log(JSON.stringify({accepted:true,host,mirror,lock_sha256:sha256(lockBytes),receipt,execution,source:'fresh exact-public-commit HTTPS downloads',artifact_changes:false}));
}finally{rmSync(fixture,{recursive:true});}
