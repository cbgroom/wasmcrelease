import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {validateUpstreamReceipt} from './current-v2-upstream-provenance.mjs';
const receipt=JSON.parse(readFileSync('admission/current-v2-next/upstream/review.json'));
assert.equal(validateUpstreamReceipt(receipt).upstream_crates,7);
let rejected=0;
for(const mutation of [
  r=>r.groups[0].commit='0'.repeat(40),
  r=>r.groups[0].identity.artifact_sha256='0'.repeat(64),
  r=>r.groups[0].registry[0].archive_sha256='0'.repeat(64),
  r=>r.groups[0].identity.cargo_lock_sha256='0'.repeat(64),
  r=>r.groups[0].identity.adapter_sha256='0'.repeat(64),
  r=>r.groups[0].identity.adapter_license.upstream_license_override=true,
  r=>r.groups[1].registry[0].license='Apache-2.0',
  r=>r.groups[0].registry[0].source_matches_repository_commit=false,
  r=>r.groups[0].registry[0].notices=[],
  r=>r.groups[1].registry[0].notices.pop(),
  r=>r.groups[0].registry[0].notices[0].path='../../LICENSE',
  r=>r.groups[0].registry[0].notices[0].sha256='0'.repeat(64),
  r=>r.full_transitive_license_audit=true,
  r=>r.release_qualified=true,
  r=>r.groups.pop(),
]){
  const copy=structuredClone(receipt);mutation(copy);assert.throws(()=>validateUpstreamReceipt(copy));rejected++;
}
// Recoverable temporary fixtures, with actual notice bytes and linked-file rejection.
const temp=mkdtempSync(join(tmpdir(),'wasmc-upstream-negative-'));
for(const group of receipt.groups)for(const crate of group.registry)for(const notice of crate.notices){
  const path=join(temp,notice.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,readFileSync(notice.path));
}
assert.equal(validateUpstreamReceipt(receipt,temp).accepted,true);
const first=receipt.groups[0].registry[0].notices[0];
writeFileSync(join(temp,first.path),'tampered notice');assert.throws(()=>validateUpstreamReceipt(receipt,temp));rejected++;
writeFileSync(join(temp,first.path),readFileSync(first.path));
const linked=mkdtempSync(join(tmpdir(),'wasmc-upstream-linked-'));
mkdirSync(dirname(join(linked,first.path)),{recursive:true});symlinkSync(join(temp,first.path),join(linked,first.path));
assert.throws(()=>validateUpstreamReceipt(receipt,linked));rejected++;
const linkedDir=mkdtempSync(join(tmpdir(),'wasmc-upstream-linked-dir-'));
mkdirSync(dirname(dirname(join(linkedDir,first.path))),{recursive:true});
symlinkSync(dirname(join(temp,first.path)),dirname(join(linkedDir,first.path)));
assert.throws(()=>validateUpstreamReceipt(receipt,linkedDir));rejected++;
console.log(JSON.stringify({accepted:true,negative_cases:rejected,upstream_crates:7,full_transitive_license_audit:false}));
