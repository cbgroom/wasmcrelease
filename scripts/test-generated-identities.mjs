import assert from 'node:assert/strict';
import { copyFile, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { generatedLib, selectedRun } from './generated-lib-v2.mjs';
import { atomicJson, command, sha } from './lib-refresh-cache-v2.mjs';

const run = selectedRun(), repo = process.cwd();
const attempt = await mkdtemp(join(run, 'identities-attempt-'));
const consumer = join(attempt,'consumer');
const dependencies = [], selected = [];
for (const [alias, id] of [['owned_sdk','wasmc-owned-algorithms'], ['counter_sdk','wasmc-resource-counter'], ['clock_sdk','wasmc-host-clock']]) {
  const item = await generatedLib(id, run);
  const manifest = JSON.parse(await readFile(join(item.root,'lib.json')));
  const binding = manifest.bindings.rust_component;
  const dest = join(attempt, 'roots', id);
  await mkdir(dest, {recursive:true});
  // Copy only WIT and generated consumer glue, never delta or implementation sources.
  await copyFile(join(item.root,'lib.wit'), join(dest,'lib.wit'));
  await cp(join(item.root,binding.path), join(dest,binding.path), {recursive:true});
  dependencies.push(alias+' = { package = '+JSON.stringify(binding.crate)+', path = '+JSON.stringify('../roots/'+id+'/'+binding.path)+' }');
  selected.push(item);
}
await mkdir(join(consumer,'src'),{recursive:true});
await copyFile('tests/lib-refresh/identities/consumer.rs',join(consumer,'src/main.rs'));
await writeFile(join(consumer,'Cargo.toml'),[
  '[package]','name="wasmc-current-identities-consumer"','version="0.1.0"','edition="2021"','publish=false',
  '[dependencies]',...dependencies,'[workspace]','',
].join('\n'));
const env={...process.env,CARGO_NET_OFFLINE:'true',CARGO_PROFILE_DEV_DEBUG:'0',CARGO_BUILD_JOBS:'2',
  CARGO_TARGET_DIR:join(homedir(),'.cache/wasmc-current-identities-consumer')};
const result={schema:'wasmc.current-identities-qualification/v1',accepted:false,source_free:true,
  packages:selected.map(v=>({id:v.row.id,manifest_sha256:v.row.manifest_sha256,component_sha256:v.row.component_sha256})),
  consumer_sha256:sha(await readFile('tests/lib-refresh/identities/consumer.rs')),public_admission:false};
try {
  await command('cargo',['+1.96.0','generate-lockfile','--offline'],{cwd:consumer,env,timeout:60000,logs:join(attempt,'lock')});
  await command('cargo',['+1.96.0','build','--locked','--offline'],{cwd:consumer,env,timeout:600000,logs:join(attempt,'build')});
  const output=await command(join(env.CARGO_TARGET_DIR,'debug/wasmc-current-identities-consumer'),selected.map(v=>v.component),
    {cwd:attempt,env,timeout:90000,logs:join(attempt,'run')});
  result.report=JSON.parse(output.stdout.trim().split('\n').at(-1));
  assert.equal(result.report.accepted,true);
  result.test_lock_sha256=sha(await readFile(join(consumer,'Cargo.lock')));
  result.accepted=true;
} catch(error) {result.error=error.stack;process.exitCode=1;}
await atomicJson(join(attempt,'receipt.json'),result);
console.log(JSON.stringify({...result,attempt}));
