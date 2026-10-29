import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {currentProductReader,resolveCurrentPackage} from '../../../../../scripts/current-lib-release-v3.mjs';
import {installCurrentLib,artifactUrl} from '../../../../../scripts/lib-install.mjs';
import {sha} from '../../../../../scripts/lib-refresh-cache-v2.mjs';
const [product,out,expectedCommit,expectedCatalog]=process.argv.slice(2);assert.equal(resolve(product),product);assert.equal(resolve(out),out);
const read=currentProductReader(product),bytes=read('catalog/libs-current-v2.json');assert.equal(sha(bytes),expectedCatalog);
const catalog=JSON.parse(bytes);assert.equal(catalog.package_authority_commit,expectedCommit);const row=catalog.packages.find(x=>x.id==='wasmc-json');assert.equal(row.version,'0.2.4');assert.equal(row.manifest_sha256,'8b2c659b8b28327a6945f08f1168e07d4526ed8a1705cadc05b9f544eab6c284');
const allowed=new Set(row.files.map(p=>artifactUrl('github',expectedCommit,p.path)));let count=0;
const fetcher=async (url,options)=>{assert.ok(allowed.has(url));const response=await fetch(url,options);assert.equal(response.status,200);count++;return response;};
const lock=resolveCurrentPackage(bytes,expectedCatalog,row,read),lockBytes=Buffer.from(JSON.stringify(lock)+'\n');await mkdir(out);
const destination=join(out,'installed'),receipt=await installCurrentLib({catalogBytes:bytes,catalogSha256:expectedCatalog,lockBytes,lockSha256:sha(lockBytes),destination},fetcher);
for(const p of row.files){const b=await readFile(join(destination,p.path));assert.equal(b.length,p.bytes);assert.equal(sha(b),p.sha256);}
assert.equal(count,row.files.length);const result={schema:'wasmc.json024-anonymous-candidate-install/v1',accepted:true,artifact_commit:expectedCommit,catalog_sha256:expectedCatalog,manifest_sha256:row.manifest_sha256,files_verified:count,installed_root:join(await realpath(destination),row.root),transport:'anonymous HTTPS GitHub immutable commit',local_candidate_catalog:true,public_admission:false,formal_release:false};
await writeFile(join(out,'receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
