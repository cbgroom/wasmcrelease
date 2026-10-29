// Public candidate installation qualification. The independent mixed catalog
// is checked first; download remains through the real installer, not a fixture.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentProductPaths, currentProductReader, resolveCurrentPackage } from './current-lib-release-v3.mjs';
import { verifyMixedFromCatalog } from './mixed-current-product-v1.mjs';
import { installCurrentLib } from './lib-install.mjs';
import { sha } from './lib-refresh-cache-v2.mjs';

export async function installMixedNetworkCohort({product,catalogSha,out,previousPath,previousSha,previousParent}) {
  for(const p of [product,out,previousPath,previousParent])assert.ok(isAbsolute(p));
  for(const h of [catalogSha,previousSha])assert.match(h,/^[0-9a-f]{64}$/);
  const read=currentProductReader(product),catalogBytes=read('catalog/libs-current-v2.json');
  const closure=verifyMixedFromCatalog(catalogBytes,catalogSha,read,currentProductPaths(product));assert.equal(closure.accepted,true);
  const catalog=JSON.parse(catalogBytes);assert.notEqual(catalog.package_authority_commit,'0'.repeat(40));
  const previousBytes=await readFile(previousPath);assert.equal(sha(previousBytes),previousSha,'previous receipts pin');
  const previous=JSON.parse(previousBytes);assert.equal(previous.schema,'wasmc.mixed-network-install/v1');assert.equal(previous.accepted,true);
  const prior=new Map(previous.results.map(r=>[r.id,r]));assert.equal(prior.size,previous.results.length);
  for(const r of previous.results){assert.equal(r.catalog_sha256,catalogSha);assert.equal(r.artifact_commit,catalog.package_authority_commit);}
  await mkdir(out);await mkdir(join(out,'packages'));await mkdir(join(out,'results'));
  const rows=[],queue=[...catalog.packages];
  async function worker() {
    for (;;) {
      const row=queue.shift();if(!row)return;
      const lock=resolveCurrentPackage(catalogBytes,catalogSha,row,read),lockBytes=Buffer.from(JSON.stringify(lock)),lockSha=sha(lockBytes);
      const reused=prior.has(row.id),destination=reused?join(previousParent,`mixed-network-installed-${row.id}-20261029`):join(out,'packages',row.id);
      try{
        const receipt=reused?prior.get(row.id):await installCurrentLib({catalogBytes,catalogSha256:catalogSha,
          lockBytes,lockSha256:lockSha,destination,mirror:'github'});
        assert.equal(receipt.id,row.id);assert.equal(receipt.version,row.version);assert.equal(receipt.lock_sha256,lockSha);
        assert.equal(receipt.catalog_sha256,catalogSha);assert.equal(receipt.artifact_commit,catalog.package_authority_commit);
        assert.equal(receipt.files_verified,row.files.length);
        for(const f of row.files){const b=await readFile(join(destination,f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
        const result={id:row.id,version:row.version,accepted:true,reused,files:row.files.length,
          manifest_sha256:row.manifest_sha256,lock_sha256:lockSha,receipt};
        await writeFile(join(out,'results',row.id+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});rows.push(result);
        console.error(JSON.stringify({id:row.id,accepted:true,reused,files:row.files.length}));
      }catch(e){const result={id:row.id,version:row.version,accepted:false,reused,code:e.code??null,error:e.message};
        await writeFile(join(out,'results',row.id+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});rows.push(result);
        console.error(JSON.stringify(result));}
    }
  }
  await Promise.all(Array.from({length:4},worker));rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const summary={schema:'wasmc.mixed-network-cohort-install/v1',accepted:rows.length===catalog.packages.length&&rows.every(r=>r.accepted),
    catalog_sha256:catalogSha,artifact_commit:catalog.package_authority_commit,roots:rows.length,
    files:rows.reduce((n,r)=>n+(r.files??0),0),reused:rows.filter(r=>r.reused&&r.accepted).length,
    transport:'anonymous GitHub raw at full commit',rows,public_admission:false,formal_release:false};
  await writeFile(join(out,'receipt.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [product,catalogSha,out,previousPath,previousSha,previousParent]=process.argv.slice(2);
  installMixedNetworkCohort({product,catalogSha,out,previousPath,previousSha,previousParent})
    .then(r=>{console.log(JSON.stringify({accepted:r.accepted,roots:r.roots,files:r.files,reused:r.reused}));if(!r.accepted)process.exitCode=1;})
    .catch(e=>{console.error(e);process.exitCode=1;});
}
