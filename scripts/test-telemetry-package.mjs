// Candidate byte/lifecycle-intrinsic checks; not a substitute for production
// Lib verification or actual Component/consumer execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(process.argv[2] ?? 'admission/system-telemetry-v1/package');
const sha = b => createHash('sha256').update(b).digest('hex');
const manifest = JSON.parse(readFileSync(join(root,'lib.json'),'utf8'));
assert.equal(manifest.admission.approved,false);
assert.deepEqual(readdirSync(root).sort(),['SKILL.md','artifact.wasm','component.wasm','lib.json','lib.wit','references'].sort());
for (const row of [manifest.artifact,manifest.component,manifest.wit,manifest.agent.skill,manifest.agent.delta]) {
  const b=readFileSync(join(root,row.path));assert.equal(sha(b),row.sha256,row.path);
  if(row.bytes!==undefined)assert.equal(b.length,row.bytes,row.path);
}
assert.deepEqual(readdirSync(join(root,'references')),['agent-delta.json']);
const core=readFileSync(join(root,'artifact.wasm'));
assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(core)),manifest.qualification.canonical_resource_intrinsics);
const changed=Buffer.from(core);changed[changed.length-1]^=1;
assert.notEqual(sha(changed),manifest.artifact.sha256,'tamper detection');
assert.equal(manifest.qualification.status,'partial');
console.log(JSON.stringify({accepted:true,scope:'candidate-file-identities-and-exact-intrinsics',release_qualified:false}));
