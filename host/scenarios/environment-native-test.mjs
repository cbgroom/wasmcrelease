import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {compile} from '../../current/wasmc.mjs';
const sha = b => createHash('sha256').update(b).digest('hex');
const libPath = 'libs/wasmc-owned-algorithms/artifact.wasm';
const lib = await readFile(libPath);
assert.equal(sha(lib),'44638f7cfa5a653f986e2237db4f26f1534539c8c0d0d1e7258c51a976df19e3');
const source = await readFile('host/scenarios/environment-app.wasmc','utf8');
const apps = [await compile(source),await readFile(process.argv[3])];
const engines = process.argv.includes('--wasmtime') ? ['wasmi','wasmtime'] : ['wasmi'];
const scratch = await mkdtemp(join(tmpdir(),'wasmc-environment-'));
const counts = {};
try {
  for(const engine of engines) {
    let real=0, controls=0, oracle=0;
    for(let caller=0;caller<2;caller++) {
      const path=join(scratch,`app-${caller}.wasm`); await writeFile(path,apps[caller]);
      for(const mode of [...Array(32).fill('real'),'oracle','denied','unsupported']) {
        const receipt=JSON.parse(execFileSync(process.argv[2],[path,libPath,engine,mode],{encoding:'utf8',timeout:30000,maxBuffer:4096}));
        assert.equal(receipt.accepted,true); assert.equal(receipt.scratch_released,true);
        if(mode==='denied'||mode==='unsupported') {
          assert.equal(receipt.error,mode==='denied'?'permission-denied':'unsupported');
          assert.equal(receipt.lib_calls,0); assert.equal(receipt.entropy_fills,0); controls++;
        } else {
          assert.equal(receipt.clock_reads,2); assert.equal(receipt.entropy_fills,1); assert.equal(receipt.lib_calls,1);
          assert.ok(Number.isInteger(receipt.value)&&receipt.value>=0&&receipt.value<=4080);
          if(mode==='oracle') { assert.equal(receipt.value,120); oracle++; } else real++;
        }
      }
    }
    counts[engine]={real_source_app_calls:real,controlled_oracles:oracle,negative_controls:controls};
  }
  console.log(JSON.stringify({accepted:true,scope:'restricted-synchronous-native-app-lib-host-profile',
    engines:counts,app_sha256:apps.map(sha),lib_sha256:sha(lib),source_sha256:sha(source),
    rust_source_sha256:sha(await readFile('host/scenarios/environment-app.rs')),
    binding_source_sha256:sha(await readFile('host/lib-e2e/rust/src/bin/environment-app-reference.rs')),
    exact_source:process.env.GITHUB_SHA??null,os:process.platform,arch:process.arch,
    uniform_v1_execution:false,guest_async_abi:false,mobile_device_execution:false,entropy_quality_proven:false}));
} finally { await rm(scratch,{recursive:true,force:true}); }
