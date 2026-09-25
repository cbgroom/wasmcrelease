import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function run(program,args) {
  const r=spawnSync(program,args,{cwd:root,stdio:'inherit',timeout:1500000});
  if(r.error)throw r.error;
  if(r.status!==0)throw Error(`${program} exited ${r.status}`);
}
const manifest='libsrc/wasmc-system-telemetry/Cargo.toml';
run('cargo',['test','--locked','--manifest-path',manifest]);
if(process.platform==='linux') {
  run('cargo',['test','--locked','--manifest-path',manifest,'--example','linux']);
  run('cargo',['run','--release','--locked','--manifest-path',manifest,'--example','linux']);
}
run('bash',['scripts/test-telemetry-component.sh']);
console.log(JSON.stringify({accepted:true,scope:'native-and-source-free-component-current-host',release_qualified:false}));
