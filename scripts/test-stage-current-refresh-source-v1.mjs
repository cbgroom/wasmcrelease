import assert from 'node:assert/strict';
import {appendFileSync,cpSync,existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const [snapshot,snapshotPin,receipt,receiptPin]=process.argv.slice(2);
assert.equal(process.argv.length,6);const script=resolve(import.meta.dirname,'stage-current-refresh-source-v1.mjs');
const temp=mkdtempSync(join(tmpdir(),'current-refresh-snapshot-'));
const run=(a,out)=>spawnSync(process.execPath,[script,...a,out],{encoding:'utf8',timeout:120000});
try {
 const args=[snapshot,snapshotPin,receipt,receiptPin],out=join(temp,'good'),good=run(args,out);
 assert.equal(good.status,0,good.stderr);assert.equal(JSON.parse(good.stdout).source_files,183);
 const manifest=JSON.parse(readFileSync(join(snapshot,'snapshot.json')));
 for(const path of Object.keys(manifest.source_digests))assert.deepEqual(readFileSync(join(out,path)),readFileSync(join(snapshot,path)));
 assert.notEqual(run(args,out).status,0,'existing output must fail');
 for(const i of [1,3]) {const bad=[...args];bad[i]='0'.repeat(64);const target=join(temp,'bad-'+i);
  assert.notEqual(run(bad,target).status,0);assert.equal(existsSync(target),false);}
 const clone=join(temp,'changed');cpSync(snapshot,clone,{recursive:true});
 appendFileSync(join(clone,'libspec/wasmc-json/delta.rs'),'\n// changed\n');
 const bad=[...args];bad[0]=clone;const target=join(temp,'bad-source');
 assert.notEqual(run(bad,target).status,0);assert.equal(existsSync(target),false);
 console.log(JSON.stringify({accepted:true,source_files:183,byte_equal:true,wrong_pins_rejected:true,source_tamper_rejected:true,no_overwrite:true,formal_release:false}));
} finally {rmSync(temp,{recursive:true,force:true});}
