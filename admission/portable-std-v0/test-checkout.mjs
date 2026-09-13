import assert from 'node:assert/strict';
import {mkdtempSync,copyFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const dir=mkdtempSync(join(tmpdir(),'wasmc-byte-checkout-'));
const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
try {
  git('init','-q');
  git('config','core.autocrlf','false');
  copyFileSync(new URL('package/SKILL.md',import.meta.url),join(dir,'SKILL.md'));
  const expected=sha(readFileSync(join(dir,'SKILL.md')));
  git('add','SKILL.md');
  git('config','core.autocrlf','true');
  git('checkout-index','--prefix=control/','--all');
  assert.notEqual(sha(readFileSync(join(dir,'control/SKILL.md'))),expected);
  copyFileSync(new URL('../../.gitattributes',import.meta.url),join(dir,'.gitattributes'));
  git('add','.gitattributes');
  git('checkout-index','--prefix=corrected/','--all');
  assert.equal(sha(readFileSync(join(dir,'corrected/SKILL.md'))),expected);
  console.log(JSON.stringify({accepted:true,crlf_checkout_control_reproduced:true,attributes_preserve_exact_bytes:true,sha256:expected}));
} finally {
  // Only the newly created, bounded test repository; no shared checkout/cache.
  rmSync(dir,{recursive:true,force:true});
}
