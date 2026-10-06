// Current source architecture only. Package execution is performed against an
// exact generated Root by qualify-lib-refresh-v2, not historical admission rows.
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const scripts=['validate-current-only-libs.mjs','validate-lib-refresh-v2-source.mjs',
  'validate-host-layout.mjs','test-host-lib-defined-boundary.mjs','validate-host-camera-model.mjs',
  'validate-android-agent-computer.mjs','test-platform-profile-resolver.mjs',
  ...readdirSync('scripts').filter(p=>/^validate-ios-.*\.mjs$/.test(p)).sort()];
const results=scripts.map(script=>{
  const text=execFileSync(process.execPath,['scripts/'+script],{encoding:'utf8',timeout:30000});
  const result=JSON.parse(text.trim().split('\n').at(-1));assert.equal(result.accepted,true,script);
  return {script,accepted:true};
});
console.log(JSON.stringify({accepted:true,schema:'wasmc.current-platform-source-checks/v2',results,
  compiled_or_device_qualified:false,legacy_fallback:false,public_admission:false}));
