import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as sidecar from '../current/index.mjs';
import * as single from '../current/wasmc.mjs';
import * as legacyPackage from '../package/index.mjs';
import * as legacyDist from '../dist/wasmc.mjs';
import { createHost } from '../runtime/wasmc-runtime-v0/host/node.mjs';
import { loadCompiler } from '../runtime/wasmc-runtime-v0/host/common.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const corpus=JSON.parse(read('../examples/current/corpus.json'));
const pin='d2efa131dc65bbcd797512cf9628e329c137283b9817976d93dbc782d4b64661';
assert.equal(hash(read('../current/wasmc_compiler.wasm')),pin);
(0,eval)(read('../current/wasmc.global.js').toString());
const classic=globalThis.Wasmc;
(0,eval)(read('../dist/wasmc.global.js').toString());
const runtime=await loadCompiler(createHost(new URL('../runtime/wasmc-runtime-v0/bootstrap.mjs',import.meta.url).href));
let outputs=0,oracles=0;
const engine=globalThis.Deno?'deno':globalThis.Bun?'bun':'node';
for(const c of corpus) {
  for(const api of [sidecar,single,classic,globalThis.Wasmc,legacyPackage,legacyDist,runtime]) {
    const b=await api.compile(c.source);
    assert.equal(hash(b),c.sha256,c.id);assert.equal(b.length,c.wasm_bytes,c.id);
    assert.ok(WebAssembly.validate(b));
    if(c.oracle) {
      const module=new WebAssembly.Module(b);assert.deepEqual(WebAssembly.Module.imports(module),[]);
      const instance=new WebAssembly.Instance(module,{});
      const args=c.oracle.args.map(x=>typeof x==='string'&&x.endsWith('n')?BigInt(x.slice(0,-1)):x);
      assert.equal(String(instance.exports[c.oracle.export](...args)),c.oracle.expected_stdout,c.id);oracles++;
    }
    outputs++;
  }
}
const temporary=mkdtempSync(join(tmpdir(),'wasmc-compiler-cli-'));
let cliOutputs=0;
try {
  for(const c of corpus)for(const entry of ['current/cli.mjs','current/wasmc.mjs','dist/wasmc.mjs','package/cli.mjs','runtime/wasmc-runtime-v0/bootstrap.mjs']) {
    const input=join(temporary,'input.wasmc'),output=join(temporary,'output.wasm');
    writeFileSync(input,c.source);
    const prefix=engine==='deno'?['run','--allow-read','--allow-write']:[];
    const args=entry.includes('bootstrap')?['compile','--input',input,'--output',output]:[input,output];
    const run=spawnSync(process.execPath,[...prefix,fileURLToPath(new URL('../'+entry,import.meta.url)),...args],{encoding:'utf8',timeout:30000});
    assert.equal(run.status,0,`${entry}: ${run.stderr}`);
    assert.equal(hash(readFileSync(output)),c.sha256,`${entry}: ${c.id}`);cliOutputs++;
  }
} finally {rmSync(temporary,{recursive:true,force:true});}
console.log(JSON.stringify({accepted:true,runtime:engine,compiler_sha256:pin,frozen_outputs:outputs,execution_oracles:oracles,cli_outputs:cliOutputs}));
