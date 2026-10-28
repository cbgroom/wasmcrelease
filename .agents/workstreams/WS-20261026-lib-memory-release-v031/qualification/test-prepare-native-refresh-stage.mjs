import assert from 'node:assert/strict';
import {appendFileSync,constants,cpSync,existsSync,lstatSync,mkdtempSync,readFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const [source,pin]=process.argv.slice(2),script=resolve(import.meta.dirname,'prepare-native-refresh-stage.mjs');
assert.ok(source&&/^[a-f0-9]{64}$/.test(pin??''));
const temp=mkdtempSync(join(tmpdir(),'wasmc-native-source-recovery-'));
const run=(r,p,out)=>spawnSync(process.execPath,[script,r,p,out],{encoding:'utf8',timeout:120000});
try {
  const bad=join(temp,'bad');assert.notEqual(run(resolve(source),'0'.repeat(64),bad).status,0);assert.equal(existsSync(bad),false);
  const out=join(temp,'valid'),first=run(resolve(source),pin,out);assert.equal(first.status,0,first.stderr);
  const receipt=JSON.parse(first.stdout);assert.equal(receipt.entries.length,20);
  assert.equal(new Set(receipt.entries.map(x=>x.id)).size,20);assert.equal(receipt.formal_release,false);
  const registry=JSON.parse(readFileSync(join(out,'libspec/registry.json')));assert.equal(registry.libs.length,20);
  assert.notEqual(run(resolve(source),pin,out).status,0,'must not replace existing output');
  const clone=join(temp,'tampered');cpSync(resolve(source),clone,{recursive:true,mode:constants.COPYFILE_FICLONE});
  const sourcePath=join(clone,'.agents/workstreams/WS-20261026-lib-memory-release-v031/candidate-sources/wasmc-system-file-prototype/0.1.0/platform/native-adapter.mjs');
  assert.equal(lstatSync(sourcePath).isFile(),true);assert.ok(realpathSync(sourcePath).startsWith(realpathSync(clone)+'/'));
  appendFileSync(sourcePath,'\n// source drift\n');const changed=join(temp,'changed');
  assert.notEqual(run(clone,pin,changed).status,0);assert.equal(existsSync(changed),false);
  console.log('PASS native recovery pins, 20 packages, no overwrite and tampered source rejection');
} finally {rmSync(temp,{recursive:true,force:true});}
