import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as api from '../current/index.mjs';
import * as single from '../current/wasmc.mjs';

const read = async p => new Uint8Array(await readFile(new URL(p, import.meta.url)));
const hash = b => createHash('sha256').update(b).digest('hex');
const corpus = JSON.parse(new TextDecoder().decode(await read('../examples/current/corpus.json')));
const wasm = await read('../current/wasmc_compiler.wasm');
const root = fileURLToPath(new URL('../',import.meta.url));
const runtime = globalThis.Deno?'deno':globalThis.Bun?'bun':'node';
mkdirSync(root+`target/current-${runtime}`,{recursive:true});
assert.equal(hash(wasm), '93d946c544975a6e7642ff1f5890e09d3bfb9924d0256ffcfebcf07485597c90');
assert.ok(wasm.length <= 2097152);
assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(wasm)), []);
(0, eval)(new TextDecoder().decode(await read('../current/wasmc.global.js')));
let outputs = 0;
for (const row of corpus) {
  for (const facade of [api, single, globalThis.Wasmc]) {
    const b = await facade.compile(row.source);
    assert.equal(hash(b), row.sha256, row.id);
    assert.equal(b.length, row.wasm_bytes, row.id);
    assert.ok(WebAssembly.validate(b));
    const module = new WebAssembly.Module(b);
    if (row.oracle) {
      assert.deepEqual(WebAssembly.Module.imports(module), []);
      const instance = new WebAssembly.Instance(module, {});
      const args = row.oracle.args.map(x => typeof x === 'string' && x.endsWith('n') ? BigInt(x.slice(0, -1)) : x);
      assert.equal(String(instance.exports[row.oracle.export](...args)), row.oracle.expected_stdout, row.id);
    }
    outputs++;
  }
  let globalOutput;
  assert.equal(await globalThis.Wasmc.main(['input.wasmc','output.wasm'],{readText:async()=>row.source,writeBytes:async(_,b)=>{globalOutput=b;},stderr:()=>{}}),0);
  assert.equal(hash(globalOutput),row.sha256);
  outputs++;
  const input=root+`target/current-${runtime}/${row.id}.wasmc`;
  writeFileSync(input,row.source);
  for(const entry of ['current/cli.mjs','current/wasmc.mjs']) {
    const output=input+entry.split('/')[1]+'.wasm';
    const prefix=runtime==='deno'?['run','--allow-read','--allow-write']:[];
    const result=spawnSync(process.execPath,[...prefix,root+entry,input,output],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.equal(hash(readFileSync(output)),row.sha256);
    outputs++;
  }
}
const cases = JSON.parse(new TextDecoder().decode(await read('../examples/current/expressions.json'))).cases;
const admitted = new Set(['bits','shift_i64','while','option_match_expr','option_unwrap','enum_pass','string_local_len','string_field_len','string_parameter_len','list_record_index','list_record_push_loop','explicit_cast']);
for (const row of cases) {
  let bytes, error;
  try { bytes = row.profile === 'managed' ? (await api.compileLib(row.source)).appWasm : await api.compile(row.source); }
  catch (e) { error = e; }
  assert.equal(!error, admitted.has(row.id), `${row.id}: ${error?.message}`);
  if (bytes) assert.ok(WebAssembly.validate(bytes));
}
const managed = `package local:loop;
interface api {
 record Cell { v:s32 }
 run:func()->s32 {
  let mut xs:list<Cell> = list.new();
  let i:u32=0;
  while(i<4) { xs.push({v:3}); i=i+1; }
  let total:s32=0;
  i=0;
  while(i<4) { total=total+xs.get(i).v; i=i+1; }
  return total;
 }
}
world app {export api;}`;
for (const facade of [api,single,globalThis.Wasmc]) {
 const linked = await facade.instantiateLib(managed);
 for(let i=0;i<64;i++) assert.equal(linked.exports.run(),12);
}
assert.equal(outputs,30);
console.log(JSON.stringify({accepted:true,runtime,compiler_sha256:hash(wasm),frozen_corpus_outputs:outputs,expression_cases:cases.length,managed_repeated_calls:192}));
