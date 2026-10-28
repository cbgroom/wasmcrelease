// Build a separate one-Lib normal-refresh stage, never altering selected Roots.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute,join,resolve} from 'node:path';
const [receiptPath,pin,out] = process.argv.slice(2);
assert.ok(isAbsolute(receiptPath??'') && /^[a-f0-9]{64}$/.test(pin??'') && isAbsolute(out??''));
assert.ok(!existsSync(out));
const sha=b=>createHash('sha256').update(b).digest('hex');
const receiptBytes=readFileSync(receiptPath); assert.equal(sha(receiptBytes),pin);
const receipt=JSON.parse(receiptBytes); assert.equal(receipt.schema,'wasmc.text-refresh-source/v1');
const repo=resolve(import.meta.dirname,'../../../..'), inputs=join(repo,'.agents/workstreams/WS-20261026-lib-memory-release-v031/producer/inputs');
const policyBytes=readFileSync(join(inputs,'cohort-rust-policy.json'));
assert.equal(sha(policyBytes),'a4d6c4ab47e2926e9eea81de33901b8383f1216c5af3457b99df83bed3ef2616');
const policy=JSON.parse(policyBytes); policy.toolchain='stable'; policy.edition='2024';
policy.dependencies.memchr='{ version = "=2.8.0", default-features = false, features = ["std"] }';
policy.shared_modules={};
const files=new Map();
for(const name of ['lib.json','lib.wit','adapter.rs','delta.rs']) {
  const bytes=readFileSync(join(receipt.output,name)); assert.equal(sha(bytes),receipt.files[name]);
  files.set(`libspec/wasmc-text/${name}`,bytes);
}
files.set('libspec/rust-policy.json',Buffer.from(JSON.stringify(policy,null,2)+'\n'));
files.set('libspec/registry.json',Buffer.from(JSON.stringify({schema:'wasmc.lib-refresh-registry/v2',authority:'libspec',libs:[{id:'wasmc-text',source:'libspec/wasmc-text'}]},null,2)+'\n'));
const lock=readFileSync(join(inputs,'eight.Cargo.lock'));
assert.equal(sha(lock),'9da7bf5fb19e18d1c2df034270a18b8cb2a6450aaf2fb2692ce911db27a155e5');
files.set('libspec/Cargo.lock',lock);
for(const name of ['lib-refresh-v2.mjs','lib-refresh-runner-v2.mjs','lib-refresh-cache-v2.mjs','lib-refresh-native-v2.mjs','lib-refresh-resource-core-v2.mjs','lib-refresh-upstream-source-v2.mjs'])
  files.set(`scripts/${name}`,readFileSync(join(repo,'scripts',name)));
mkdirSync(out);
for(const [name,bytes] of files){const p=join(out,name);mkdirSync(resolve(p,'..'),{recursive:true});writeFileSync(p,bytes,{flag:'wx'});}
console.log(JSON.stringify({schema:'wasmc.text-refresh-stage/v1',receipt_sha256:pin,edition:'2024',files:Object.fromEntries([...files].map(([k,v])=>[k,sha(v)])),output:out,formal_release:false}));
