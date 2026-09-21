import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root=process.cwd();
const temp=mkdtempSync(join(tmpdir(),'wasmc-perf-baseline-'));
const input=join(temp,'input');
const output=join(temp,'output');
mkdirSync(input);

function report(platform,commit,value){
  const stats={samples:5,p50_ms:value,p95_ms:value,min_ms:value,max_ms:value};
  return {
    schema:'wasmc-native-cli-performance/v1',
    measured_at:'2026-09-21T00:00:00.000Z',
    commit,
    platform,
    host:{os:'test',arch:'test',node:process.version},
    cli:{bytes:100,sha256:'0'.repeat(64)},
    corpus_schema:'wasmc-public-benchmark-corpus/v1',
    policy:'test',
    cases:{
      small_scalar:{
        build_wasm:stats,
        native_build_miss:stats,
        native_build_hit:stats,
        run_wasmi:stats,
        native_run:stats
      }
    }
  };
}

try{
  writeFileSync(join(input,'linux.json'),JSON.stringify(report('linux-x86_64','c'.repeat(40),12)));
  const history={
    schema:'wasmc-public-performance-history/v1',
    entries:[
      {
        commit:'a'.repeat(40),
        measured_at:'2026-09-19T00:00:00.000Z',
        summary:[{
          platform:'linux-x86_64',cli_bytes:100,
          build_wasm_geomean_ms:10,native_miss_geomean_ms:10,native_hit_geomean_ms:10,
          run_wasmi_p50_ms:10,native_run_p50_ms:10
        }]
      },
      {
        commit:'b'.repeat(40),
        measured_at:'2026-09-20T00:00:00.000Z',
        summary:[{
          platform:'windows-x86_64',cli_bytes:100,
          build_wasm_geomean_ms:100,native_miss_geomean_ms:100,native_hit_geomean_ms:100,
          run_wasmi_p50_ms:100,native_run_p50_ms:100
        }]
      }
    ]
  };
  const previous=join(temp,'history.json');
  writeFileSync(previous,JSON.stringify(history));
  const stdout=execFileSync(process.execPath,[
    'scripts/aggregate-native-cli-perf.mjs',input,output,previous
  ],{cwd:root,encoding:'utf8'});
  const observation=JSON.parse(stdout.trim());
  assert.equal(observation.accepted,true);
  const latest=JSON.parse(readFileSync(join(output,'latest.json'),'utf8'));
  const baseline=latest.relative_baselines[0];
  assert.equal(baseline.platform,'linux-x86_64');
  assert.equal(baseline.history_samples,1);
  assert.equal(baseline.metrics.build_wasm_geomean_ms.baseline,10);
  assert.equal(baseline.metrics.build_wasm_geomean_ms.ratio,1.2);
  assert.equal(baseline.state,'within-baseline');
  assert(!JSON.stringify(baseline).includes('100'));
  console.log(JSON.stringify({accepted:true,same_platform_only:true,ratio:1.2,cross_platform_history_ignored:true}));
}finally{
  rmSync(temp,{recursive:true,force:true});
}
