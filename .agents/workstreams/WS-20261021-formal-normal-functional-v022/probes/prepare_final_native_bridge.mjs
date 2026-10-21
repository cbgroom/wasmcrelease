import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdtempSync,readdirSync,lstatSync,rmSync,existsSync}from'node:fs';
import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{tmpdir}from'node:os';import{join}from'node:path';
const commit=process.argv[2],hash=b=>createHash('sha256').update(b).digest('hex'),git=(...a)=>execFileSync('git',a);
assert.match(commit,/^[0-9a-f]{40}$/);assert.equal(git('status','--porcelain').toString().trim(),'');assert.equal(git('rev-parse','HEAD').toString().trim(),commit);
const tree=git('rev-parse',commit+'^{tree}').toString().trim(),own='.agents/workstreams/WS-20261021-formal-normal-functional-v022';
const priorBytes=readFileSync(own+'/evidence/native-input-custody-v022.json'),prior=JSON.parse(priorBytes),actual='7fbdb6a450354dda20c9077a403b503db0ca7f1f';
assert.equal(prior.actual_build_source,actual);assert.equal(prior.inputs,27);const rows=prior.exact_unchanged_build_package_qualification_inputs;assert.equal(rows.length,27);
for(const row of rows){const before=git('show',actual+':'+row.path),after=git('show',commit+':'+row.path);assert.deepEqual(before,after,row.path);assert.equal(after.length,row.bytes);assert.equal(hash(after),row.sha256);}
const assets='target/release-v022-assets',prepared=JSON.parse(readFileSync(assets+'/native-assets-receipt.json'));assert.equal(prepared.assets.length,6);
const walk=(root,p='')=>readdirSync(join(root,p)).sort().flatMap(n=>{const f=p?p+'/'+n:n,s=lstatSync(join(root,f));assert.equal(s.isSymbolicLink(),false);return s.isDirectory()?walk(root,f):(assert.ok(s.isFile()),[f]);});
for(const asset of prepared.assets){const file=join(assets,asset.name),bytes=readFileSync(file);assert.equal(bytes.length,asset.bytes);assert.equal(hash(bytes),asset.sha256);
 const tmp=mkdtempSync(join(tmpdir(),'wasmc-v022-native-reopen-'));try{
  const names=execFileSync('tar',['-tzf',file],{encoding:'utf8'}).trim().split('\n');for(const n of names){assert.ok(!n.startsWith('/')&&!n.split('/').includes('..'));}
  execFileSync('tar',['-xzf',file,'-C',tmp]);const all=walk(tmp),manifests=all.filter(p=>p.endsWith('manifest.json'));assert.equal(manifests.length,1);
  const manifestPath=manifests[0],prefix=manifestPath.slice(0,-'manifest.json'.length),manifestBytes=readFileSync(join(tmp,manifestPath));assert.equal(hash(manifestBytes),asset.package_manifest_sha256);
  const m=JSON.parse(manifestBytes);assert.equal(m.source,actual);assert.equal(m.target,asset.target);assert.equal(m.compiler_sha256,prepared.compiler_sha256);assert.equal(m.schema,'wasmc-native-package/v3');
  assert.deepEqual(all.map(p=>p.slice(prefix.length)).sort(),[...Object.keys(m.files),'manifest.json'].sort());
  for(const[p,pin]of Object.entries(m.files)){const b=readFileSync(join(tmp,prefix,p));assert.equal(b.length,pin.bytes);assert.equal(hash(b),pin.sha256);}
 }finally{rmSync(tmp,{recursive:true,force:true});}
}
const receipt={schema:'wasmc.native-final-input-custody-bridge/v1',release_version:'0.0.22',final_release_commit:commit,final_release_tree:tree,actual_build_source:actual,actual_run:39560999862,
 actual_six_builds_and_six_matching_downloaded_consumers:'success',compiler_sha256:prepared.compiler_sha256,exact_unchanged_inputs:rows,input_count:27,
 original_custody_receipt_sha256:hash(priorBytes),six_archives_reopened:true,assets:prepared.assets,compiler_Lib_Native_rebuilds:0,
 scope:'Exact input equality and six archive inventories/digests. Actual build and final commit are distinct. Platform execution is the original six matching CI consumers; publication/downloads require separate observation.'};
const output=assets+'/Native-final-input-custody-bridge.json';assert.equal(existsSync(output),false);writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({accepted:true,actual_build_source:actual,final_commit:commit,input_count:27,archives:6,receipt_sha256:hash(readFileSync(output))}));
