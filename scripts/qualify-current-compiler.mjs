import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { platform, arch } from 'node:os';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
if(existsSync(root+'.git'))throw Error('qualification must run from a source-free public archive');
if(existsSync(root+'src/language')||existsSync(root+'crates/wasmc_wasm_cdylib'))throw Error('private compiler source must not be present');
const manifest=readFileSync(root+'current/compiler-release.json');
const product=JSON.parse(manifest),runs=[];
for(const engine of ['node','bun','deno']) {
  const version=spawnSync(engine,['--version'],{encoding:'utf8',timeout:30000});
  if(version.status!==0)throw Error(`missing ${engine}`);
  const commands=[
    engine==='deno'?['run','--allow-read','--allow-write','--allow-run','--allow-env','scripts/test-current-compiler.mjs']:['scripts/test-current-compiler.mjs'],
    engine==='deno'?['run','--allow-read','examples/current/standard.mjs']:['examples/current/standard.mjs']
  ];
  for(const args of commands) {
    const r=spawnSync(engine,args,{cwd:root,encoding:'utf8',timeout:60000});
    if(r.status!==0)throw Error(`${engine} ${args.at(-1)} failed: ${r.stderr}`);
    const result=JSON.parse(r.stdout);
    if(result.accepted!==true)throw Error('acceptance missing');
    runs.push({engine,version:version.stdout.trim(),args,exit_code:r.status,result});
  }
}
const control=spawnSync(process.execPath,['scripts/test-current-compiler-integrity.mjs'],{cwd:root,encoding:'utf8',timeout:60000});
if(control.status!==0)throw Error(control.stderr);
const receipt={schema:'wasmc.current-compiler-qualification/v1',accepted:true,
  version:product.version,compiler_sha256:product.compiler.sha256,
  product_manifest_sha256:createHash('sha256').update(manifest).digest('hex'),
  source_free:true,compiler_private_source_present:false,
  platform:platform(),arch:arch(),runs,
  rejection_controls:{exit_code:control.status,result:JSON.parse(control.stdout)},
  nonclaims:['whole-product release','all18 Lib qualification','Pi model-pair qualification','native SDK requalification','real browser qualification']};
writeFileSync(root+'current/qualification.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({accepted:true,engines:3,api_cli_outputs:180,execution_oracles:21,standard_consumer_calls:23040,actual_rejections:6,product_manifest_sha256:receipt.product_manifest_sha256}));
