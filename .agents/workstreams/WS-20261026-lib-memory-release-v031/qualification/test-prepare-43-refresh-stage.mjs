import assert from 'node:assert/strict';
import {appendFileSync,constants,cpSync,existsSync,lstatSync,mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);assert.equal(args.length,5);
const script=resolve(import.meta.dirname,'prepare-43-refresh-stage.mjs'),temp=mkdtempSync(join(tmpdir(),'wasmc-43-stage-'));
const run=(a,out)=>spawnSync(process.execPath,[script,...a,out],{encoding:'utf8',timeout:120000});
try{
  const invalid=[...args];invalid[4]='0'.repeat(64);const bad=join(temp,'bad-pin');
  assert.notEqual(run(invalid,bad).status,0);assert.equal(existsSync(bad),false);
  const clone=join(temp,'modified-42');cpSync(args[2],clone,{recursive:true,mode:constants.COPYFILE_FICLONE});
  const changed=join(clone,'libspec/wasmc-json/delta.rs');assert.equal(lstatSync(changed).isFile(),true);assert.ok(realpathSync(changed).startsWith(realpathSync(clone)+'/'));
  appendFileSync(changed,'\n// changed source\n');const changedArgs=[...args];changedArgs[2]=clone;const changedOut=join(temp,'bad-source');
  assert.notEqual(run(changedArgs,changedOut).status,0);assert.equal(existsSync(changedOut),false);
  const out=join(temp,'good'),result=run(args,out);assert.equal(result.status,0,result.stderr);
  const receipt=JSON.parse(result.stdout);assert.equal(receipt.entries,43);assert.equal(receipt.formal_release,false);
  assert.notEqual(run(args,out).status,0);console.log('PASS 43-source stage, exact 42 receipt, source tamper and no-overwrite');
}finally{rmSync(temp,{recursive:true,force:true});}
