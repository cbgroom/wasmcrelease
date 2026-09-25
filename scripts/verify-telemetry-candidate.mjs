// Strict candidate verification against a trusted checkout's independent
// producer receipt. This is not production admission or an online signature.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
export const sha = b => createHash('sha256').update(b).digest('hex');
const ROOT_FILES=['SKILL.md','artifact.wasm','component.wasm','lib.json','lib.wit','references'].sort();
const RESOURCE_INTRINSICS=[
  {module:'[export]wasmc:system-telemetry/monitor@0.0.1',name:'[resource-drop]sampler',kind:'function'},
  {module:'[export]wasmc:system-telemetry/monitor@0.0.1',name:'[resource-new]sampler',kind:'function'},
];
function directory(path) {
  const s=lstatSync(path);assert(s.isDirectory()&&!s.isSymbolicLink(),'non-directory or symlink rejected');
}
function bytes(root,path) {
  assert(['artifact.wasm','component.wasm','lib.json','lib.wit','SKILL.md','references/agent-delta.json'].includes(path),'unrecognized package path');
  const p=join(root,path),s=lstatSync(p);
  assert(s.isFile()&&!s.isSymbolicLink(),'non-file or symlink rejected');
  assert(s.size>0&&s.size<=2*1024*1024,'candidate file size bound');
  return readFileSync(p);
}
function check(b,row,label) {
  assert.match(row.sha256,/^[0-9a-f]{64}$/,'invalid expected digest');
  assert.equal(sha(b),row.sha256,'digest drift: '+label);
  if(row.bytes!==undefined)assert.equal(b.length,row.bytes,'length drift: '+label);
}
export function verifyCandidate(packageRoot,expected) {
  const root=resolve(packageRoot);directory(root);directory(join(root,'references'));
  assert.deepEqual(readdirSync(root).sort(),ROOT_FILES,'unexpected root inventory');
  assert.deepEqual(readdirSync(join(root,'references')),['agent-delta.json'],'unexpected reference inventory');
  // The package must not authorize its own replacement. Manifest and products
  // are independently pinned by the receipt selected with the checkout.
  for(const name of ['lib.json','artifact.wasm','component.wasm','lib.wit']) {
    assert(expected[name],'missing independent identity');check(bytes(root,name),expected[name],name);
  }
  const m=JSON.parse(bytes(root,'lib.json').toString('utf8'));
  assert.equal(m.schema,'wasmc.lib/v0');assert.equal(m.id,'wasmc-system-telemetry');assert.equal(m.version,'0.0.1');
  assert.equal(m.admission.approved,false);assert.equal(m.qualification.status,'partial');
  assert.equal(m.wit.package,'wasmc:system-telemetry@0.0.1');assert.equal(m.wit.world,'system-telemetry');
  assert.deepEqual(m.qualification.host_authorities,[]);
  for(const [row,name] of [[m.artifact,'artifact.wasm'],[m.component,'component.wasm'],[m.wit,'lib.wit'],[m.agent.skill,'SKILL.md'],[m.agent.delta,'references/agent-delta.json']]) {
    assert.equal(row.path,name,'path or manifest role drift');check(bytes(root,name),row,name);
  }
  const core=new WebAssembly.Module(bytes(root,'artifact.wasm'));
  assert.deepEqual(m.qualification.canonical_resource_intrinsics,RESOURCE_INTRINSICS);
  assert.deepEqual(WebAssembly.Module.imports(core),RESOURCE_INTRINSICS,'unexpected Core import');
  assert.match(bytes(root,'lib.wit').toString('utf8'),/^package wasmc:system-telemetry@0\.0\.1;/);
  return {accepted:true,scope:'candidate-pinned-identities-strict-reopen',release_qualified:false};
}
