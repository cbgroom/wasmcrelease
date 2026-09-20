import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const js=(runtime,script,args=[],permissions=[])=>({command:runtime,args:runtime==='deno'?['run',...permissions,script,...args]:[script,...args]});
export function suiteCases(family,runtime='node',mirror='github') {
  if(!['node','bun','deno'].includes(runtime)||!['github','jsdelivr'].includes(mirror))throw Error('invalid CI matrix');
  const item=(id,script,args=[],permissions=['--allow-read'])=>({id,...js(runtime,script,args,permissions)});
  const fixturePermissions=['--allow-read','--allow-write','--allow-env=TMPDIR,TMP,TEMP'];
  if(family==='compatibility')return [
    item('core-feature-probes-and-negatives','scripts/test-core-compatibility.mjs'),
    item('catalog-exact-resolution','scripts/test-lib-catalog.mjs',[],fixturePermissions),
    item('install-no-clobber-and-faults','scripts/test-lib-install.mjs',[],fixturePermissions),
    item('compiler-expression-only','scripts/validate-current.mjs',['--compile-only'],['--allow-read','--allow-write','--allow-run','--allow-env'])
  ];
  if(family==='integrity')return [
    item('library-first-teaching-and-routes','scripts/test-library-first.mjs'),
    item('release-channel-promotion-negatives','scripts/test-release-channel.mjs'),
    item('release-product-identity','scripts/release-candidate.mjs',['verify','channels/candidates/0.0.11.json']),
    item('ci-reporting-failure-controls','scripts/test-ci-reporting.mjs'),
    {id:'maintainer-integrity-lib-agent-contracts',command:'bash',args:['scripts/validate-maintainer.sh']},
    item('agent-start-execution','examples/agent-start/run.mjs'),
    item('deterministic-fresh-agent-regression','scripts/wasmc-fresh-agent-evaluation-v0.mjs',['--release-root','.', '--json-out','target/ci/fresh-agent.json'])
  ];
  if(family==='runtime')return [
    {id:'source-free-archive-deployment',command:'bash',args:['scripts/validate-source-free-runtime.sh',runtime]},
    item('core-full-artifact-admission','scripts/check-core-compatibility.mjs'),
    item('core-feature-probes-and-negatives','scripts/test-core-compatibility.mjs'),
    item('catalog-exact-resolution','scripts/test-lib-catalog.mjs',[],fixturePermissions),
    item('install-no-clobber-and-faults','scripts/test-lib-install.mjs',[],fixturePermissions),
    item('fresh-mirror-install-and-paired-execution','scripts/validate-lib-install.mjs',[mirror],[...fixturePermissions,'--allow-run']),
    item('compiler-and-managed-regression','scripts/validate-current.mjs',[],['--allow-read','--allow-write','--allow-run','--allow-env']),
    item('standard-wasmc-rust-paired-execution','examples/current/standard.mjs')
  ];
  if(family==='security')return [
    item('credential-deleted-unknown-carrier-negatives','scripts/test-credential-scan.mjs'),
    item('credential-all-reachable-history','scripts/scan-reachable-credentials.mjs',['.'])
  ];
  if(family==='rust')return [
    {id:'lib-package-contracts',command:'node',args:['scripts/validate-libs.mjs']},
    {id:'wasmtime-component-consumer-tests',command:'cargo',args:['test','--locked','--release'],cwd:join(root,'examples/rust-wasmtime'),timeoutMs:1200000},
    {id:'wasmi-wasmtime-runtime-sdk-tests',command:'cargo',args:['test','--locked','--release','-p','wasmc-core-runtime'],timeoutMs:1200000},
    {id:'rust-generic-host-sdk-tests',command:'cargo',args:['test','--locked','--release','--manifest-path','sdk/wasmc-host/Cargo.toml'],timeoutMs:1200000},
    {id:'wasmtime-compiler-resource-host-execution',command:'cargo',args:['run','--locked','--release'],cwd:join(root,'examples/rust-wasmtime'),timeoutMs:300000}
  ];
  throw Error('unknown CI suite');
}

export function structuredObservation(stdout) {
  try{return JSON.parse(stdout.trim());}catch{}
  for(const line of stdout.trim().split('\n').reverse())try{return JSON.parse(line);}catch{}
  return null;
}
export async function runCase(test,logs) {
  const started=Date.now();let stdout='',stderr='',timedOut=false;
  const child=spawn(test.command,test.args,{cwd:test.cwd??root,env:process.env,stdio:['ignore','pipe','pipe']});
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},test.timeoutMs??180000);
  const code=await new Promise(resolve=>{
    child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
    child.once('error',error=>{stderr+='\n'+error.message;resolve(null);});
    child.once('close',resolve);
  });
  clearTimeout(timer);
  writeFileSync(join(logs,test.id+'.stdout.log'),stdout);
  writeFileSync(join(logs,test.id+'.stderr.log'),stderr);
  const observation=structuredObservation(stdout);
  const accepted=code===0&&!timedOut&&observation?.accepted!==false;
  const rustSummaries=[...stdout.matchAll(/test result: (\w+)\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out/g)].map(m=>({result:m[1],passed:+m[2],failed:+m[3],ignored:+m[4],measured:+m[5],filtered:+m[6]}));
  return {id:test.id,invocation:{command:test.command,args:test.args},accepted,exit_code:code,timed_out:timedOut,elapsed_ms:Date.now()-started,observation,rust_test_summaries:rustSummaries};
}
function escapeCell(value){return String(value).replaceAll('|','\\|').replaceAll('\n',' ');}
export function renderSuite(report) {
  return `## ${escapeCell(report.label)}\n\nSource: \`${report.source_commit}\`; ${report.platform}/${report.arch}.\n\n| Test | Result | ms |\n|---|---|---:|\n`+report.tests.map(t=>`| ${escapeCell(t.id)} | ${t.accepted?'PASS':'FAIL'} | ${t.elapsed_ms} |`).join('\n')+'\n\nResults are scoped behavioral evidence, not source-line coverage. Expected rejection tests count as PASS only when their assertions succeed.\n';
}
async function main() {
  const [family,runtime='node',mirror='github']=process.argv.slice(2);
  const label=process.env.WASMC_CI_LABEL??`${family}-${runtime}-${mirror}`;
  if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(label))throw Error('invalid CI report label');
  const logs=join(root,'target/ci',label);mkdirSync(logs,{recursive:true});
  const report={schema:'wasmc.public-ci-suite/v1',label,family,runtime,mirror,source_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),platform:process.platform,arch:process.arch,compiler_sha256:createHash('sha256').update(readFileSync(join(root,'current/wasmc_compiler.wasm'))).digest('hex'),runtime_version:null,tests:[],accepted:false};
  try {
    report.runtime_version=execFileSync(runtime,['--version'],{encoding:'utf8'}).trim();
    if(family==='rust')report.rust_toolchain={rustc:execFileSync('rustc',['--version'],{encoding:'utf8'}).trim(),cargo:execFileSync('cargo',['--version'],{encoding:'utf8'}).trim(),profile:'release',build_jobs:process.env.CARGO_BUILD_JOBS??null};
    if(process.env.GITHUB_ACTIONS==='true'&&report.dirty)throw Error('CI source is dirty');
    for(const test of suiteCases(family,runtime,mirror)) {
      const result=await runCase(test,logs);report.tests.push(result);
      console.log(`${result.accepted?'PASS':'FAIL'} ${result.id} (${result.elapsed_ms}ms)`);
    }
    report.accepted=report.tests.length>0&&report.tests.every(t=>t.accepted);
  }catch(error){report.error=error.message;}
  finally {
    writeFileSync(join(logs,'suite.json'),JSON.stringify(report,null,2)+'\n');
    const summary=renderSuite(report);writeFileSync(join(logs,'summary.md'),summary);
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  }
  if(!report.accepted)process.exitCode=1;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await main();
