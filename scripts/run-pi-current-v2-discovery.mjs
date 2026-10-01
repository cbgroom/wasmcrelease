import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluateTraceText} from './wasmc-live-agent-trace-evaluation-v1.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=value=>createHash('sha256').update(value).digest('hex');
export const prompt=`You are a fresh Agent in a pinned public WAsmC checkout. First read AGENTS.md. Use only public consumer material in this checkout; do not read .agents/, private sources, history, previous sessions or external websites. This task is read-only: do not edit, install packages, publish or change Git state.
Determine the scope of this checkout, run its applicable development verification, and find a reusable Base64 decode API through the default Library-first discovery path. Read the selected public Skill/WIT and report exact package identity, API identity, package root, catalog digest, WIT digest and Core artifact digest. Determine whether CSV and system telemetry are selectable through the current default catalog. Do not treat search as selection approval or development validation as immutable release qualification.
Return one JSON object (not a code block) with keys checkout_scope (current-development or immutable-release), current_package_count (integer), backlog_count (integer), api_identity (string), root (string), catalog_sha256 (string), wit_sha256 (string), artifact_sha256 (string), selection_authority (boolean indicating whether the search grants selection approval), csv_current (boolean), telemetry_current (boolean), checks_run (array of commands actually executed), feedback (a short account of confusing guidance or friction, explicitly your opinion rather than authority). Stop when those facts are supported.`;

export function evaluateAnswer(report,catalogBytes,policyBytes){
  const failures=[];
  let answer;
  try{answer=JSON.parse(report.final_answer.text);}catch{failures.push('final-answer-not-json');}
  const catalog=JSON.parse(catalogBytes),policy=JSON.parse(policyBytes);
  const selected=catalog.packages.find(row=>row.id==='wasmc-std');
  const expected={checkout_scope:'current-development',current_package_count:catalog.packages.length,backlog_count:policy.rebuild_backlog_count,api_identity:'wasmc:std@1.4.0/base64#try-decode-standard',root:selected.root,catalog_sha256:sha(catalogBytes),wit_sha256:selected.wit_sha256,artifact_sha256:selected.artifact_sha256,selection_authority:false,csv_current:false,telemetry_current:false};
  if(answer)for(const [key,value] of Object.entries(expected))if(answer[key]!==value)failures.push('wrong-'+key);
  const commands=report.tool_calls.filter(call=>call.name==='bash').map(call=>call.arguments.command??'');
  if(!commands.some(command=>command.includes('scripts/validate-current-development.mjs')))failures.push('missing-development-check');
  if(!commands.some(command=>/scripts\/wasmc-lib\.mjs\s+search/.test(command)&&command.includes('base64')&&!command.includes('--catalog')))failures.push('missing-default-search');
  if(report.error_results||report.retries||report.parse_errors)failures.push('tool-or-provider-errors');
  if(report.reported_failure_results)failures.push('reported-command-failures');
  if(report.tool_calls.some(call=>/\.agents[\/\\]/.test(JSON.stringify(call.arguments))))failures.push('private-maintainer-read');
  if(!report.accepted)failures.push('trace-quality-gate');
  return {accepted:failures.length===0,failures,answer,expected};
}

async function main(){
  const options={};
  for(let index=2;index<process.argv.length;index+=2){
    assert(['--model','--commit','--out','--timeout-ms'].includes(process.argv[index]));
    options[process.argv[index]]=process.argv[index+1];
  }
  const model=options['--model'];
  assert(['llm-m4dd/deepseek-v4.1-flash','llm-m4dd/glm-5.3-flash'].includes(model));
  const commit=options['--commit'];assert.match(commit??'',/^[a-f0-9]{40}$/);
  const timeout=Number(options['--timeout-ms']??120000);assert(Number.isSafeInteger(timeout)&&timeout>=1000&&timeout<=300000);
  const output=resolve(options['--out']??join(root,'target/pi-current-v2',commit,model.split('/')[1]+'.json'));
  const temporary=await mkdtemp(join(tmpdir(),'wasmc-pi-current-v2-'));
  const checkout=join(temporary,'checkout');
  try{
    execFileSync('git',['clone','--quiet','--shared','--no-checkout',root,checkout]);
    execFileSync('git',['checkout','--quiet','--detach',commit],{cwd:checkout});
    const version=execFileSync('pi',['--version'],{encoding:'utf8'}).trim();
    const started=Date.now();let stdout='',stderr='',timedOut=false;
    const child=spawn('pi',['--model',model,'--no-session','--mode','json','--tools','read,grep,find,ls,bash','--no-skills','--no-prompt-templates','--no-extensions','--approve','-p',prompt],{cwd:checkout,stdio:['ignore','pipe','pipe']});
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},timeout);
    const status=await new Promise((resolvePromise,reject)=>{
      child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
      child.once('error',reject);child.once('close',resolvePromise);
    }).finally(()=>clearTimeout(timer));
    const trace=evaluateTraceText(stdout);
    const oracle=evaluateAnswer(trace,await readFile(join(checkout,'catalog/libs-current-v2.json')),await readFile(join(checkout,'catalog/current-v2-policy.json')));
    const checkoutUnchanged=execFileSync('git',['status','--porcelain'],{cwd:checkout,encoding:'utf8'}).trim()==='';
    const report={schema:'wasmc.pi-current-v2-observation/v1',protocol:'wasmc.current-discovery-observation/v2',scope:'single-development-discovery-case-not-release-qualification',checkout_commit:commit,runner_sha256:sha(await readFile(fileURLToPath(import.meta.url))),prompt_sha256:sha(prompt),agent:{implementation:'pi',version},model,process:{status,timed_out:timedOut,wall_ms:Date.now()-started,stderr_characters:stderr.length,stderr_sha256:sha(stderr)},checkout_unchanged:checkoutUnchanged,raw_trace_retained:false,hidden_reasoning_retained:false,oracle,trace,accepted:status===0&&!timedOut&&checkoutUnchanged&&oracle.accepted};
    await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({accepted:report.accepted,model,output,failures:oracle.failures,tool_calls:trace.tool_calls.length,error_results:trace.error_results,retries:trace.retries}));
    if(!report.accepted)process.exitCode=1;
  }finally{await rm(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await main();
