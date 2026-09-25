// Local candidate staging only. Does not admit, release or move discovery.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const [source, corePath, componentPath, destination] = process.argv.slice(2);
assert.match(source ?? '', /^[0-9a-f]{40}$/);
assert(corePath && componentPath && destination, 'SOURCE CORE COMPONENT NEW_DESTINATION');
const dest = resolve(destination);
assert(!existsSync(dest), 'candidate destination must be absent');
const hash = b => createHash('sha256').update(b).digest('hex');
const core = readFileSync(corePath);
const component = readFileSync(componentPath);
const imports = WebAssembly.Module.imports(new WebAssembly.Module(core));
assert.deepEqual(imports.map(x => [x.module,x.name,x.kind]).sort(), [
  ['[export]wasmc:system-telemetry/monitor@0.0.1','[resource-drop]sampler','function'],
  ['[export]wasmc:system-telemetry/monitor@0.0.1','[resource-new]sampler','function'],
].sort());
mkdirSync(join(dest,'references'), {recursive:true});
copyFileSync(corePath,join(dest,'artifact.wasm'));
copyFileSync(componentPath,join(dest,'component.wasm'));
copyFileSync('libsrc/wasmc-system-telemetry/wit/world.wit',join(dest,'lib.wit'));
const delta = {schema:'wasmc.lib-agent-delta/v0',apis:[
  {api:'sampler',origin:2,support:0,implementation:1,ecosystem:'explicit Linux proc snapshots',
   delta:'Caller supplies bounded complete snapshots and monotonic time. First/reset/no-progress CPU rate is absent. Errors commit no state. No ambient I/O or telemetry Host API.'},
  {api:'encode-frame',origin:2,support:0,implementation:1,ecosystem:'telemetry frame-v3',
   delta:'64-byte LE successor; flags bit0 means CPU unavailable. Not the old flags-zero v2 protocol.'},
]};
writeFileSync(join(dest,'references/agent-delta.json'),JSON.stringify(delta,null,2)+'\n');
writeFileSync(join(dest,'SKILL.md'),`---\nname: wasmc-system-telemetry\ndescription: "Candidate telemetry parsing and cadence over explicit snapshots; not released."\n---\n\n# Candidate only\n\nRead lib.wit and references/agent-delta.json. This package has not passed formal\nrelease admission. Do not install it as prod or claim WAsmC resource-method\nconsumption. It supplies no ambient resources. Native Linux acquisition is\ncaller-owned; other OS acquisition and generic Host integration are unqualified.\nRaw Core resource intrinsics require a correct Canonical resource manager.\nUse the Component consumer with exact bytes; never expose raw handles in source.\n`);
const row = (path,format) => {const b=readFileSync(join(dest,path));return {path,format,bytes:b.length,sha256:hash(b)};};
const manifest = {
  schema:'wasmc.lib/v0', id:'wasmc-system-telemetry', version:'0.0.1',
  admission:{approved:false,source_authority:source,stage:'local-qualified-candidate'},
  artifact:row('artifact.wasm','core-wasm'), component:row('component.wasm','component-wasm'),
  wit:{package:'wasmc:system-telemetry@0.0.1',world:'system-telemetry',path:'lib.wit',sha256:hash(readFileSync(join(dest,'lib.wit')))},
  agent:{skill:{path:'SKILL.md',sha256:hash(readFileSync(join(dest,'SKILL.md')))},delta:{path:'references/agent-delta.json',sha256:hash(readFileSync(join(dest,'references/agent-delta.json')))}},
  build:{language:'rust',locked:true,offline:true,target:'wasm32-unknown-unknown',profile:'release',features:['component'],toolchain:'rustc 1.97.1',
    inputs:[{kind:'cargo-lock',path:'libsrc/wasmc-system-telemetry/Cargo.lock',sha256:hash(readFileSync('libsrc/wasmc-system-telemetry/Cargo.lock'))}]},
  qualification:{status:'partial',host_authorities:[],canonical_resource_intrinsics:imports,
    native_tests:27,io_tests:3,linux_live_frames:100,rust_component_rounds:128,
    pending:['wasmc-source-consumer','generic-host-sdk-acquisition','cross-platform-engine-matrix','strict-production-package-and-discovery','immutable-promotion']},
};
writeFileSync(join(dest,'lib.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({staged:true,admitted:false,source,core_sha256:hash(core),component_sha256:hash(component)}));
