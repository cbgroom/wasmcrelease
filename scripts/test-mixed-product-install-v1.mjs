// Real installer, controlled byte transport; this does not establish public
// availability or teach the published CLI a new cohort schema.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { currentProductReader, resolveCurrentPackage } from './current-lib-release-v3.mjs';
import { verifyMixedCurrentProduct } from './mixed-current-product-v1.mjs';
import { installCurrentLib } from './lib-install.mjs';
import { sha } from './lib-refresh-cache-v2.mjs';

const [root,catalogSha,oldSha,candidateSha,out]=process.argv.slice(2);
assert.ok(isAbsolute(root)&&isAbsolute(out));
const closure=verifyMixedCurrentProduct(root,catalogSha,oldSha,candidateSha);
const read=currentProductReader(root),catalogBytes=read('catalog/libs-current-v2.json'),catalog=JSON.parse(catalogBytes);
assert.equal(catalog.package_authority_commit,'0'.repeat(40),'controlled fixture authority required');
const prefix=`https://raw.githubusercontent.com/cbgroom/wasmcrelease/${catalog.package_authority_commit}/`;
const fetcher=async url=>{
  assert.ok(url.startsWith(prefix),'controlled product URL');
  const path=url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
  return new Response(read(path),{status:200});
};
await mkdir(out);const rows=[];
for(const row of catalog.packages){
  const lock=resolveCurrentPackage(catalogBytes,catalogSha,row,read),lockBytes=Buffer.from(JSON.stringify(lock));
  const destination=join(out,row.id),receipt=await installCurrentLib({catalogBytes,catalogSha256:catalogSha,
    lockBytes,lockSha256:sha(lockBytes),destination,mirror:'github'},fetcher);
  for(const f of row.files){const b=await readFile(join(destination,f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
  assert.equal(receipt.files_verified,row.files.length);
  rows.push({id:row.id,version:row.version,manifest_sha256:row.manifest_sha256,files:row.files.length});
}
const result={schema:'wasmc.mixed-fixture-install/v1',accepted:true,catalog_sha256:catalogSha,
  packages:rows.length,files:rows.reduce((n,r)=>n+r.files,0),rows,verification_schema:closure.schema,
  transport:'controlled local bytes through actual installer fetch injection',public_admission:false,formal_release:false};
await writeFile(join(out,'fixture-install-receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({accepted:true,packages:result.packages,files:result.files,catalog_sha256:catalogSha}));
