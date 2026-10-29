import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {currentProductReader,resolveCurrentPackage} from '../../../../../scripts/current-lib-release-v3.mjs';
import {installCurrentLib,artifactUrl} from '../../../../../scripts/lib-install.mjs';
import {sha} from '../../../../../scripts/lib-refresh-cache-v2.mjs';

const [product,out]=process.argv.slice(2);
assert.equal(product,resolve(product));assert.equal(out,resolve(out));
const read=currentProductReader(product),bytes=read('catalog/libs-current-v2.json');
const digest=sha(bytes),catalog=JSON.parse(bytes),commit=catalog.package_authority_commit;
assert.equal(digest,'ac32312f3e06f7ca2b3f8e20d66ecd4914f1ffd10ad45ae1cef4ff06a9628192');
assert.equal(commit,'f0166ba76b8613f6decd1ab7c362ca8a9cd90031');assert.equal(catalog.packages.length,43);
const files=catalog.packages.flatMap(row=>row.files),expected=new Map(files.map(x=>[artifactUrl('github',commit,x.path),x]));
assert.equal(files.length,823);assert.equal(expected.size,files.length);
await mkdir(out);const seen=new Set(),rows=[];let next=0,failed=null;
const fetcher=async(url,options)=>{assert(expected.has(url),'unexpected source');const response=await fetch(url,options);assert.equal(response.status,200,'candidate HTTP status '+response.status);seen.add(url);return response;};
async function worker(){
 while(!failed){const i=next++;if(i>=catalog.packages.length)return;const row=catalog.packages[i];
  try{const lock=resolveCurrentPackage(bytes,digest,row,read),lockBytes=Buffer.from(JSON.stringify(lock)+'\n'),destination=join(out,row.id);
   const receipt=await installCurrentLib({catalogBytes:bytes,catalogSha256:digest,lockBytes,lockSha256:sha(lockBytes),destination},fetcher);
   assert.equal(receipt.files_verified,row.files.length);
   for(const file of row.files){const b=await readFile(join(destination,file.path));assert.equal(b.length,file.bytes,file.path);assert.equal(sha(b),file.sha256,file.path);}
   const result={id:row.id,version:row.version,files:row.files.length,manifest_sha256:row.manifest_sha256};rows.push(result);console.log(JSON.stringify({event:'installed',...result}));
  }catch(e){failed={id:row.id,error:String(e?.stack??e)};console.error(JSON.stringify({event:'failed',...failed}));return;}
 }
}
await Promise.allSettled([worker(),worker(),worker()]);
if(failed){await writeFile(join(out,'failure.json'),JSON.stringify({failed,completed:rows,seen:seen.size,formal_release:false},null,2)+'\n',{flag:'wx'});process.exitCode=1;}
else{assert.equal(rows.length,43);assert.equal(seen.size,823);assert.equal(rows.find(x=>x.id==='wasmc-json')?.version,'0.2.4');const receipt={status:'PUBLIC_CANDIDATE_INSTALL_PASS_NOT_RELEASE',catalog_sha256:digest,artifact_commit:commit,packages:rows.length,files_verified:seen.size,transport:'anonymous HTTPS GitHub immutable candidate commit',formal_release:false,rows:rows.sort((a,b)=>a.id.localeCompare(b.id))};await writeFile(join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({event:'complete',status:receipt.status,packages:rows.length,files_verified:seen.size}));}
