import { lstat, realpath, mkdtemp, mkdir, open, symlink, rm } from 'node:fs/promises';
import { resolve, dirname, basename, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { sha256, selectCatalog, resolveCatalog, packageReader, catalogAuthorities } from './lib-catalog.mjs';

const fail = code => { throw Object.assign(new Error(code), {code}); };
const mirrors = Object.freeze({github:'https://raw.githubusercontent.com/cbgroom/wasmcrelease/',jsdelivr:'https://cdn.jsdelivr.net/gh/cbgroom/wasmcrelease@'});
export function artifactUrl(mirror, commit, path) {
  if (!Object.hasOwn(mirrors,mirror) || !/^[a-f0-9]{40}$/.test(commit)) fail('install.mirror_invalid');
  return mirrors[mirror]+commit+'/'+path.split('/').map(encodeURIComponent).join('/');
}
async function download(url, file, fetcher, totalSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  totalSignal.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,15000);
  let reader;
  try {
    if (totalSignal.aborted) fail('install.timeout');
    const response=await fetcher(url,{redirect:'manual',signal:controller.signal});
    if (response.status!==200 || response.redirected) fail('install.http_rejected');
    reader=response.body?.getReader();
    if (!reader) fail('install.body_missing');
    const chunks=[]; let bytes=0;
    for (;;) {
      const part=await reader.read(); if(part.done)break;
      bytes+=part.value.byteLength;
      if(bytes>file.bytes) fail('install.size_mismatch');
      chunks.push(part.value);
    }
    const result=Buffer.concat(chunks,bytes);
    if(bytes!==file.bytes)fail('install.size_mismatch');
    if(sha256(result)!==file.sha256)fail('install.digest_mismatch');
    return result;
  } catch(error) {
    if(error.code?.startsWith('install.'))throw error;
    fail(controller.signal.aborted?'install.timeout':'install.transport_failed');
  } finally {
    clearTimeout(timer);totalSignal.removeEventListener('abort',abort);
    try {await reader?.cancel();} catch {}
  }
}
// Private fetch injection is only for controlled transport/fault tests.
export async function installLib({catalogBytes,catalogAuthority=catalogAuthorities.v009,lockBytes,lockSha256,destination,mirror='github'},fetcher=globalThis.fetch) {
  if (!(lockBytes instanceof Uint8Array) || lockBytes.byteLength>262144 || !/^[a-f0-9]{64}$/.test(lockSha256??'') || sha256(lockBytes)!==lockSha256)fail('install.lock_identity_mismatch');
  let lock;
  try {lock=JSON.parse(lockBytes);}catch{fail('install.lock_invalid');}
  if(lock?.schema!=='wasmc.public-lib-lock/v1')fail('install.lock_invalid');
  const {catalog,row}=selectCatalog(catalogBytes,lock,catalogAuthority);
  artifactUrl(mirror,catalog.release_commit,'');
  const files=[...row.files,...(row.companion?[row.companion]:[])];
  if(files.reduce((sum,f)=>sum+f.bytes,0)>134217728)fail('install.budget_exceeded');
  if(typeof destination!=='string'||!destination)fail('install.destination_invalid');
  const requested=resolve(destination),parent=await realpath(dirname(requested));
  const target=join(parent,basename(requested));
  try {await lstat(target);fail('install.destination_exists');}catch(error){if(error.code!=='ENOENT')throw error;}
  const stage=await mkdtemp(join(parent,'.'+basename(target)+'.wasmc-'));
  const total=new AbortController();const timer=setTimeout(()=>total.abort(),120000);
  let published=false;
  try {
    for(const file of files){
      const data=await download(artifactUrl(mirror,catalog.release_commit,file.path),file,fetcher,total.signal);
      const path=join(stage,file.path);await mkdir(dirname(path),{recursive:true});
      const handle=await open(path,'wx',0o644);
      try{await handle.writeFile(data);await handle.sync();}finally{await handle.close();}
    }
    const verified=resolveCatalog(catalogBytes,lock,packageReader(stage),catalogAuthority);
    if(!isDeepStrictEqual(verified,lock))fail('install.lock_metadata_drift');
    const receipt={schema:'wasmc.public-lib-install/v1',lock_sha256:lockSha256,release_commit:catalog.release_commit,id:row.id,version:row.version,files_verified:files.length,mirror,publication:'exclusive-directory-symlink',authority_granted:false};
    const handle=await open(join(stage,'install-receipt.json'),'wx',0o644);
    try{await handle.writeFile(JSON.stringify(receipt,null,2)+'\n');await handle.sync();}finally{await handle.close();}
    // symlink creation is atomic and fails EEXIST; unlike directory rename it
    // cannot overwrite an empty destination created by a competing installer.
    if(total.signal.aborted)fail('install.timeout');
    try {await symlink(basename(stage),target,'dir');}catch(error){if(error.code==='EEXIST')fail('install.destination_exists');throw error;}
    published=true;
    return receipt;
  }finally{
    clearTimeout(timer);
    if(!published)await rm(stage,{recursive:true});
  }
}
