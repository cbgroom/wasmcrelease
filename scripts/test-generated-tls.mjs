// Real TLS Component tests consume an exact generated package and its pinned
// WIT inputs. Test harnesses are not library authoring/build fallbacks.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { generatedLib, selectedRun } from './generated-lib-v2.mjs';
import { atomicJson, command, sha } from './lib-refresh-cache-v2.mjs';

const repo=process.cwd(), runRoot=selectedRun();
const work=await mkdtemp(join(tmpdir(),'wasmc-current-tls-tests-'));
const target=resolve(process.env.WASMC_TEST_TARGET_DIR ?? join(homedir(),'.cache/wasmc-current-component-tests'));
const entries=[];
for(const id of ['wasmc-tls-core','wasmc-tls-client']) {
  const selected=await generatedLib(id,runRoot), harness=join(work,id);
  await mkdir(join(harness,'src'),{recursive:true});
  for(const file of ['Cargo.toml','Cargo.lock']) await copyFile(join(repo,'tests/lib-refresh/resource',id,file),join(harness,file));
  const original=await readFile(join(repo,'tests/lib-refresh/resource',id,'src/main.rs'),'utf8');
  const main=original.replace(/path: "[^"]+",\n    world:/,'path: "wit",\n    world:');
  assert.notEqual(main,original,'expected one retained test WIT locator');
  await writeFile(join(harness,'src/main.rs'),main);
  const spec=JSON.parse(await readFile(join(repo,'libspec',id,'lib.json')));
  for(const dep of [id,...(spec.wit_dependencies??[])]) {
    const source='libspec/'+dep+'/lib.wit',bytes=await readFile(join(repo,source));
    assert.equal(sha(bytes),selected.receipt.source_digests[source],'WIT differs from selected build');
    const dest=dep===id?join(harness,'wit'):join(harness,'wit/deps',dep);
    await mkdir(dest,{recursive:true});await writeFile(join(dest,'world.wit'),bytes);
  }
  const env={...process.env,CARGO_TARGET_DIR:target,CARGO_NET_OFFLINE:'true',CARGO_BUILD_JOBS:'2',CARGO_PROFILE_DEV_DEBUG:'0',CARGO_INCREMENTAL:'0',
    RUSTFLAGS:'',RUSTC_WRAPPER:'',RUSTC_WORKSPACE_WRAPPER:'',CARGO_ENCODED_RUSTFLAGS:''};
  await command('cargo',['+1.96.0','build','--offline','--locked','--manifest-path',join(harness,'Cargo.toml')],
    {cwd:repo,env,logs:join(work,id+'-build'),timeout:900000});
  const request=join(work,'request.bin'), response=join(work,'response.bin');
  await writeFile(request,'GET /health HTTP/1.1\r\nhost: example.com\r\n\r\n');
  const result=await command(join(target,'debug',id+'-host-test'),[],{cwd:repo,timeout:60000,logs:join(work,id+'-run'),env:{...env,
    WASMC_TLS_COMPONENT:selected.component,WASMC_TLS_CLIENT_COMPONENT:selected.component,
    WASMC_TLS_CERT:join(repo,'host/tests/https/fixtures/server-cert.der'),WASMC_TLS_KEY:join(repo,'host/tests/https/fixtures/server-key.pkcs8.der'),
    WASMC_TLS_HTTP_REQUEST:request,WASMC_TLS_HTTP_RESPONSE_OUTPUT:response}});
  const receipt=JSON.parse(result.stdout.trim().split('\n').at(-1));assert.equal(receipt.accepted,true);
  if(id==='wasmc-tls-client') {
    assert.equal(receipt.hostname_rejected,true);assert.equal(receipt.loopback_https,true);
    assert.deepEqual(receipt.root_boundary,{accepted:256,rejected:257});
    assert.ok(receipt.entropy_calls>0);assert.ok(receipt.close_notify_bytes>0);
  }
  entries.push({id,component_sha256:selected.row.component_sha256,result:receipt});
}
const result={schema:'wasmc.lib-refresh-tls-q1/v2',accepted:true,run_root:runRoot,harness_root:work,packages:entries,
  entropy:'deterministic test-only entropy; never a production randomness implementation',public_admission:false};
await atomicJson(join(runRoot,'tls-q1-receipt.json'),result);console.log(JSON.stringify(result));
