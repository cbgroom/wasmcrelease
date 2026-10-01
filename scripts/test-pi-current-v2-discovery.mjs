import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prompt,evaluateAnswer} from './run-pi-current-v2-discovery.mjs';
import {evaluateTraceText} from './wasmc-live-agent-trace-evaluation-v1.mjs';
const bytes=readFileSync('catalog/libs-current-v2.json');
const policy=readFileSync('catalog/current-v2-policy.json');
const catalog=JSON.parse(bytes),selected=catalog.packages.find(row=>row.id==='wasmc-std');
const answer={checkout_scope:'current-development',current_package_count:catalog.packages.length,backlog_count:JSON.parse(policy).rebuild_backlog_count,api_identity:'wasmc:std@1.4.0/base64#try-decode-standard',root:selected.root,catalog_sha256:createHash('sha256').update(bytes).digest('hex'),wit_sha256:selected.wit_sha256,artifact_sha256:selected.artifact_sha256,selection_authority:false,csv_current:false,telemetry_current:false};
const report={accepted:true,final_answer:{text:JSON.stringify(answer)},tool_calls:[{name:'bash',arguments:{command:'node scripts/validate-current-development.mjs'}},{name:'bash',arguments:{command:'node scripts/wasmc-lib.mjs search "base64 decode" --limit 8'}}],error_results:0,retries:0,parse_errors:0,reported_failure_results:0};
assert.match(prompt,/selection_authority \(boolean/);
assert.equal(evaluateAnswer(report,bytes,policy).accepted,true);
for(const [key,value] of [['checkout_scope','immutable-release'],['selection_authority',true],['catalog_sha256','0'.repeat(64)],['csv_current',true],['telemetry_current',true]]){
  assert.equal(evaluateAnswer({...report,final_answer:{text:JSON.stringify({...answer,[key]:value})}},bytes,policy).accepted,false);
}
for(const key of ['error_results','retries','reported_failure_results'])assert.equal(evaluateAnswer({...report,[key]:1},bytes,policy).accepted,false);
assert.equal(evaluateAnswer({...report,tool_calls:[]},bytes,policy).accepted,false);
assert.equal(evaluateAnswer({...report,tool_calls:[...report.tool_calls,{name:'read',arguments:{path:'.agents/HANDOFF.md'}}]},bytes,policy).accepted,false);
const masked=JSON.stringify({type:'message_end',message:{role:'toolResult',isError:false,content:[{text:'{"accepted":false,"code":"cli.command_unsupported"}'}]}});
assert.equal(evaluateTraceText(masked).error_results,0);
assert.equal(evaluateTraceText(masked).reported_failure_results,1);
console.log(JSON.stringify({accepted:true,synthetic_oracle_controls:10,masked_child_failure_detection:true,live_model_qualification:false}));
