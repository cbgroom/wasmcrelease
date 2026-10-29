import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedCurrentCatalog,currentProductReader,hash} from './current-lib-release-v3.mjs';
import {verifyMixedCurrentProduct} from './mixed-current-product-v1.mjs';
import {auditTaggedRoots} from './audit-tagged-root-identities-v1.mjs';

// Produce an unadmitted authority commit candidate from a clean published
// base. Published Roots are checked, never copied over or changed here.
export async function stageMixedRootAuthority({repo,base,product,catalogSha,oldSha,candidateSha,refsPath,refsSha}) {
  for(const p of [repo,product,refsPath])assert.ok(isAbsolute(p));assert.match(base,/^[0-9a-f]{40}$/);
  const git=(...args)=>execFileSync('git',args,{cwd:repo,maxBuffer:100*1024*1024,stdio:['ignore','pipe','pipe']});
  assert.equal(git('rev-parse','HEAD').toString().trim(),base,'exact base commit');
  assert.equal(git('status','--porcelain=v1','--untracked-files=all').toString(),'','clean isolated authority worktree');
  const closure=verifyMixedCurrentProduct(product,catalogSha,oldSha,candidateSha);assert.equal(closure.accepted,true);
  const tags=await auditTaggedRoots({repo,product,catalogSha,refsPath,refsSha});
  const read=currentProductReader(product),catalog=checkedCurrentCatalog(read('catalog/libs-current-v2.json'),catalogSha);
  const cohort=JSON.parse(read(catalog.cohort.path)),reused=new Set(cohort.reused.map(r=>r.id));
  const selected=catalog.packages.filter(r=>!reused.has(r.id));
  assert.deepEqual(selected.map(r=>r.id).sort(),tags.untagged_ids,'new identities must be absent from every audited tag');
  const files=[];
  for(const row of selected){
    try{git('cat-file','-e',`${base}:${row.root}`);assert.fail('Root already exists in base: '+row.root);}
    catch(e){if(e.code!=='ENOENT'&&e.status!==128)throw e;}
    for(const pin of [...row.files,...Object.values(row.source)]){
      const b=read(pin.path);assert.equal(b.length,pin.bytes);assert.equal(hash(b),pin.sha256);files.push({pin,b});
    }
  }
  assert.equal(new Set(files.map(x=>x.pin.path)).size,files.length,'distinct staged paths');
  for(const {pin,b} of files){const destination=join(repo,pin.path);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,b);}
  assert.equal(git('rev-parse','HEAD').toString().trim(),base);
  for(const {pin} of files){const b=await readFile(join(repo,pin.path));assert.equal(b.length,pin.bytes);assert.equal(hash(b),pin.sha256);}
  return {schema:'wasmc.mixed-root-authority-stage/v1',base,catalog_sha256:catalogSha,tag_listing_sha256:refsSha,
    package_ids:selected.map(r=>r.id),packages:selected.length,files:files.length,public_admission:false,release:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [repo,base,product,catalogSha,oldSha,candidateSha,refsPath,refsSha]=process.argv.slice(2);
  stageMixedRootAuthority({repo,base,product,catalogSha,oldSha,candidateSha,refsPath,refsSha}).then(r=>console.log(JSON.stringify(r)))
    .catch(e=>{console.error(e);process.exitCode=1;});
}
