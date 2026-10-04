import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Run only in a disposable, source-free archive (no Git metadata).
const root=fileURLToPath(new URL('../',import.meta.url));
assert.equal(existsSync(root+'.git'),false,'negative controls require disposable archive');
const check=()=>spawnSync(process.execPath,[root+'scripts/current-compiler-integrity.mjs'],{encoding:'utf8',timeout:30000});
assert.equal(check().status,0);
let rejected=0;
function mutate(path,change) {
  const full=root+path,original=readFileSync(full);
  try {writeFileSync(full,change(original));assert.notEqual(check().status,0,path);rejected++;}
  finally {writeFileSync(full,original);}
  assert.equal(check().status,0,`restore: ${path}`);
}
mutate('current/wasmc_compiler.wasm',b=>Buffer.concat([b,Buffer.from([0])]));
mutate('current/compiler-release.json',b=>{
  const m=JSON.parse(b);m.compiler.sha256='0'.repeat(64);return JSON.stringify(m);
});
mutate('current/wasmc.mjs',b=>Buffer.from(b.toString().replace('const binary = atob("','const binary = atob("AAAA')));
mutate('runtime/wasmc-runtime-v0/compiler.wasm',b=>Buffer.concat([b,Buffer.from([0])]));
mutate('runtime/registry-v0/channels/dev.json',b=>{
  const m=JSON.parse(b);m.packages[0].compiler_sha256='0'.repeat(64);return JSON.stringify(m);
});
const hidden=root+'package/wasmc_compiler.wasm';
try {
  writeFileSync(hidden,readFileSync(root+'current/wasmc_compiler.wasm'));
  assert.notEqual(check().status,0,'unexpected compiler carrier');rejected++;
} finally {unlinkSync(hidden);}
assert.equal(check().status,0);
console.log(JSON.stringify({accepted:true,actual_rejections:rejected,restored:true}));
