import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {hash,currentProductReader,resolveCurrentPackage} from '../../../scripts/current-lib-release-v3.mjs';
import {installCurrentLib,artifactUrl} from '../../../scripts/lib-install.mjs';
const state='/Users/youxianshi/.local/state/wasmc-maintenance/20261026-lib-memory-json-32';
const product=path.join(state,'authority-d489-assembled-v031'),out=path.join(state,'authority-d489-anonymous-json-install'),read=currentProductReader(product),catalogBytes=read('catalog/libs-current-v2.json'),catalogSha=hash(catalogBytes),catalog=JSON.parse(catalogBytes);
assert.equal(catalog.package_authority_commit,'d4890463e8043bcbb7abc40c371aeff75af25cb7');
const row=catalog.packages.find(r=>r.id==='wasmc-json');assert.equal(row.version,'0.2.0');assert.equal(row.manifest_sha256,'611e4b2eadb5c6e9b12ec5518aa22888a77d51f81e1ecc301c7fbd274a0c1d7c');
await fs.mkdir(out);const request={id:row.id,version:row.version,manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256},lock=resolveCurrentPackage(catalogBytes,catalogSha,request,read),lockBytes=Buffer.from(JSON.stringify(lock)+'\n');
const urls=new Set(row.files.map(f=>artifactUrl('github',catalog.package_authority_commit,f.path)));let downloads=0;
const fetcher=async url=>{assert.ok(urls.has(url),'unexpected download URL');const result=await fetch(url);assert.ok(result.ok,`HTTP ${result.status} ${url}`);downloads++;return result};
const destination=path.join(out,'installed');await installCurrentLib({catalogBytes,catalogSha256:catalogSha,lockBytes,lockSha256:hash(lockBytes),destination},fetcher);assert.equal(downloads,row.files.length);
const real=await fs.realpath(destination);for(const f of row.files){const b=await fs.readFile(path.join(real,f.path));assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256)}
const receipt={accepted:true,scope:'actual v2 installer, anonymous HTTPS from immutable public branch commit; catalog is a local release candidate',catalog_sha256:catalogSha,artifact_commit:catalog.package_authority_commit,package:row.id+'@'+row.version,manifest_sha256:row.manifest_sha256,installed_root:path.join(real,row.root),files_verified:downloads,formal_release:false};await fs.writeFile(path.join(out,'qualification.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
