import assert from 'node:assert/strict';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {readFile,mkdtemp} from 'node:fs/promises';
import {generatedLib,selectedRun} from './generated-lib-v2.mjs';
import {command,atomicJson} from './lib-refresh-cache-v2.mjs';
const root=process.cwd(),run=selectedRun(),env={...process.env};
const attempt=await mkdtemp(join(run,'wasmi-attempt-'));
const names={ROUTER:'wasmc-router-policy',JSON:'wasmc-json',COMPRESSION:'wasmc-compression',HTTP1:'wasmc-http1',HTTP1_CLIENT:'wasmc-http1-client',TLS_CLIENT:'wasmc-tls-client',DATA_CORE:'wasmc-data-core',CSV:'wasmc-csv',DATA_EXPR:'wasmc-data-expr',DATA_COMPUTE:'wasmc-data-compute',DATA_RELATIONAL:'wasmc-data-relational',DATA_PROFILE:'wasmc-data-profile',DATA_INTERCHANGE:'wasmc-data-interchange'};
for(const [key,id] of Object.entries(names)){const s=await generatedLib(id,run);env['WASMC_GENERATED_'+key]=s.artifact;if(key==='DATA_RELATIONAL')env.WASMC_GENERATED_DATA_RELATIONAL_VERSION=s.row.version;}
env.WASMC_GENERATED_TLS_CERTIFICATE=join(root,'host/tests/https/fixtures/server-cert.der');
const target=process.env.WASMC_WASMI_TEST_TARGET??join(homedir(),'.cache/wasmc-generated-wasmi-tests');
Object.assign(env,{CARGO_TARGET_DIR:target,CARGO_NET_OFFLINE:'true',CARGO_PROFILE_DEV_DEBUG:'0',CARGO_BUILD_JOBS:'2'});
await command('cargo',['+1.96.0','build','--offline','--locked','--manifest-path','tests/lib-refresh/qualification/wasmi-core/Cargo.toml'],{cwd:root,env,timeout:900000,logs:join(attempt,'build')});
const output=await command(join(target,'debug','wasmc-generated-wasmi-qualification'),[],{cwd:root,env,timeout:300000,logs:join(attempt,'run')});
const result=JSON.parse(output.stdout.trim().split('\n').at(-1));assert.equal(result.accepted,true);assert.equal(result.engine,'wasmi-2.0.0');
await atomicJson(join(attempt,'receipt.json'),{...result,generated_receipt:run,public_admission:false});
await atomicJson(join(run,'wasmi-receipt.json'),{...result,generated_receipt:run,attempt,public_admission:false});console.log(JSON.stringify(result));
