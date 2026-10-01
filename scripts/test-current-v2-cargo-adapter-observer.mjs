import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {installCargoAdapterObserver,classifyObservedCargo,readCargoAdapterObservations} from './current-v2-cargo-adapter-observer.mjs';
const temp=mkdtempSync(join(realpathSync(tmpdir()),'wasmc-cargo-observer-test-'));
let rejected=0;
const reject=fn=>{assert.throws(fn);rejected++;};
try{
  const pass=join(temp,'pass'),workspace=join(pass,'workspace'),adapter=join(workspace,'.wasmc-rust-adapter-123-0');
  mkdirSync(join(adapter,'src'),{recursive:true});
  for(const [path,body] of Object.entries({'Cargo.toml':'fixture manifest\n','mapping.json':'{}\n','src/lib.rs':'source\n'}))
    writeFileSync(join(adapter,path),body);
  const delegate=join(temp,'delegate-cargo');
  writeFileSync(delegate,`#!${process.execPath}\nconst fs=require('node:fs');const a=process.argv.slice(2);if(a[0]==='-Vv')process.stdout.write('fixture Cargo\\n');if(a[0]==='generate-lockfile')fs.writeFileSync('Cargo.lock','generated lock\\n');if(a[0]==='build'&&process.env.WASMC_TEST_MUTATE_ADAPTER==='1')fs.appendFileSync('src/lib.rs','changed');if(process.env.WASMC_TEST_FAIL_CARGO==='1')process.exit(7);\n`,{mode:0o700});
  const observer=installCargoAdapterObserver(pass,workspace,delegate);
  const env={...process.env,...observer.env};
  const invoke=(args,cwd=adapter,overrides={})=>spawnSync(join(observer.output,'cargo'),args,{cwd,env:{...env,...overrides},encoding:'utf8'});
  const version=invoke(['-Vv'],temp);assert.equal(version.status,0,version.stderr);assert.equal(version.stdout,'fixture Cargo\n');
  const lock=invoke(['generate-lockfile','--offline']);assert.equal(lock.status,0,lock.stderr);
  const build=['build','--release','--locked','--offline','--target','wasm32-unknown-unknown','--manifest-path','Cargo.toml','--target-dir',join(temp,'target')];
  const built=invoke(build);assert.equal(built.status,0,built.stderr);
  const rows=readCargoAdapterObservations(observer.output);
  assert.equal(rows.length,3);
  const observed=rows.find(row=>row.real_build_observed);
  assert(observed);assert.deepEqual(observed.before,observed.after);
  assert.equal(rows.find(row=>row.kind==='lock').before.lock_required,false);
  assert.equal(rows.find(row=>row.kind==='lock').after.lock_required,true);
  assert.equal(observed.manifest_independently_qualified,false);
  const config={workspace};
  reject(()=>classifyObservedCargo(['test'],adapter,config));
  reject(()=>classifyObservedCargo(['generate-lockfile','--offline'],workspace,config));
  reject(()=>classifyObservedCargo(build,temp,config));
  reject(()=>classifyObservedCargo([...build,'--features','unreviewed'],adapter,config));
  reject(()=>classifyObservedCargo(build.map(x=>x==='--offline'?'--frozen':x),adapter,config));
  reject(()=>classifyObservedCargo(build.map(x=>x==='wasm32-unknown-unknown'?'native':x),adapter,config));
  reject(()=>classifyObservedCargo([...build.slice(0,9),'relative-target'],adapter,config));
  const linked=join(workspace,'linked');symlinkSync(adapter,linked);
  reject(()=>classifyObservedCargo(build,linked,config));
  const changed=invoke(build,adapter,{WASMC_TEST_MUTATE_ADAPTER:'1'});
  assert.notEqual(changed.status,0);assert.match(changed.stderr,/generated adapter inputs changed/);rejected++;
  writeFileSync(join(adapter,'src','lib.rs'),'source\n');
  const failed=invoke(build,adapter,{WASMC_TEST_FAIL_CARGO:'1'});
  assert.equal(failed.status,7);assert(readCargoAdapterObservations(observer.output).some(row=>row.exit_code===7&&!row.real_build_observed));
  writeFileSync(join(observer.output,'config.json'),Buffer.concat([readFileSync(join(observer.output,'config.json')),Buffer.from(' ')]));
  const badConfig=invoke(['-Vv'],temp);assert.notEqual(badConfig.status,0);assert.match(badConfig.stderr,/observer config changed/);rejected++;
  const pass2=join(temp,'profile-pass'),workspace2=join(pass2,'workspace'),adapter2=join(workspace2,'.wasmc-rust-adapter-456-0');
  mkdirSync(join(adapter2,'src'),{recursive:true});mkdirSync(join(workspace2,'upstream'));
  const manifest=`[package]\nname = "wasmc-lib-adapter"\nversion = "1.2.3"\nedition = "2024"\n[lib]\ncrate-type = ["cdylib"]\n[dependencies]\nalgo = { package = "fixture-package", path = "${join(workspace2,'upstream')}" }\n[profile.release]\npanic = "abort"\n[workspace]\n`;
  writeFileSync(join(adapter2,'Cargo.toml'),manifest);writeFileSync(join(adapter2,'mapping.json'),'{}\n');writeFileSync(join(adapter2,'src/lib.rs'),'source\n');
  const observer2=installCargoAdapterObserver(pass2,workspace2,delegate,{version:'1.2.3',dependency_alias:'algo',dependency_package:'fixture-package',upstream_crate_dir:'upstream'});
  const invoke2=args=>spawnSync(join(observer2.output,'cargo'),args,{cwd:adapter2,env:{...process.env,...observer2.env},encoding:'utf8'});
  const locked2=invoke2(['generate-lockfile','--offline']);assert.equal(locked2.status,0,locked2.stderr);
  const built2=invoke2(build);assert.equal(built2.status,0,built2.stderr);
  const profiled=readCargoAdapterObservations(observer2.output);assert.equal(profiled.length,2);
  assert(profiled.every(row=>row.manifest_independently_qualified&&row.manifest_profile.expected_contract_checked));
  for(const bad of [manifest.replace('panic = "abort"','panic = "unwind"'),manifest+'[features]\nextra=[]\n']){
    writeFileSync(join(adapter2,'Cargo.toml'),bad);const result=invoke2(build);assert.notEqual(result.status,0);rejected++;
    assert.equal(readCargoAdapterObservations(observer2.output).length,2,'invalid manifest must reject before delegation');
  }
  assert.equal(rejected,12);
  console.log(JSON.stringify({accepted:true,negative_controls:rejected,fixture_delegation_exercised:true,
    generated_lock_and_build_observed:true,failed_delegate_retained:true,real_producer_build_observed:false,release_qualified:false}));
}finally{rmSync(temp,{recursive:true,force:true});}
