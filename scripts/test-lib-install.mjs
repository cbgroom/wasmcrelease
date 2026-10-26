import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm,readdir,mkdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {hash,checkedCurrentCatalog,resolveCurrentPackage,currentProductReader} from './current-lib-release-v3.mjs';
import {installCurrentLib,artifactUrl} from './lib-install.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),catalogBytes=readFileSync(join(root,'catalog/libs-current-v2.json'));
const catalogSha256='e12684efb3e475ad551eddabda12bc4c196f19edb48e7ace9069fda1ef5e7871';
const catalog=checkedCurrentCatalog(catalogBytes,catalogSha256),row=catalog.packages.find(r=>r.id==='wasmc-std'),read=currentProductReader(root);
const lock=resolveCurrentPackage(catalogBytes,catalogSha256,{id:row.id,version:row.version,manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256},read),lockBytes=Buffer.from(JSON.stringify(lock));
const fixture=await mkdtemp(join(tmpdir(),'wasmc-current-install-'));let number=0,negativeTests=0;
const options=()=>({catalogBytes,catalogSha256,lockBytes,lockSha256:hash(lockBytes),destination:join(fixture,'case-'+number++),mirror:'github'});
const transport=async(url,opts)=>{assert.equal(opts.redirect,'manual');const base=artifactUrl('github',catalog.package_authority_commit,'');assert.ok(url.startsWith(base));return new Response(read(url.slice(base.length).split('/').map(decodeURIComponent).join('/')));};
const reject=async(opts,fetcher,code,message)=>{const before=await readdir(fixture);await assert.rejects(installCurrentLib(opts,fetcher),e=>e.code===code&&(message===undefined||e.message===message));assert.deepEqual(await readdir(fixture),before);negativeTests++;};
try{
 const good=options(),receipt=await installCurrentLib(good,transport);assert.equal(receipt.files_verified,row.files.length);assert.ok((await lstat(good.destination)).isSymbolicLink());
 assert.deepEqual(resolveCurrentPackage(catalogBytes,catalogSha256,lock,p=>readFileSync(join(good.destination,p))),lock);
 await reject({...options(),destination:good.destination},()=>assert.fail('must reject before fetch'),'install.destination_exists');
 await reject({...options(),lockSha256:'0'.repeat(64)},transport,'install.lock_identity_mismatch');
 await reject({...options(),mirror:'unapproved'},transport,'install.mirror_invalid');
 await reject(options(),async()=>new Response(null,{status:302}),'install.http_rejected',`install.http_rejected: HTTP 302 for ${row.files[0].path}`);
 await reject(options(),async()=>new Response(null,{status:404}),'install.http_rejected',`install.http_rejected: HTTP 404 for ${row.files[0].path}`);
 await reject(options(),async()=>{throw Error('transport');},'install.transport_failed');
 for(const thrown of [Object.assign(Error('transport'),{code:20}),Object.assign(Error('transport'),{code:null}),null,undefined,'transport',42]) {
  await reject(options(),async()=>{throw thrown;},'install.transport_failed');
 }
 await reject(options(),async(_url,{signal})=>{
  await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
  throw Object.assign(Error('aborted transport'),{code:20});
 },'install.timeout');
 await reject(options(),async()=>new Response(new Uint8Array(row.files[0].bytes+1)),'install.size_mismatch');
 await reject(options(),async()=>new Response(new Uint8Array(row.files[0].bytes)),'install.digest_mismatch');
 await reject(options(),async(url,opts)=>url.endsWith('/LICENSE')?new Response(new Uint8Array(row.files.find(f=>f.path.endsWith('/LICENSE')).bytes)):transport(url,opts),'install.digest_mismatch');
 const altered=Buffer.from(JSON.stringify({...lock,files:[]}));await reject({...options(),lockBytes:altered,lockSha256:hash(altered)},transport,'install.lock_metadata_drift');
 const race=options(),settled=await Promise.allSettled([installCurrentLib(race,transport),installCurrentLib(race,transport)]);assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);assert.equal(settled.find(r=>r.status==='rejected').reason.code,'install.destination_exists');
 const competing=options();let once=false;await assert.rejects(installCurrentLib(competing,async(url,opts)=>{if(!once){once=true;await mkdir(competing.destination);}return transport(url,opts);}),e=>e.code==='install.destination_exists');assert.deepEqual(await readdir(competing.destination),[]);
 assert.equal((await readdir(fixture)).filter(n=>n.startsWith('.')).length,2);
 console.log(JSON.stringify({accepted:true,files_verified:row.files.length,negative_tests:negativeTests,numeric_and_nonerror_transport_rejections:6,http_status_and_relative_path_verified:true,numeric_abort_maps_to_timeout:true,concurrent_single_winner:true,competing_directory_preserved:true,failed_stage_cleanup:true,network_access:false,companion_installed:false}));
}finally{await rm(fixture,{recursive:true});}
