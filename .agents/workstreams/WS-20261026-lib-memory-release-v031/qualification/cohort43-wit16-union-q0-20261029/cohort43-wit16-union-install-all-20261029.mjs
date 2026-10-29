import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {hash,checkedCurrentCatalog,resolveCurrentPackage} from '/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/scripts/current-lib-release-v3.mjs';
import {installCurrentLib,artifactUrl} from '/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/scripts/lib-install.mjs';
const b='/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028',product=join(b,'cohort43-wit16-union-product-20261029'),out=join(b,'cohort43-wit16-union-install-all-20261029');mkdirSync(out);
const bytes=readFileSync(join(product,'catalog/libs-current-v2.json')),pin=hash(bytes);assert.equal(pin,'c7ffb657f69bbecd5ee5b297aed8de366debc531477757880eda489f786e9f3d');
const catalog=checkedCurrentCatalog(bytes,pin);assert.equal(catalog.packages.length,43);const read=p=>readFileSync(join(product,p));
const prefix=artifactUrl('github',catalog.package_authority_commit,'');const transport=async(url,opts)=>{assert.equal(opts.redirect,'manual');assert.ok(url.startsWith(prefix));return new Response(read(url.slice(prefix.length).split('/').map(decodeURIComponent).join('/')));};
let results=[];
for(const row of catalog.packages){
 const lock=resolveCurrentPackage(bytes,pin,{id:row.id,version:row.version,manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256},read),lockBytes=Buffer.from(JSON.stringify(lock)),destination=join(out,row.id);
 const receipt=await installCurrentLib({catalogBytes:bytes,catalogSha256:pin,lockBytes,lockSha256:hash(lockBytes),destination,mirror:'github'},transport);
 const installed=resolveCurrentPackage(bytes,pin,lock,p=>readFileSync(join(destination,p)));assert.deepEqual(installed,lock);
 results.push({id:row.id,version:row.version,profile:row.profile,manifest_sha256:row.manifest_sha256,files:row.files.length,artifact_sha256:row.delivery.artifact?.sha256??null,component_sha256:row.delivery.component?.sha256??null});console.error(JSON.stringify({id:row.id,files:row.files.length,accepted:true}));
}
const result={schema:'wasmc.cohort43-2024-controlled-install/v1',accepted:true,catalog_sha256:pin,roots:results.length,files:results.reduce((n,x)=>n+x.files,0),transport:'controlled local fixture',authority:'synthetic zero commit, not public',results};writeFileSync(join(out,'receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
