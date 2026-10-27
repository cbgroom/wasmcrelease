import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [source,expected]=process.argv.slice(2);
assert.ok(source&&/^[a-f0-9]{64}$/.test(expected??''),'usage: test-current-composition-source-validation.mjs ASSEMBLED_ROOT ASSEMBLY_SHA256');
const workspace=mkdtempSync(join(tmpdir(),'wasmc-source-validation-'));
const validator=fileURLToPath(new URL('./validate-lib-refresh-v2-source.mjs',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const rows=[];
for(const name of ['valid','wrong-assembly-pin','source-projection-drift','input-inventory-drift']){
 const target=join(workspace,name),clone=spawnSync('cp',['-cR',resolve(source),target],{encoding:'utf8'});assert.equal(clone.status,0,clone.stderr);
 cpSync(validator,join(target,'scripts/validate-lib-refresh-v2-source.mjs'));
 if(name==='source-projection-drift'){const p=join(target,'libspec/wasmc-json/lib.json');writeFileSync(p,Buffer.concat([readFileSync(p),Buffer.from('\n')]));}
 if(name==='input-inventory-drift')writeFileSync(join(target,'admission/current-composition-inputs-v1/unselected-observation.txt'),'unselected\n');
 const args=['scripts/validate-lib-refresh-v2-source.mjs','--candidate-assembly-sha256',name==='wrong-assembly-pin'?'0'.repeat(64):expected];
 const result=spawnSync(process.execPath,args,{cwd:target,encoding:'utf8',timeout:120000});
 assert.equal(result.status===0,name==='valid',`${name}: ${result.stderr}`);
 if(name==='valid'){const report=JSON.parse(result.stdout);assert.equal(report.libs,43);assert.equal(report.projected_producer_sources,27);assert.equal(report.fresh_full_q0,false);}
 writeFileSync(join(target,'validation-result.json'),JSON.stringify({args,status:result.status,stdout:result.stdout,stderr:result.stderr},null,2)+'\n');
 rows.push({case:name,status:result.status,stdout_sha256:hash(Buffer.from(result.stdout)),stderr_sha256:hash(Buffer.from(result.stderr))});
}
console.log(JSON.stringify({accepted:true,assembly_sha256:expected,cases:rows,temporary_root:workspace,formal_release:false}));
