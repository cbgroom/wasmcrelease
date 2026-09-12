// Mechanical raw Git-object transport; detector set matches the source authority's
// high-confidence-credentials-v0 gate. Never print matches or match digests.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(process.argv[2]??'.');
const rawOnly=process.argv.includes('--raw-only');
const env={...process.env};
for(const k of Object.keys(env))if(/^GIT_(DIR|WORK_TREE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|REPLACE_REF_BASE|CONFIG.*|INDEX_FILE)$/.test(k))delete env[k];
env.GIT_NO_REPLACE_OBJECTS='1';env.GIT_CONFIG_NOSYSTEM='1';env.GIT_CONFIG_GLOBAL='/dev/null';
const git=(args,input)=>execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd:root,env,input,maxBuffer:67108864});
const refs=()=>git(['for-each-ref','--format=%(refname) %(objectname)','refs/heads','refs/remotes','refs/tags']);
const initial=refs();
if(!initial.length)throw Error('empty ref inventory');
const common=git(['rev-parse','--git-common-dir']).toString().trim();
if(existsSync(resolve(root,common,'objects/info/alternates')))throw Error('Git alternates are not admitted');
const ids=[...new Set(git(['rev-list','--objects','--all']).toString().trim().split('\n').map(x=>x.split(' ')[0]))].sort();
for(const id of ids)if(!/^[0-9a-f]{40}$/.test(id))throw Error('bad object identity');
const meta=git(['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],ids.join('\n')+'\n').toString().trim().split('\n');
if(meta.length!==ids.length)throw Error('incomplete object metadata');
const blobs=[];
for(let i=0;i<meta.length;i++){
 const [id,type,size]=meta[i].split(' ');if(id!==ids[i]||!/^\d+$/.test(size))throw Error('object framing mismatch');
 if(type==='blob')blobs.push({id,size:Number(size)});
}
const detectors=[
 ['private_key_pem',/-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
 ['github_token',/(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{82,255})/],
 ['openai_api_key',/(?:sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,255}|sk-[A-Za-z0-9]{32,255})/],
 ['aws_access_key_id',/(?:AKIA|ASIA|A3T[A-Z0-9]|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}/],
 ['google_api_key',/AIza[0-9A-Za-z_-]{35}/],
 ['slack_token',/xox[baprs]-[0-9A-Za-z-]{20,255}/],
 ['stripe_live_secret',/sk_live_[0-9A-Za-z]{20,255}/],
 ['npm_token',/npm_[A-Za-z0-9]{36,255}/],
 ['pypi_token',/pypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,255}/],
];
const child=spawn('git',['-c','core.hooksPath=/dev/null','cat-file','--batch'],{cwd:root,env,stdio:['pipe','pipe','inherit']});
const terminal=new Promise((res,rej)=>{child.once('error',rej);child.once('close',code=>code===0?res():rej(Error('cat-file failed')));});
const iter=child.stdout[Symbol.asyncIterator]();let pending=Buffer.alloc(0);
async function take(n){const parts=[];let left=n;while(left){if(!pending.length){const next=await iter.next();if(next.done)throw Error('truncated raw object');pending=next.value;}const k=Math.min(left,pending.length);parts.push(pending.subarray(0,k));pending=pending.subarray(k);left-=k;}return Buffer.concat(parts,n);}
async function line(){let s='';for(let i=0;i<256;i++){const b=(await take(1))[0];if(b===10)return s;s+=String.fromCharCode(b);}throw Error('oversized object header');}
const approvedObjects=new Set(['111e78b2bed5a9658cecb3660e547aee698b273b','1a12d7ae32eb35885f6f2cbf472d9f82f4252440']);
const approvedCompiler='8f79429d5499380d93abbb980df6c16a99adc15fee8987068906af11aa757027';
function classifyCarrier(id,text,pattern){
 if(rawOnly||!approvedObjects.has(id))return null;
 const blocks=[...text.matchAll(/function decodeEmbeddedCompiler\(\) \{\s*const binary = atob\("([A-Za-z0-9+/=]+)"\);/g)];
 if(blocks.length!==1)return null;
 const block=blocks[0],literal=block[1],start=block.index+block[0].indexOf(literal),end=start+literal.length;
 const hits=[...text.matchAll(new RegExp(pattern.source,'g'))];
 if(!hits.length||hits.some(h=>h.index<start||h.index+h[0].length>end))return null;
 const decoded=Buffer.from(literal,'base64');
 if(decoded.toString('base64')!==literal||createHash('sha256').update(decoded).digest('hex')!==approvedCompiler)return null;
 if(!WebAssembly.validate(decoded)||WebAssembly.Module.imports(new WebAssembly.Module(decoded)).length)return null;
 if(detectors.some(([,p])=>p.test(decoded.toString('latin1'))))return null;
 return {object:id,detector:'aws_access_key_id',raw_match_count:hits.length,classification:'verified-frozen-compiler-base64-false-positive',decoded_sha256:approvedCompiler,decoded_all_detectors_clear:true,authorization:'user explicit narrow remediation approval 2026-09-13'};
}
let bytes=0;const findings=[],rawFindings=[],classifiedFalsePositives=[];
try{
 for(const row of blobs){
  if(row.size>134217728)throw Error('object exceeds raw scan memory bound; admission fails without skipping');
  child.stdin.write(row.id+'\n');
  if(await line()!==`${row.id} blob ${row.size}`)throw Error('raw object identity drift');
  const raw=await take(row.size);if((await take(1))[0]!==10)throw Error('object terminator mismatch');
  bytes+=raw.length;const text=raw.toString('latin1');
  for(const [detector,pattern]of detectors)if(pattern.test(text)){
   const finding={object:row.id,detector};rawFindings.push(finding);
   const classified=detector==='aws_access_key_id'?classifyCarrier(row.id,text,pattern):null;
   if(classified)classifiedFalsePositives.push(classified);else findings.push(finding);
  }
 }
 child.stdin.end();await terminal;
}catch(e){child.kill();throw e;}
if(!refs().equals(initial))throw Error('refs changed during scan');
const sha=b=>createHash('sha256').update(b).digest('hex');
console.log(JSON.stringify({schema:'wasmc.reachable-credential-scan/v1',detector_set:'high-confidence-credentials-v0',accepted:findings.length===0,raw_only:rawOnly,reachable_objects:ids.length,scanned_blobs:blobs.length,raw_bytes:bytes,skipped_blobs:0,scan_errors:0,refs_sha256:sha(initial),objects_sha256:sha(ids.join('\n')+'\n'),raw_findings:rawFindings,classified_false_positives:classifiedFalsePositives,findings,scope:'all raw bytes scanned; only two exact approved frozen carriers classified after digest/format/import/decoded-nine-detector proof; not exhaustive secret-free proof'}));
if(findings.length)process.exitCode=1;
