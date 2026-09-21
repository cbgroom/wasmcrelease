#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const root=fileURLToPath(new URL('../',import.meta.url));
const exe=process.platform==='win32'?'.exe':'';
const baselinePolicy=JSON.parse(readFileSync(join(root,'bench/host-external-load.json'),'utf8'));
const oha=process.env.WASMC_OHA??'oha';
const duration=process.env.WASMC_HTTPS_LOAD_DURATION??baselinePolicy.duration;
const samples=Number(process.env.WASMC_HTTPS_LOAD_SAMPLES??baselinePolicy.samples);
const connections=(process.env.WASMC_HTTPS_LOAD_CONNECTIONS??baselinePolicy.connections.join(','))
  .split(',').map(value=>Number(value.trim())).filter(Number.isFinite);
if(!Number.isInteger(samples)||samples<1||samples>5)throw Error('WASMC_HTTPS_LOAD_SAMPLES must be 1..5');
if(!connections.length||connections.some(value=>!Number.isInteger(value)||value<1||value>64))throw Error('invalid connection matrix');

const wasmServer=join(root,'host/tests/https/target/release/wasmc-host-https-qualification'+exe);
const nativeServer=join(root,'host/tests/https/target/release/native-https-control'+exe);
const cert=join(root,'host/tests/https/fixtures/server-cert.der');
const key=join(root,'host/tests/https/fixtures/server-key.pkcs8.der');
const wasmArgs=[
  join(root,'host/tests/https/artifacts/tls-server-direct.wasm'),
  join(root,'host/tests/https/artifacts/http1-server.wasm'),
  join(root,'host/tests/https/artifacts/json.wasm'),
  join(root,'host/tests/https/artifacts/compression.wasm'),
  join(root,'host/tests/https/artifacts/router-policy.wasm'),
  cert,key,
];
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const platformId=process.env.WASMC_PLATFORM_ID??(process.platform+'-'+process.arch);

function shardsFor(c){return c<=1?1:Math.min(c,8);}
function percentile(values,q){
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.ceil(q*sorted.length)-1)];
}
function stats(values){
  return {samples:values.length,p50:Number(percentile(values,.5).toFixed(3)),p95:Number(percentile(values,.95).toFixed(3)),min:Number(Math.min(...values).toFixed(3)),max:Number(Math.max(...values).toFixed(3))};
}
async function startServer(lane,c){
  const native=lane==='native';
  const env={...process.env,WASMC_HTTPS_EXTERNAL_CONNECTIONS:String(c)};
  let command,args;
  if(native){
    command=nativeServer;args=[cert,key];
  }else{
    command=wasmServer;args=wasmArgs;
    env.WASMC_HTTPS_EXTERNAL_SERVER='1';
    env.WASMC_PROFILE_OPERATION_SAMPLE_EVERY='0';
    env.WASMC_HOST_REACTOR_SHARDS=String(shardsFor(c));
    if(lane==='wasmc-tls-native-http')env.WASMC_HTTPS_BENCH_NATIVE_HTTP='1';
    if(lane==='wasmc-full')env.WASMC_HTTPS_BENCH_REQUEST_COUNT_MODULO='100';
  }
  const started=process.hrtime.bigint();
  const child=spawn(command,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  const rl=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
  const stdoutClosed=new Promise(resolve=>rl.once('close',resolve));
  const lines=[];
  const ready=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error(lane+' c'+c+' readiness timeout\n'+stderr)),60000);
    child.once('error',reject);
    child.once('exit',code=>{if(!lines.some(line=>line.includes('"ready":true')))reject(Error(lane+' exited before ready code='+code+'\n'+stderr));});
    rl.on('line',line=>{
      lines.push(line);
      try{
        const value=JSON.parse(line);
        if(value.ready===true){clearTimeout(timer);resolve(value);}
      }catch{}
    });
  });
  const prewarmMs=Number(process.hrtime.bigint()-started)/1e6;
  return {child,rl,stdoutClosed,lines,stderr:()=>stderr,ready,prewarmMs};
}
async function finishServer(server,lane,c){
  const code=server.child.exitCode!==null
    ? server.child.exitCode
    : await new Promise(resolve=>server.child.once('exit',resolve));
  await server.stdoutClosed;
  if(code!==0)throw Error(lane+' c'+c+' server exit '+code+'\n'+server.stderr());
  const parsed=server.lines.flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
  const result=[...parsed].reverse().find(value=>value.accepted===true);
  if(!result)throw Error(lane+' c'+c+' missing server result\n'+server.stderr());
  return result;
}
function runOha(addr,c,workload){
  const args=['--insecure','--http-version','1.1','--no-tui','-c',String(c),'-z',duration,'-w','--output-format','json','-m',workload.method];
  if(workload.body!==null){
    args.push('-H','Content-Type: application/json','-d',workload.body);
  }
  args.push('https://'+addr+workload.path);
  const raw=execFileSync(oha,args,{cwd:root,encoding:'utf8',maxBuffer:32<<20});
  return JSON.parse(raw);
}
async function runCase(lane,c,workload){
  const server=await startServer(lane,c);
  let load;
  try{load=runOha(server.ready.addr,c,workload);}
  catch(error){server.child.kill();throw error;}
  const result=await finishServer(server,lane,c);
  if(load.summary?.successRate!==1)throw Error(lane+' '+workload.id+' c'+c+' load success rate '+load.summary?.successRate);
  const status=load.statusCodeDistribution??{};
  const unexpected=Object.keys(status).filter(code=>Number(code)!==workload.expectedStatus);
  if(unexpected.length)throw Error(lane+' '+workload.id+' c'+c+' unexpected status '+JSON.stringify(status));
  const requests=Number(result.requests);
  const hostOps=Number(result.host_operations??0);
  return {
    lane,workload:workload.id,connections:c,shards:lane==='native'?null:shardsFor(c),
    prewarm_ms:Number(server.prewarmMs.toFixed(3)),
    requests_per_sec:Number(load.summary.requestsPerSec),
    latency_ms:{
      p50:Number(load.metrics.latency_ms.p50),p95:Number(load.metrics.latency_ms.p95),
      p99:Number(load.metrics.latency_ms.p99),max:Number(load.metrics.latency_ms.max)
    },
    requests,status,
    host_operations:lane==='native'?null:hostOps,
    host_ops_per_request:lane==='native'?null:Number((hostOps/requests).toFixed(6)),
  };
}
const workloads={
  health:{id:'health',path:baselinePolicy.workloads.health.path,method:baselinePolicy.workloads.health.method,body:null,expectedStatus:baselinePolicy.workloads.health.expected_status},
  root_json:{id:'root-json',path:baselinePolicy.workloads['root-json'].path,method:baselinePolicy.workloads['root-json'].method,body:null,expectedStatus:baselinePolicy.workloads['root-json'].expected_status},
  post_json:{id:'post-json',path:baselinePolicy.workloads['post-json'].path,method:baselinePolicy.workloads['post-json'].method,body:baselinePolicy.workloads['post-json'].body,expectedStatus:baselinePolicy.workloads['post-json'].expected_status},
};
const cases=[];
for(let sample=0;sample<samples;sample++){
  for(const c of connections){
    cases.push({...await runCase('native',c,workloads.health),sample});
    cases.push({...await runCase('wasmc-tls-native-http',c,workloads.health),sample});
    cases.push({...await runCase('wasmc-full',c,workloads.health),sample});
    if(baselinePolicy.workloads['root-json'].connections.includes(c)){
      cases.push({...await runCase('wasmc-full',c,workloads.root_json),sample});
      cases.push({...await runCase('wasmc-full',c,workloads.post_json),sample});
    }
  }
}
const groups=new Map();
for(const row of cases){
  const key=[row.lane,row.workload,row.connections].join('|');
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row);
}
const summary=[...groups.entries()].map(([key,rows])=>{
  const [lane,workload,c]=key.split('|');
  return {
    lane,workload,connections:Number(c),samples:rows.length,
    requests_per_sec:stats(rows.map(row=>row.requests_per_sec)),
    prewarm_ms:stats(rows.map(row=>row.prewarm_ms)),
    latency_p50_ms:stats(rows.map(row=>row.latency_ms.p50)),
    latency_p95_ms:stats(rows.map(row=>row.latency_ms.p95)),
    latency_p99_ms:stats(rows.map(row=>row.latency_ms.p99)),
    host_ops_per_request:lane==='native'?null:stats(rows.map(row=>row.host_ops_per_request)),
  };
}).sort((a,b)=>a.connections-b.connections||a.lane.localeCompare(b.lane)||a.workload.localeCompare(b.workload));
const report={
  schema:'wasmc-host-external-load/v1',
  measured_at:new Date().toISOString(),commit:sourceCommit,platform:platformId,
  host:{os:process.platform,arch:process.arch,node:process.version,oha:execFileSync(oha,['--version'],{encoding:'utf8'}).trim()},
  policy:{
    external_client:true,steady_state_excludes_runtime_prewarm:true,
    full_workload_rate_limit_disabled_for_characterization:true,
    timing:'observational',functional_status_gate:'hard',baseline_schema:baselinePolicy.schema
  },
  identities:{
    wasm_server_sha256:sha(wasmServer),native_server_sha256:sha(nativeServer),
    tls_sha256:sha(wasmArgs[0]),http_sha256:sha(wasmArgs[1]),json_sha256:sha(wasmArgs[2]),
    compression_sha256:sha(wasmArgs[3]),router_sha256:sha(wasmArgs[4])
  },
  matrix:{connections,duration,samples},baseline_policy:baselinePolicy,summary,cases,accepted:true,
};
const output=process.argv[2]??'host-external-load.json';
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({accepted:true,platform:platformId,cases:cases.length,summary:summary.map(row=>({lane:row.lane,workload:row.workload,c:row.connections,rps_p50:row.requests_per_sec.p50,p99_ms_p50:row.latency_p99_ms.p50,prewarm_ms_p50:row.prewarm_ms.p50}))}));
