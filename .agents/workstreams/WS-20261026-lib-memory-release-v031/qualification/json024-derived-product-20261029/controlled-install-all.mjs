import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {currentProductReader,resolveCurrentPackage} from '../../../../../scripts/current-lib-release-v3.mjs';
import {installCurrentLib} from '../../../../../scripts/lib-install.mjs';
import {sha} from '../../../../../scripts/lib-refresh-cache-v2.mjs';
const [root,out]=process.argv.slice(2).map(p=>resolve(p));
const read=currentProductReader(root),catalogBytes=read('catalog/libs-current-v2.json'),catalog=JSON.parse(catalogBytes),catalogSha=sha(catalogBytes);
assert.equal(catalog.package_authority_commit,'0'.repeat(40));assert.equal(catalog.packages.length,43);
const prefix='https://raw.githubusercontent.com/cbgroom/wasmcrelease/'+catalog.package_authority_commit+'/';
const expected=new Map(catalog.packages.flatMap(row=>row.files.map(file=>[file.path,file])));const seen=new Set();
const fetcher=async url=>{assert.ok(url.startsWith(prefix));const path=url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');const file=expected.get(path);assert.ok(file);const b=read(path);assert.equal(sha(b),file.sha256);seen.add(path);return new Response(b,{status:200});};
await mkdir(out);let count=0;const rows=[];
for(const row of catalog.packages){const lock=resolveCurrentPackage(catalogBytes,catalogSha,row,read),lb=Buffer.from(JSON.stringify(lock)),dest=join(out,row.id);
 const receipt=await installCurrentLib({catalogBytes,catalogSha256:catalogSha,lockBytes:lb,lockSha256:sha(lb),destination:dest},fetcher);
 for(const file of row.files){const b=await readFile(join(dest,file.path));assert.equal(b.length,file.bytes);assert.equal(sha(b),file.sha256);count++;}
 assert.equal(receipt.files_verified,row.files.length);rows.push({id:row.id,version:row.version,files:row.files.length});}
assert.equal(seen.size,expected.size);assert.equal(count,expected.size);const json=rows.find(row=>row.id==='wasmc-json');assert.equal(json.version,'0.2.4');
const result={status:'CONTROLLED_INSTALL_PASS_NOT_RELEASE',catalog_sha256:catalogSha,packages:rows.length,files:count,json,transport:'controlled local bytes, zero authority commit',formal_release:false};await writeFile(join(out,'receipt.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
