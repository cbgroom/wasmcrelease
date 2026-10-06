import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {generatedLib,selectedRun} from './generated-lib-v2.mjs';
import {atomicJson,command} from './lib-refresh-cache-v2.mjs';

const root=process.cwd(),run=selectedRun(),selected=await generatedLib('wasmc-system-telemetry',run);
const work=await mkdtemp(join(tmpdir(),'wasmc-generated-telemetry-'));
await mkdir(join(work,'consumer/wit'),{recursive:true});
for(const file of ['Cargo.toml','Cargo.lock'])await copyFile(join(root,'examples/system-telemetry/consumer',file),join(work,'consumer',file));
await copyFile(join(root,'examples/system-telemetry/component_consumer.rs'),join(work,'component_consumer.rs'));
await copyFile(join(selected.root,'lib.wit'),join(work,'consumer/wit/world.wit'));
const attempt=await mkdtemp(join(run,'telemetry-attempt-'));
const target=join(homedir(),'.cache/wasmc-generated-telemetry-tests');
const env={...process.env,CARGO_TARGET_DIR:target,CARGO_NET_OFFLINE:'true',CARGO_PROFILE_DEV_DEBUG:'0',CARGO_BUILD_JOBS:'2'};
await command('cargo',['+1.96.0','build','--offline','--locked','--manifest-path',join(work,'consumer/Cargo.toml')],{cwd:root,env,timeout:900000,logs:join(attempt,'build')});
const output=await command(join(target,'debug/telemetry-consumer'),[selected.component],{cwd:root,env,timeout:60000,logs:join(attempt,'run')});
const report=JSON.parse(output.stdout.trim().split('\n').at(-1));assert.equal(report.accepted,true);assert.equal(report.rounds,128);assert.equal(report.host_bindings,0);
const receipt={schema:'wasmc.generated-telemetry-component/v2',accepted:true,component_sha256:selected.row.component_sha256,
  source_free_consumer:true,report,public_admission:false};
await atomicJson(join(attempt,'receipt.json'),receipt);
await atomicJson(join(run,'telemetry-component-receipt.json'),{...receipt,attempt});console.log(JSON.stringify(receipt));
