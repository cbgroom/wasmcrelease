import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {currentProductReader,resolveCurrentPackage} from '../../../../../scripts/current-lib-release-v3.mjs';
import {installCurrentLib} from '../../../../../scripts/lib-install.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base='/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028';
const root=join(base,'resident-combined-product-20261029'),out=join(base,'resident-combined-network-20261029');await mkdir(out);
const read=currentProductReader(root),catalogBytes=read('catalog/libs-current-v2.json'),catalogSha='4acd1f8ad46561d2ac3188e9f81982cc24fb5f6ab76f2a1faa105ce250336117';assert.equal(sha(catalogBytes),catalogSha);
const catalog=JSON.parse(catalogBytes),results=[];
for(const id of ['wasmc-json','mcpgit-resident-memory']){
 const row=catalog.packages.find(p=>p.id===id);assert.equal(row.version,'0.2.1');
 const lock=resolveCurrentPackage(catalogBytes,catalogSha,row,read),lockBytes=Buffer.from(JSON.stringify(lock));
 const dest=join(out,id),receipt=await installCurrentLib({catalogBytes,catalogSha256:catalogSha,lockBytes,lockSha256:sha(lockBytes),destination:dest,mirror:'github'});
 for(const f of row.files){const b=await readFile(join(dest,f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
 assert.equal(receipt.files_verified,row.files.length);results.push({id,version:row.version,files:row.files.length,manifest_sha256:row.manifest_sha256,artifact_sha256:row.delivery.artifact.sha256,component_sha256:row.delivery.component.sha256});
}
const report={schema:'wasmc.full-candidate-network-install/v1',accepted:true,catalog_sha256:catalogSha,authority_commit:catalog.package_authority_commit,transport:'anonymous GitHub raw via installCurrentLib',packages:results,scope:'two selected Roots from full candidate catalog; not production route, CI or formal release'};
await writeFile(join(out,'witness.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
