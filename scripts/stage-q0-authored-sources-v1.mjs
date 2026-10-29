import assert from 'node:assert/strict';
import {lstat,mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha} from './lib-refresh-cache-v2.mjs';

// Stage only already-pinned public Lib authoring inputs. Private upstream
// modules and compiler source are not copied from the generated workspace.
export async function stageQ0AuthoredSources({repo,sourceRoot,receiptPath,receiptSha}) {
  for(const p of [repo,sourceRoot,receiptPath])assert.ok(isAbsolute(p));assert.match(receiptSha,/^[0-9a-f]{64}$/);
  assert.equal(await realpath(sourceRoot),sourceRoot);const receiptBytes=await readFile(receiptPath);
  assert.equal(sha(receiptBytes),receiptSha,'Q0 receipt pin');const receipt=JSON.parse(receiptBytes);
  assert.equal(receipt.schema,'wasmc.lib-refresh-receipt/v2');assert.equal(receipt.accepted,true);
  const pins=Object.entries(receipt.source_digests).filter(([p])=>p.startsWith('libspec/'));assert.ok(pins.length>0);
  const files=[];for(const [path,pin] of pins){assert.ok(path.split('/').every(x=>x&&x!=='.'&&x!=='..'));
    assert.match(pin,/^[0-9a-f]{64}$/);const source=join(sourceRoot,path);
    assert.ok(source.startsWith(sourceRoot+sep));assert.ok((await lstat(source)).isFile());assert.equal(await realpath(source),source);
    const b=await readFile(source);assert.equal(sha(b),pin,'Q0 authored input drift: '+path);files.push({path,pin,b});}
  let changed=0;
  for(const f of files){const target=join(repo,f.path);let old;try{old=await readFile(target)}catch(e){if(e.code!=='ENOENT')throw e;}
    if(!old||!old.equals(f.b)){await mkdir(dirname(target),{recursive:true});await writeFile(target,f.b);changed++;}}
  for(const f of files)assert.equal(sha(await readFile(join(repo,f.path))),f.pin);
  assert.equal(sha(await readFile(receiptPath)),receiptSha,'Q0 receipt changed');
  return {schema:'wasmc.q0-authored-source-stage/v1',receipt_sha256:receiptSha,files:files.length,changed,
    source_prefix:'libspec/',private_upstream_copied:false,public_admission:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [repo,sourceRoot,receiptPath,receiptSha]=process.argv.slice(2);
  stageQ0AuthoredSources({repo,sourceRoot,receiptPath,receiptSha}).then(r=>console.log(JSON.stringify(r)))
    .catch(e=>{console.error(e);process.exitCode=1;});
}
