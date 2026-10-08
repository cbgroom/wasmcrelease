import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {hash,checkedCurrentCatalog,resolveCurrentPackage,currentProductReader} from './current-lib-release-v3.mjs';
const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
const catalogBytes=readFileSync(join(repositoryRoot,'catalog/libs-current-v2.json'));
const catalogSha256='a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad';
const catalog=checkedCurrentCatalog(catalogBytes,catalogSha256),row=catalog.packages.find(r=>r.id==='wasmc-std');
const lock=resolveCurrentPackage(catalogBytes,catalogSha256,{id:row.id,version:row.version,manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256},currentProductReader(repositoryRoot));
const lockBytes=Buffer.from(JSON.stringify(lock,null,2)+'\n');
if(hash(lockBytes)!=='4fe1ac9859b28764f009c3ee6381124a6602e760c627f790eea8886dfe61bd9f')throw Error('independent approved Std lock drift');
const mirror=process.argv[2]??'github',fixture=mkdtempSync(join(tmpdir(),'wasmc-current-live-install-'));
const host=globalThis.Bun?'bun':globalThis.Deno?'deno':'node';
const run=(script,args,permissions)=>{
 let result;
 if(host==='deno'){
  const output=new Deno.Command(process.execPath,{args:['run',...permissions,script,...args],cwd:repositoryRoot,env:{},clearEnv:true,stdout:'piped',stderr:'piped'}).outputSync();
  result={status:output.code,stdout:new TextDecoder().decode(output.stdout),stderr:new TextDecoder().decode(output.stderr)};
 }else result=spawnSync(process.execPath,[script,...args],{cwd:repositoryRoot,env:{},encoding:'utf8',timeout:150000});
 if(result.status!==0)throw Error(JSON.stringify({host,status:result.status,diagnostic:result.stderr.split(fixture).join('<install-fixture>')}));
 return JSON.parse(result.stdout);
};
try{
 const lockPath=join(fixture,'lock.json'),destination=join(fixture,'installed');writeFileSync(lockPath,lockBytes);
 const receipt=run('scripts/wasmc-lib.mjs',['install',lockPath,destination,'--catalog-sha256',catalogSha256,'--lock-sha256',hash(lockBytes),'--mirror',mirror],['--allow-read','--allow-write','--allow-net=raw.githubusercontent.com,cdn.jsdelivr.net']);
 const installed=resolveCurrentPackage(catalogBytes,catalogSha256,lock,path=>readFileSync(join(destination,path)));
 if(JSON.stringify(installed)!==JSON.stringify(lock))throw Error('installed complete-Root lock differs');
 const execution=run('examples/base64/run.mjs',['--installed',destination],['--allow-read']);
 console.log(JSON.stringify({accepted:true,host,mirror,lock_sha256:hash(lockBytes),receipt,execution,source:'fresh exact-public-commit HTTPS downloads',provider_companion:'separately pinned current tooling',artifact_changes:false}));
}finally{rmSync(fixture,{recursive:true});}
