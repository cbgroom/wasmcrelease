// Explicit per-producer-child Cargo delegate. Never installs a global wrapper.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,realpathSync,lstatSync,readdirSync} from 'node:fs';
import {resolve,join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {snapshotGeneratedAdapter,verifyGeneratedAdapterUnchanged} from './current-v2-generated-adapter-snapshot.mjs';
const modulePath=fileURLToPath(import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const digest=path=>sha(readFileSync(path));
const canonical=path=>{assert.equal(realpathSync(path),resolve(path),'linked observer scope');return resolve(path);};
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
export function installCargoAdapterObserver(parent,workspace,realCargo){
  const base=canonical(parent),scope=canonical(workspace),cargo=resolve(realCargo);
  assert(lstatSync(base).isDirectory()&&lstatSync(scope).isDirectory());
  assert(scope.startsWith(base+'/'),'workspace outside this private invocation');
  assert(!cargo.startsWith(base+'/'),'delegate must not be this observer');
  assert(lstatSync(realpathSync(cargo)).isFile(),'Cargo delegate is not a file');
  const out=join(base,'cargo-observer');mkdirSync(out);
  for(const name of ['current-v2-cargo-adapter-observer.mjs','current-v2-generated-adapter-snapshot.mjs'])
    writeFileSync(join(out,name),readFileSync(join(dirname(modulePath),name)),{flag:'wx'});
  mkdirSync(join(out,'receipts'));
  const config={schema:'wasmc.cargo-adapter-observer-config/v1',workspace:scope,output:out,
    real_cargo:cargo,real_cargo_sha256:digest(cargo),node:process.execPath,node_sha256:digest(process.execPath),
    observer_sha256:digest(join(out,'current-v2-cargo-adapter-observer.mjs')),
    snapshot_sha256:digest(join(out,'current-v2-generated-adapter-snapshot.mjs'))};
  const configPath=join(out,'config.json'),bytes=Buffer.from(JSON.stringify(config));
  writeFileSync(configPath,bytes,{flag:'wx'});
  writeFileSync(join(out,'cargo'),`#!/bin/sh\nexec ${quote(process.execPath)} ${quote(join(out,'current-v2-cargo-adapter-observer.mjs'))} "$@"\n`,{flag:'wx',mode:0o700});
  return {output:out,env:{PATH:out+':'+process.env.PATH,
    WASMC_ADAPTER_OBSERVER_CONFIG:configPath,WASMC_ADAPTER_OBSERVER_CONFIG_SHA256:sha(bytes)}};
}
export function classifyObservedCargo(args,cwd,config){
  if(JSON.stringify(args)==='["-Vv"]')return {kind:'version',generated:false};
  const path=canonical(cwd),workspace=canonical(config.workspace);
  assert(path===workspace||path.startsWith(workspace+'/'),'Cargo invocation outside selected workspace');
  const generated=dirname(path)===workspace&&/^\.wasmc-rust-adapter-[0-9]+-[0-9]+$/.test(basename(path));
  if(JSON.stringify(args)==='["generate-lockfile","--offline"]'){
    assert(generated,'lock generation must be in the generated adapter');return {kind:'lock',generated};
  }
  assert.deepEqual(args.slice(0,9),['build','--release','--locked','--offline','--target','wasm32-unknown-unknown','--manifest-path','Cargo.toml','--target-dir'],'unexpected Cargo invocation');
  assert.equal(args.length,10,'extra Cargo argument');
  assert(args[9].startsWith('/'),'target-dir must be absolute');
  return {kind:'build',generated};
}
export function readCargoAdapterObservations(output){
  const dir=join(canonical(output),'receipts');
  return readdirSync(dir).sort().map(name=>{
    assert.match(name,/^[0-9]+\.json$/);const path=join(dir,name);
    assert(lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink());
    return JSON.parse(readFileSync(path));
  });
}
function main(){
  const configPath=process.env.WASMC_ADAPTER_OBSERVER_CONFIG;
  assert(configPath,'missing per-invocation observer config');
  const bytes=readFileSync(configPath);
  assert.equal(sha(bytes),process.env.WASMC_ADAPTER_OBSERVER_CONFIG_SHA256,'observer config changed');
  const config=JSON.parse(bytes),out=canonical(config.output);
  assert.equal(resolve(configPath),join(out,'config.json'));
  assert.equal(config.schema,'wasmc.cargo-adapter-observer-config/v1');
  assert.equal(resolve(modulePath),join(out,'current-v2-cargo-adapter-observer.mjs'));
  assert.equal(digest(modulePath),config.observer_sha256);
  assert.equal(digest(join(out,'current-v2-generated-adapter-snapshot.mjs')),config.snapshot_sha256);
  assert.equal(process.execPath,config.node);assert.equal(digest(process.execPath),config.node_sha256);
  assert(!resolve(config.real_cargo).startsWith(out+'/'),'recursive Cargo delegate');
  assert.equal(digest(config.real_cargo),config.real_cargo_sha256,'Cargo delegate changed');
  const args=process.argv.slice(2),cwd=process.cwd(),mode=classifyObservedCargo(args,cwd,config);
  const before=mode.generated?snapshotGeneratedAdapter(config.workspace,cwd,{requireLock:mode.kind!=='lock'}):null;
  const result=spawnSync(config.real_cargo,args,{cwd,env:process.env,stdio:'inherit',timeout:600000});
  const after=mode.generated?snapshotGeneratedAdapter(config.workspace,cwd):null;
  if(mode.generated&&mode.kind==='build')verifyGeneratedAdapterUnchanged(config.workspace,cwd,before);
  if(mode.generated&&mode.kind==='lock'){
    const previous={...before.files},next={...after.files};delete previous['Cargo.lock'];delete next['Cargo.lock'];
    assert.deepEqual(next,previous,'lock generation changed non-lock inputs');
  }
  assert.equal(digest(config.real_cargo),config.real_cargo_sha256,'Cargo delegate changed during execution');
  writeFileSync(join(out,'receipts',`${process.pid}.json`),JSON.stringify({
    schema:'wasmc.cargo-adapter-observation/v1',kind:mode.kind,generated:mode.generated,
    adapter:mode.generated?basename(cwd):null,before,after,
    exit_code:result.status,signal:result.signal??null,delegate_sha256:config.real_cargo_sha256,
    observer_sha256:config.observer_sha256,snapshot_sha256:config.snapshot_sha256,
    real_build_observed:mode.generated&&mode.kind==='build'&&result.status===0,
    manifest_independently_qualified:false,full_transitive_license_audit:false,release_qualified:false}),{flag:'wx'});
  if(result.error)throw result.error;
  process.exit(result.status??1);
}
if(process.argv[1]&&resolve(process.argv[1])===modulePath)main();
