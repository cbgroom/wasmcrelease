import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cwd=new URL('../../',import.meta.url);let controls=0;
for(const [runtime,args] of [['node',[]],['bun',[]],['deno',['run']]]) {
  const result=spawnSync(runtime,[...args,'host/udp/fault-test.mjs','node','host/udp/retirement-test.mjs'],{cwd,encoding:'utf8',timeout:10000});
  assert.equal(result.error,undefined);assert.equal(result.signal,null);
  assert.notEqual(result.status,0);assert.match(result.stderr,/UDP fault test accepts no arguments/);
  assert.doesNotMatch(result.stdout,/"accepted":true/);controls++;
}
console.log(JSON.stringify({accepted:true,udp_entrypoint_controls:controls,folded_command_rejected:true,no_network_permission_required:true}));
