import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cwd=new URL('../../../',import.meta.url);let controls=0;
const profile=process.argv.slice(2);
assert.ok(profile.length===0||(profile.length===1&&profile[0]==='--node-only'),'unknown entrypoint profile');
const runtimes=profile.length?[['node',[]]]:[['node',[]],['bun',[]],['deno',['run']]];
for(const [runtime,args] of runtimes) {
  const result=spawnSync(runtime,[...args,'host/drivers/udp/fault-test.mjs','node','host/drivers/udp/retirement-test.mjs'],{cwd,encoding:'utf8',timeout:10000});
  assert.equal(result.error,undefined);assert.equal(result.signal,null);
  assert.notEqual(result.status,0);assert.match(result.stderr,/UDP fault test accepts no arguments/);
  assert.doesNotMatch(result.stdout,/"accepted":true/);controls++;
}
console.log(JSON.stringify({accepted:true,udp_entrypoint_controls:controls,engine_profile:profile.length?'node-only':'node-bun-deno',folded_command_rejected:true,no_network_permission_required:true}));
