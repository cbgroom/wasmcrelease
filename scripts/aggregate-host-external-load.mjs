#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [inputArg,outputArg,previousArg]=process.argv.slice(2);
if(!inputArg||!outputArg)throw Error('usage: node scripts/aggregate-host-external-load.mjs INPUT OUTPUT [PREVIOUS.json]');
const root=process.cwd(),input=resolve(inputArg),output=resolve(outputArg);
const model=JSON.parse(await readFile(resolve(root,'release-surfaces.json'),'utf8'));
const baselinePolicy=JSON.parse(await readFile(resolve(root,'bench/host-external-load.json'),'utf8'));
const required=model.desktop_platforms.filter(row=>row.release_required).map(row=>row.id);
const files=(await readdir(input,{recursive:true})).filter(name=>name.endsWith('.json'));
const reports=[];
for(const name of files){
  const value=JSON.parse(await readFile(join(input,name),'utf8'));
  if(value.schema==='wasmc-host-external-load/v1')reports.push(value);
}
if(!reports.length)throw Error('no external-load reports');
reports.sort((a,b)=>a.platform.localeCompare(b.platform));
const commit=reports[0].commit;
if(reports.some(row=>row.commit!==commit))throw Error('mixed commits');
const present=new Set(reports.map(row=>row.platform));
for(const platform of required)if(!present.has(platform))throw Error('missing required external-load platform '+platform);

const median=values=>{
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length/2)];
};
const currentSummary=reports.map(report=>({
  platform:report.platform,
  cases:report.summary.map(row=>({
    lane:row.lane,workload:row.workload,connections:row.connections,
    rps:row.requests_per_sec.p50,
    p99_ms:row.latency_p99_ms.p50,
    prewarm_ms:row.prewarm_ms.p50,
    host_ops_per_request:row.host_ops_per_request?.p50??null,
  }))
}));
let history=[];
if(previousArg){
  try{
    const old=JSON.parse(await readFile(resolve(previousArg),'utf8'));
    if(old.schema==='wasmc-host-external-load-history/v1'&&Array.isArray(old.entries))history=old.entries;
  }catch{}
}
const prior=history.filter(entry=>entry.commit!==commit);
const keyOf=row=>[row.lane,row.workload,row.connections].join('|');
const baselines=currentSummary.map(platformRow=>{
  const priorPlatform=prior.flatMap(entry=>(entry.summary??[]).filter(row=>row.platform===platformRow.platform)).slice(-baselinePolicy.history.window);
  return {
    platform:platformRow.platform,
    cases:platformRow.cases.map(row=>{
      const key=keyOf(row);
      const historical=priorPlatform.flatMap(p=>(p.cases??[]).filter(old=>keyOf(old)===key));
      const rps=historical.map(old=>old.rps).filter(Number.isFinite);
      const p99=historical.map(old=>old.p99_ms).filter(Number.isFinite);
      const prewarm=historical.map(old=>old.prewarm_ms).filter(Number.isFinite);
      const rpsBase=rps.length?median(rps):null;
      const p99Base=p99.length?median(p99):null;
      const prewarmBase=prewarm.length?median(prewarm):null;
      const rpsRatio=rpsBase?row.rps/rpsBase:null;
      const p99Ratio=p99Base?row.p99_ms/p99Base:null;
      const prewarmRatio=prewarmBase?row.prewarm_ms/prewarmBase:null;
      const state=!historical.length?'bootstrap':
        (rpsRatio!==null&&rpsRatio<baselinePolicy.history.rps_regression_ratio)||(p99Ratio!==null&&p99Ratio>baselinePolicy.history.p99_regression_ratio)||(prewarmRatio!==null&&prewarmRatio>baselinePolicy.history.prewarm_regression_ratio)
          ?'advisory-regression':'within-baseline';
      return {
        lane:row.lane,workload:row.workload,connections:row.connections,state,
        history_samples:historical.length,
        rps:{current:row.rps,baseline:rpsBase,ratio:rpsRatio===null?null:Number(rpsRatio.toFixed(4))},
        p99_ms:{current:row.p99_ms,baseline:p99Base,ratio:p99Ratio===null?null:Number(p99Ratio.toFixed(4))},
        prewarm_ms:{current:row.prewarm_ms,baseline:prewarmBase,ratio:prewarmRatio===null?null:Number(prewarmRatio.toFixed(4))}
      };
    })
  };
});
const latest={
  schema:'wasmc-host-external-load-summary/v1',commit,measured_at:new Date().toISOString(),
  policy:{
    required_platforms:required,optional_platforms:model.desktop_platforms.filter(row=>!row.release_required).map(row=>row.id),
    timing:'same-platform advisory',
    baseline_schema:baselinePolicy.schema,
    history_window:baselinePolicy.history.window,
    rps_regression_ratio:baselinePolicy.history.rps_regression_ratio,
    latency_regression_ratio:baselinePolicy.history.p99_regression_ratio,
    prewarm_regression_ratio:baselinePolicy.history.prewarm_regression_ratio,
    hard_gate:baselinePolicy.history.hard_gate,
    hard_gates:baselinePolicy.hard_gates
  },
  platform_count:reports.length,baseline_policy:baselinePolicy,summary:currentSummary,relative_baselines:baselines,reports
};
history=prior;
history.push({commit,measured_at:latest.measured_at,summary:currentSummary});
history=history.slice(-100);
const historyDoc={schema:'wasmc-host-external-load-history/v1',entries:history};

const rows=[];
for(const platform of currentSummary){
  const baseline=baselines.find(x=>x.platform===platform.platform);
  for(const row of platform.cases){
    const b=baseline.cases.find(x=>keyOf(x)===keyOf(row));
    rows.push('| '+platform.platform+' | '+row.lane+' | '+row.workload+' | '+row.connections+
      ' | '+row.rps.toFixed(1)+' | '+row.p99_ms.toFixed(3)+' | '+row.prewarm_ms.toFixed(1)+
      ' | '+b.state+' | '+(b.rps.ratio===null?'-':b.rps.ratio.toFixed(2)+'x')+' |');
  }
}
const markdown=[
  '# WAsmC external HTTPS load',
  '',
  'Commit: '+commit,
  'Measured: '+latest.measured_at,
  'Required platforms: '+required.join(', '),
  '',
  '| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |',
  '|---|---|---|---:|---:|---:|---:|---|---:|',
  ...rows,
  '',
  'External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.',
  ''
].join('\n');
await mkdir(output,{recursive:true});
await writeFile(join(output,'latest.json'),JSON.stringify(latest,null,2)+'\n');
await writeFile(join(output,'history.json'),JSON.stringify(historyDoc,null,2)+'\n');
await writeFile(join(output,'latest.md'),markdown);
const regressions=baselines.flatMap(p=>p.cases.filter(row=>row.state==='advisory-regression').map(row=>p.platform+':'+keyOf(row)));
console.log(JSON.stringify({accepted:true,commit,platforms:reports.length,required_platforms:required.length,advisory_regressions:regressions}));
