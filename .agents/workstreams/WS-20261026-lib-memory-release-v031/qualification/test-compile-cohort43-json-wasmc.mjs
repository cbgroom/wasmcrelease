import assert from 'node:assert/strict';
import {appendFileSync,constants,cpSync,existsSync,lstatSync,mkdtempSync,readFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const [root,oldRoot,fixture,compiler,reference]=process.argv.slice(2);assert.ok([root,oldRoot,fixture,compiler,reference].every(Boolean));
const tool=resolve(import.meta.dirname,'compile-cohort43-json-wasmc.mjs'),tmp=mkdtempSync(join(tmpdir(),'wasmc-json43-compile-'));
const run=(r,o)=>spawnSync(process.execPath,[tool,r,oldRoot,fixture,compiler,o],{encoding:'utf8',timeout:120000});
try{
 const copy=join(tmp,'tampered');cpSync(root,copy,{recursive:true,mode:constants.COPYFILE_FICLONE});
 const artifact=join(copy,'artifact.wasm');assert.ok(lstatSync(artifact).isFile());assert.ok(realpathSync(artifact).startsWith(realpathSync(copy)+'/'));
 appendFileSync(artifact,Buffer.from([0]));const bad=join(tmp,'bad');assert.notEqual(run(copy,bad).status,0);assert.equal(existsSync(bad),false);
 const out=join(tmp,'ok'),valid=run(root,out);assert.equal(valid.status,0,valid.stderr);assert.equal(JSON.parse(valid.stdout).accepted,true);
 assert.deepEqual(readFileSync(join(out,'frame.bin')),readFileSync(join(reference,'frame.bin')));
 assert.deepEqual(readFileSync(join(out,'app.wasm')),readFileSync(join(reference,'app.wasm')));
 assert.notEqual(run(root,out).status,0);console.log('PASS WAsmC JSON compile: tamper rejection, byte-identical replay and no-overwrite');
}finally{rmSync(tmp,{recursive:true,force:true});}
