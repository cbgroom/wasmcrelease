// Apply only to an explicit disposable stage after checking every old and new digest.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {resolve} from 'node:path';
assert.equal(process.argv.length,3,'expected disposable stage');const root=resolve(process.argv[2]),meta=JSON.parse(readFileSync(new URL('./overlay.json',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>readFileSync(resolve(root,p));assert.equal(sha(read('current/wasmc_compiler.wasm')),meta.compiler_sha256);assert.equal(sha(read(meta.root_manifest_path)),meta.root_manifest_sha256);
const pending=meta.files.map(row=>{assert.equal(sha(read(row.path)),row.before,'baseline '+row.path);const bytes=readFileSync(new URL('./overlay/'+row.path,import.meta.url));assert.equal(sha(bytes),row.after,'overlay '+row.path);return [row.path,bytes]});
for(const [path,bytes] of pending)writeFileSync(resolve(root,path),bytes);console.log(JSON.stringify({candidate_only:true,files:pending.length,all_digests_match:true}));
