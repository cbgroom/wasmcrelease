// Controlled offline install from exact Git authority objects; this is not
// anonymous network availability, public admission, or a formal release.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {currentProductReader,resolveCurrentPackage} from '../../../scripts/current-lib-release-v3.mjs';
import {verify as verifyJsonProduct} from '../../../scripts/json-combined-product-v1.mjs';
import {installCurrentLib} from '../../../scripts/lib-install.mjs';
import {sha} from '../../../scripts/lib-refresh-cache-v2.mjs';
const [repo,root,catalogSha,oldSha,receiptSha,out,witPath,witSha,commit]=process.argv.slice(2);
for(const p of [repo,root,out,witPath])assert.ok(isAbsolute(p));assert.match(commit,/^[a-f0-9]{40}$/);
const git=(...args)=>execFileSync('git',args,{cwd:repo,maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
assert.equal(git('rev-parse','--verify',`${commit}^{commit}`).toString().trim(),commit);
const closure=await verifyJsonProduct({root,catalogSha,oldSha,receiptSha,witPath,witSha,commit});
const read=currentProductReader(root),catalogBytes=read('catalog/libs-current-v2.json'),catalog=JSON.parse(catalogBytes);
assert.equal(catalog.package_authority_commit,commit);
const prefix=`https://raw.githubusercontent.com/cbgroom/wasmcrelease/${commit}/`;
const expected=new Map(catalog.packages.flatMap(row=>row.files.map(file=>[file.path,file])));
assert.equal(expected.size,catalog.packages.reduce((n,row)=>n+row.files.length,0));
const seen=new Set();const fetcher=async url=>{
  assert.ok(url.startsWith(prefix),'exact immutable Git authority URL');
  const path=url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
  const pin=expected.get(path);assert.ok(pin,'requested path must be in selected Root inventory');
  const bytes=git('show',`${commit}:${path}`);assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256);
  seen.add(path);return new Response(bytes,{status:200});
};
// A predecessor without the new version must not satisfy that version's Root.
assert.throws(()=>git('cat-file','-e',`${commit}^:current-libs/wasmc-json/0.2.2/lib.json`));
await mkdir(out);let files=0;const rows=[];
for(const row of catalog.packages){
 const lock=resolveCurrentPackage(catalogBytes,catalogSha,row,read),lockBytes=Buffer.from(JSON.stringify(lock));
 const destination=join(out,row.id);const receipt=await installCurrentLib({catalogBytes,catalogSha256:catalogSha,
  lockBytes,lockSha256:sha(lockBytes),destination,mirror:'github'},fetcher);
 for(const file of row.files){const bytes=await readFile(join(destination,file.path));assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256);files++;}
 assert.equal(receipt.files_verified,row.files.length);rows.push({id:row.id,version:row.version,files:row.files.length});
}
assert.equal(seen.size,expected.size);assert.equal(files,expected.size);
const result={schema:'wasmc.json-git-authority-install/v1',accepted:true,authority_commit:commit,catalog_sha256:catalogSha,
 packages:rows.length,files,rows,previous_commit_rejected:true,product_verification:closure.schema,
 transport:'actual Git object bytes supplied to actual installer; no network',private_proof_published:false,public_admission:false,formal_release:false};
await writeFile(join(out,'receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({accepted:true,authority_commit:commit,packages:rows.length,files,previous_commit_rejected:true}));
