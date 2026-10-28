import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyReleaseLicenseReceipt} from './lib-refresh-license-receipt-v1.mjs';
import {sha} from './lib-refresh-cache-v2.mjs';

function fixture(external=true) {
  const repo='/fixture/repo',dir=external?'/fixture/input':repo+'/licenses';
  const license=Buffer.from('explicit license\n'),notice=Buffer.from('original notice\n');
  const m=Buffer.from(JSON.stringify({schema:'wasmc.release-notices-input/v1',files:[{path:'licenses/NOTICE.txt',bytes:notice.length,sha256:sha(notice)}]}));
  const files=new Map([[dir+'/LICENSE',license],[dir+'/manifest.json',m],[dir+'/NOTICE.txt',notice]]);
  const source={},producer={};for(const [path,data] of files)(path.startsWith(repo+'/')?source:producer)[path.startsWith(repo+'/')?path.slice(repo.length+1):path]=sha(data);
  const receipt={release_license_input:{path:dir+'/LICENSE',sha256:sha(license)},release_notices_input:{path:dir+'/manifest.json',sha256:sha(m)},source_digests:source,producer_input_digests:producer};
  const read=async path=>{assert.ok(files.has(path),'fixture path');return files.get(path);};
  return {repo,dir,receipt,files,read};
}
test('external license and notice are independently replayed and captured',async()=>{const f=fixture();assert.deepEqual(await verifyReleaseLicenseReceipt(f.repo,f.receipt,f.read),f.receipt.producer_input_digests);});
test('repository-local release inputs do not enter external closure',async()=>{const f=fixture(false);assert.deepEqual(await verifyReleaseLicenseReceipt(f.repo,f.receipt,f.read),{});});
test('older unlicensed receipts remain valid',async()=>{assert.deepEqual(await verifyReleaseLicenseReceipt('/repo',{},async()=>{throw Error('unexpected read');}),{});});
test('missing license, changed snapshot and unbound digest reject',async()=>{
  let f=fixture();delete f.receipt.release_license_input;await assert.rejects(verifyReleaseLicenseReceipt(f.repo,f.receipt,f.read),/require a release license/);
  f=fixture();f.files.set(f.dir+'/NOTICE.txt',Buffer.from('mutated'));await assert.rejects(verifyReleaseLicenseReceipt(f.repo,f.receipt,f.read),/release input drift/);
  f=fixture();delete f.receipt.producer_input_digests[f.dir+'/NOTICE.txt'];await assert.rejects(verifyReleaseLicenseReceipt(f.repo,f.receipt,f.read),/receipt identity/);
});
