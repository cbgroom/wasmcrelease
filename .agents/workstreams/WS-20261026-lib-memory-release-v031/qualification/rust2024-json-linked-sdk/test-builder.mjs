import assert from 'node:assert/strict';
import {mkdtempSync, cpSync, readFileSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const [sdk,root,wrongRoot,expectedSdk,expectedRoot] = process.argv.slice(2);
assert.ok(sdk && root && wrongRoot);
assert.ok((expectedSdk && expectedRoot) || (!expectedSdk && !expectedRoot));
const script=fileURLToPath(new URL('./build-linked-sdk.mjs',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'wasmc-linked-sdk-'));
const run=(source,selected,out)=>spawnSync(process.execPath,[script,source,selected,out,...(expectedSdk?[expectedSdk,expectedRoot]:[])],{encoding:'utf8'});
try {
  const a=join(temp,'a'),b=join(temp,'b');
  for(const out of [a,b]) { const r=run(sdk,root,out); assert.equal(r.status,0,r.stderr); }
  assert.deepEqual(readFileSync(join(a,'src/lib.rs')),readFileSync(join(b,'src/lib.rs')));
  assert.deepEqual(readFileSync(join(a,'sdk.json')),readFileSync(join(b,'sdk.json')));
  const corrupted=join(temp,'corrupted');cpSync(sdk,corrupted,{recursive:true});
  const source=join(corrupted,'src/lib.rs');writeFileSync(source,Buffer.concat([readFileSync(source),Buffer.from('\n// changed\n')]));
  const noSdk=join(temp,'bad-sdk');const badSdk=run(corrupted,root,noSdk);
  assert.notEqual(badSdk.status,0);assert.ok(!existsSync(noSdk));
  const noRoot=join(temp,'bad-root');const badRoot=run(sdk,wrongRoot,noRoot);
  assert.notEqual(badRoot.status,0);assert.ok(!existsSync(noRoot));
  const badMeta=join(temp,'corrupted-metadata');cpSync(sdk,badMeta,{recursive:true});
  const metaPath=join(badMeta,'sdk.json'),meta=JSON.parse(readFileSync(metaPath));
  meta.original_sdk_sha256='0'.repeat(64);writeFileSync(metaPath,JSON.stringify(meta));
  const noMeta=join(temp,'bad-predecessor');const badPredecessor=run(badMeta,root,noMeta);
  assert.notEqual(badPredecessor.status,0);assert.ok(!existsSync(noMeta));
  const noPin=join(temp,'bad-independent-pin');
  const badPin=spawnSync(process.execPath,[script,sdk,root,noPin,'0'.repeat(64),meta.root_manifest_sha256],{encoding:'utf8'});
  assert.notEqual(badPin.status,0);assert.ok(!existsSync(noPin));
  const noPair=join(temp,'missing-root-pin');
  const badPair=spawnSync(process.execPath,[script,sdk,root,noPair,meta.sdk_sha256],{encoding:'utf8'});
  assert.notEqual(badPair.status,0);assert.ok(!existsSync(noPair));
  console.log(JSON.stringify({accepted:true,independent_rebuild_byte_equal:true,changed_sdk_rejected:true,wrong_root_rejected:true,wrong_predecessor_rejected:true,wrong_independent_pin_rejected:true,incomplete_pin_pair_rejected:true,no_output_on_rejection:true}));
} finally {rmSync(temp,{recursive:true,force:true});}
