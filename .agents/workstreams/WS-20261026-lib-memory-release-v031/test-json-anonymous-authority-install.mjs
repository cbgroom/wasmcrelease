// Qualify actual anonymous GitHub bytes at a candidate Git commit; the local
// catalog/proof remain unadmitted and this does not assert a formal release.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {currentProductReader,resolveCurrentPackage} from '../../../scripts/current-lib-release-v3.mjs';
import {verify as verifyJsonProduct} from '../../../scripts/json-combined-product-v1.mjs';
import {installCurrentLib} from '../../../scripts/lib-install.mjs';
import {sha} from '../../../scripts/lib-refresh-cache-v2.mjs';
const [root,catalogSha,oldSha,receiptSha,out,witPath,witSha,commit]=process.argv.slice(2);
for(const p of [root,out,witPath])assert.ok(isAbsolute(p));assert.match(commit,/^[a-f0-9]{40}$/);
await verifyJsonProduct({root,catalogSha,oldSha,receiptSha,witPath,witSha,commit});
const read=currentProductReader(root),catalogBytes=read('catalog/libs-current-v2.json'),catalog=JSON.parse(catalogBytes);
assert.equal(catalog.package_authority_commit,commit);assert.equal(catalog.version,'0.0.0');
await mkdir(out);await mkdir(join(out,'packages'));await mkdir(join(out,'results'));
const rows=[],queue=[...catalog.packages];
async function worker(){for(;;){
 const row=queue.shift();if(!row)return;
 try{
  const lock=resolveCurrentPackage(catalogBytes,catalogSha,row,read),lockBytes=Buffer.from(JSON.stringify(lock)),lockSha=sha(lockBytes),destination=join(out,'packages',row.id);
  const receipt=await installCurrentLib({catalogBytes,catalogSha256:catalogSha,lockBytes,lockSha256:lockSha,destination,mirror:'github'});
  assert.equal(receipt.id,row.id);assert.equal(receipt.version,row.version);assert.equal(receipt.catalog_sha256,catalogSha);
  assert.equal(receipt.artifact_commit,commit);assert.equal(receipt.files_verified,row.files.length);
  for(const f of row.files){const b=await readFile(join(destination,f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
  const result={id:row.id,version:row.version,accepted:true,files:row.files.length,manifest_sha256:row.manifest_sha256,receipt};
  await writeFile(join(out,'results',row.id+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});rows.push(result);console.error(JSON.stringify({id:row.id,accepted:true,files:row.files.length}));
 }catch(e){const result={id:row.id,version:row.version,accepted:false,error:e.message,code:e.code??null};await writeFile(join(out,'results',row.id+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});rows.push(result);console.error(JSON.stringify(result));}
}}
await Promise.all(Array.from({length:4},worker));rows.sort((a,b)=>a.id.localeCompare(b.id));
const result={schema:'wasmc.json-anonymous-authority-install/v1',accepted:rows.length===catalog.packages.length&&rows.every(r=>r.accepted),
 authority_commit:commit,catalog_sha256:catalogSha,packages:rows.length,files:rows.reduce((n,r)=>n+(r.files??0),0),
 transport:'anonymous GitHub raw through actual installer',catalog_scope:'local synthetic 0.0.0 candidate',rows,public_admission:false,formal_release:false};
await writeFile(join(out,'receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({accepted:result.accepted,packages:result.packages,files:result.files,authority_commit:commit}));if(!result.accepted)process.exitCode=1;
