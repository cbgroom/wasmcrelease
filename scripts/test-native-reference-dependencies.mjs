import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=await mkdtemp(join(tmpdir(),'wasmc-native-dependencies-'));
const check=args=>spawnSync('sh',['scripts/check-native-reference-dependencies.sh',...args],{encoding:'utf8'});
let controls=0;
try {
  const inventory=join(root,'inventory.txt');
  await writeFile(inventory,'wasmc-lib-host-e2e v0.0.1\nwasmi v2.0.0\nwasmi_core v2.0.0\nserde_json v1.0.151\nlibc v0.2.189\n');
  assert.equal(check([inventory]).status,0);controls++;
  for(const name of ['wasmtime','wasmtime-internal-cranelift','wasi','wasi-common','wasip2','wasip3','wat','wast','rustls','rustls-pki-types','openssl-sys','native-tls']) {
    await writeFile(inventory,`wasmc-lib-host-e2e v0.0.1\nwasmi v2.0.0\n${name} v1.0.0\n`);
    const rejected=check([inventory]);assert.notEqual(rejected.status,0,name);assert.match(rejected.stderr,/default native dependency denied/);controls++;
  }
  for(const incomplete of ['', 'wasmi v2.0.0\n', 'wasmc-lib-host-e2e v0.0.1\n']) {
    await writeFile(inventory,incomplete);assert.notEqual(check([inventory]).status,0);controls++;
  }
  for(const args of [[],[join(root,'missing')],[inventory,'extra']]){assert.notEqual(check(args).status,0);controls++;}
  const directory=join(root,'directory');await mkdir(directory);assert.notEqual(check([directory]).status,0);controls++;
}finally{await rm(root,{recursive:true,force:true});}
console.log(JSON.stringify({accepted:true,native_dependency_gate_controls:controls,missing_inventory_denied:true,nonregular_inventory_denied:true,default_graph_only:true,optional_wasmtime_qualified_separately:true,real_device_runtime:false}));
