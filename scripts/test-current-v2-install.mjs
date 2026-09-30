import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installLib,artifactUrl} from './lib-install.mjs';
import {catalogAuthorities,packageReader,parseCatalog,resolveCatalog,sha256,repositoryRoot} from './lib-catalog.mjs';
const live=process.argv.includes('--live');
assert(process.argv.slice(2).every(arg=>arg==='--live'));
const bytes=await readFile(join(repositoryRoot,'catalog/libs-current-v2.json'));
const authority=catalogAuthorities.currentV2;
const catalog=parseCatalog(bytes,authority);
const staging=await mkdtemp(join(tmpdir(),'wasmc-current-v2-install-'));
const reader=packageReader();
const controlled=async url=>{
  const prefix=artifactUrl('github',authority.release_commit,'');
  assert(url.startsWith(prefix));
  const path=url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
  return new Response(reader(path));
};
try {
  const receipts=[];
  for(const row of catalog.packages){
    const lock=resolveCatalog(bytes,{id:row.id,version:row.version,catalog_sha256:sha256(bytes),wit_sha256:row.wit_sha256,artifact_sha256:row.artifact_sha256},reader,authority);
    const lockBytes=Buffer.from(JSON.stringify(lock));
    const args={catalogBytes:bytes,catalogAuthority:authority,lockBytes,lockSha256:sha256(lockBytes),destination:join(staging,row.id),mirror:'github'};
    const receipt=await installLib(args,live?globalThis.fetch:controlled);
    assert.deepEqual(resolveCatalog(bytes,lock,packageReader(args.destination),authority),lock);
    await assert.rejects(()=>installLib(args,controlled),error=>error.code==='install.destination_exists');
    await assert.rejects(()=>installLib({...args,destination:join(staging,row.id+'-tampered')},async()=>new Response('altered')),error=>error.code==='install.size_mismatch'||error.code==='install.digest_mismatch');
    assert(!(await readdir(staging)).some(name=>name.includes('-tampered')));
    receipts.push(receipt);
  }
  console.log(JSON.stringify({accepted:true,network_access:live,mirror:live?'github':'controlled',packages:receipts.length,no_clobber_controls:receipts.length,tamper_controls:receipts.length,receipts}));
}finally{await rm(staging,{recursive:true,force:true});}
