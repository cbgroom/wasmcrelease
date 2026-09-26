import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, readdir, mkdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { repositoryRoot, sha256, resolveCatalog, packageReader, catalogAuthorities } from './lib-catalog.mjs';
import { installLib, artifactUrl } from './lib-install.mjs';
const catalogBytes=readFileSync(join(repositoryRoot,'catalog/libs-v009.json'));
const catalog=JSON.parse(catalogBytes),row=catalog.packages[0];
const lock=resolveCatalog(catalogBytes,{id:row.id,version:row.version,catalog_sha256:sha256(catalogBytes),wit_sha256:row.wit_sha256,artifact_sha256:row.artifact_sha256});
const lockBytes=Buffer.from(JSON.stringify(lock));const read=packageReader();
const fixture=await mkdtemp(join(tmpdir(),'wasmc-install-'));
let number=0;
const options=()=>({catalogBytes,lockBytes,lockSha256:sha256(lockBytes),destination:join(fixture,'case-'+number++),mirror:'github'});
const transport=async(url,opts)=>{
  assert.equal(opts.redirect,'manual');
  const base=artifactUrl('github',catalog.release_commit,'');
  assert.ok(url.startsWith(base));
  return new Response(read(url.slice(base.length).split('/').map(decodeURIComponent).join('/')));
};
const reject=async(opts,fetcher,code)=>{
  const before=await readdir(fixture);
  await assert.rejects(installLib(opts,fetcher),error=>error.code===code);
  assert.deepEqual(await readdir(fixture),before,'failed install leaves no published or staging files');
};
try{
  const good=options();const result=await installLib(good,transport);
  assert.equal(result.files_verified,row.files.length+1);
  assert.ok((await lstat(good.destination)).isSymbolicLink());
  assert.deepEqual(resolveCatalog(catalogBytes,lock,packageReader(good.destination)),lock);
  await reject({...options(),destination:good.destination},()=>{assert.fail('existing destination must reject before fetch');},'install.destination_exists');
  await reject({...options(),lockSha256:'0'.repeat(64)},transport,'install.lock_identity_mismatch');
  await reject({...options(),mirror:'unapproved'},transport,'install.mirror_invalid');
  await reject(options(),async()=>new Response(null,{status:302}),'install.http_rejected');
  await reject(options(),async()=>new Response(null,{status:404}),'install.http_rejected');
  await reject(options(),async()=>{throw Error('transport');},'install.transport_failed');
  await reject(options(),async()=>new Response(new Uint8Array(row.files[0].bytes+1)),'install.size_mismatch');
  await reject(options(),async()=>new Response(new Uint8Array(row.files[0].bytes)),'install.digest_mismatch');
  await reject(options(),async(url,opts)=>url.endsWith('/corelib.wasm')?new Response(new Uint8Array(row.companion.bytes)):transport(url,opts),'install.digest_mismatch');
  const altered=Buffer.from(JSON.stringify({...lock,files:[]}));
  await reject({...options(),lockBytes:altered,lockSha256:sha256(altered)},transport,'install.lock_metadata_drift');
  const race=options();const settled=await Promise.allSettled([installLib(race,transport),installLib(race,transport)]);
  assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(settled.find(r=>r.status==='rejected').reason.code,'install.destination_exists');
  assert.deepEqual(resolveCatalog(catalogBytes,lock,packageReader(race.destination)),lock);
  const competing=options();let once=false;
  await assert.rejects(installLib(competing,async(url,opts)=>{if(!once){once=true;await mkdir(competing.destination);}return transport(url,opts);}),error=>error.code==='install.destination_exists');
  assert.ok((await lstat(competing.destination)).isDirectory());
  assert.deepEqual(await readdir(competing.destination),[]);
  assert.equal((await readdir(fixture)).filter(name=>name.startsWith('.')).length,2,'only successful installs retain their backing directories');
  console.log(JSON.stringify({accepted:true,files_verified:row.files.length+1,negative_tests:10,concurrent_single_winner:true,competing_directory_preserved:true,failed_stage_cleanup:true,network_access:false}));
}finally{await rm(fixture,{recursive:true});}

const catalog013Bytes=readFileSync(join(repositoryRoot,'catalog/libs-v013.json'));
const catalog013=JSON.parse(catalog013Bytes);
const telemetry=catalog013.packages.find(row=>row.id==='wasmc-system-telemetry');
const lock013=resolveCatalog(catalog013Bytes,{
  id:telemetry.id,
  version:telemetry.version,
  catalog_sha256:sha256(catalog013Bytes),
  wit_sha256:telemetry.wit_sha256,
  artifact_sha256:telemetry.artifact_sha256,
},packageReader(),catalogAuthorities.v013);
const lock013Bytes=Buffer.from(JSON.stringify(lock013));
const fixture013=await mkdtemp(join(tmpdir(),'wasmc-install-v013-'));
const destination013=join(fixture013,'telemetry');
const read013=packageReader();
const transport013=async(url,opts)=>{
  assert.equal(opts.redirect,'manual');
  const base=artifactUrl('github',catalog013.release_commit,'');
  assert.ok(url.startsWith(base));
  return new Response(read013(url.slice(base.length).split('/').map(decodeURIComponent).join('/')));
};
try{
  const result=await installLib({
    catalogBytes:catalog013Bytes,
    catalogAuthority:catalogAuthorities.v013,
    lockBytes:lock013Bytes,
    lockSha256:sha256(lock013Bytes),
    destination:destination013,
    mirror:'github',
  },transport013);
  assert.equal(result.release_commit,catalog013.release_commit);
  assert.equal(result.id,'wasmc-system-telemetry');
  assert.equal(result.files_verified,telemetry.files.length);
  assert.deepEqual(
    resolveCatalog(catalog013Bytes,lock013,packageReader(destination013),catalogAuthorities.v013),
    lock013,
  );
  console.log(JSON.stringify({accepted:true,release:'v0.0.13',id:result.id,files_verified:result.files_verified,mocked_transport:true}));
}finally{await rm(fixture013,{recursive:true});}
