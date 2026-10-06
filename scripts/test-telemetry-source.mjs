import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { command, atomicJson } from './lib-refresh-cache-v2.mjs';
const root=process.cwd(),out=await mkdtemp(join(tmpdir(),'wasmc-current-telemetry-'));
await command('rustc',['+1.96.0','--edition=2021','--test','libspec/wasmc-system-telemetry/delta.rs','-o',join(out,'unit')],{cwd:root});
const unit=await command(join(out,'unit'),[],{cwd:root,logs:join(out,'unit-test')});
let linux=null;
if(process.platform==='linux') {
  await command('rustc',['+1.96.0','--edition=2021','tests/lib-refresh/telemetry/linux.rs','-o',join(out,'linux')],{cwd:root});
  linux=await command(join(out,'linux'),[],{cwd:root,logs:join(out,'linux-test')});
}
const result={accepted:true,schema:'wasmc.current-telemetry-delta-test/v2',unit:unit.stdout,
  linux:linux?JSON.parse(linux.stdout):null,generated_component_test:'separate',public_admission:false};
await atomicJson(join(out,'receipt.json'),result);console.log(JSON.stringify({...result,evidence_root:out}));
