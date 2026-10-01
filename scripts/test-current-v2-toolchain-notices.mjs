#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,symlinkSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateToolchainNotices} from './current-v2-toolchain-notices.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const value=JSON.parse(readFileSync(join(root,'admission/current-v2-next/toolchain-notices/receipt.json')));
const result=validateToolchainNotices(value);let controls=0;
const reject=fn=>{const copy=structuredClone(value);fn(copy);assert.throws(()=>validateToolchainNotices(copy));controls++;};
reject(x=>x.distribution.url=x.distribution.url.replace('1.96.0','stable'));
reject(x=>x.distribution.sha256='0'.repeat(64));reject(x=>x.official_archive_verified=false);
reject(x=>x.installed_notices_match_distribution=false);reject(x=>x.full_transitive_license_audit=true);reject(x=>x.release_qualified=true);
reject(x=>x.build.packages.pop());reject(x=>x.build.toolchain.sha256='0'.repeat(64));
reject(x=>x.materials.pop());reject(x=>x.materials.reverse());
reject(x=>x.materials[0].path='../COPYRIGHT.html.gz');reject(x=>x.materials[0].installed_matches_official=false);
reject(x=>x.materials[0].archive_member=x.materials[0].archive_member.replace('rustc/','rust-docs/'));
reject(x=>x.materials[0].sha256='0'.repeat(64));reject(x=>x.materials[0].uncompressed_sha256='0'.repeat(64));
reject(x=>x.materials[0].bytes++);reject(x=>x.materials[0].uncompressed_bytes++);reject(x=>x.scope='all toolchain licenses fully audited');
reject(x=>x.extra_authority=true);reject(x=>x.materials[0].private_source='unexpected');
const fixture=mkdtempSync(join(tmpdir(),'wasmc-toolchain-notices-'));
try{
  for(const row of value.materials){const path=join(fixture,row.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,readFileSync(join(root,row.path)));}
  const receiptPath=join(fixture,'admission/current-v2-next/toolchain-notices/receipt.json');writeFileSync(receiptPath,JSON.stringify(value));
  validateToolchainNotices(value,fixture);
  const extra=join(dirname(receiptPath),'extra.rs');writeFileSync(extra,'extra source');assert.throws(()=>validateToolchainNotices(value,fixture));controls++;rmSync(extra);
  writeFileSync(receiptPath,'{}');assert.throws(()=>validateToolchainNotices(value,fixture));controls++;writeFileSync(receiptPath,JSON.stringify(value));
  rmSync(receiptPath);symlinkSync(join(root,'admission/current-v2-next/toolchain-notices/receipt.json'),receiptPath);assert.throws(()=>validateToolchainNotices(value,fixture));controls++;rmSync(receiptPath);writeFileSync(receiptPath,JSON.stringify(value));
  const row=value.materials[0],path=join(fixture,row.path),original=readFileSync(path);
  writeFileSync(path,Buffer.from('corrupted gzip'));assert.throws(()=>validateToolchainNotices(value,fixture));controls++;
  const replacement=gzipSync(Buffer.from('replacement license'));
  writeFileSync(path,replacement);const self=structuredClone(value);
  self.materials[0].sha256=createHash('sha256').update(replacement).digest('hex');self.materials[0].bytes=replacement.length;
  self.materials[0].uncompressed_sha256=createHash('sha256').update('replacement license').digest('hex');self.materials[0].uncompressed_bytes=19;
  assert.throws(()=>validateToolchainNotices(self,fixture));controls++;
  rmSync(path);assert.throws(()=>validateToolchainNotices(value,fixture));controls++;
  symlinkSync(join(root,row.path),path);assert.throws(()=>validateToolchainNotices(value,fixture));controls++;rmSync(path);writeFileSync(path,original);
  const folder=dirname(path);rmSync(folder,{recursive:true});symlinkSync(join(root,'admission/current-v2-next/toolchain-notices'),folder,'dir');
  assert.throws(()=>validateToolchainNotices(value,fixture));controls++;
}finally{rmSync(fixture,{recursive:true,force:true});}
console.log(JSON.stringify({...result,negative_controls:controls}));
