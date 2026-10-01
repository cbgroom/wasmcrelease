import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {suiteCases,usesCurrentDevelopment} from './ci-suite.mjs';
assert.equal(usesCurrentDevelopment('branch'),true);
assert.equal(usesCurrentDevelopment('tag'),false);
const previous=process.env.GITHUB_REF_TYPE;
try {
  process.env.GITHUB_REF_TYPE='branch';
  assert.equal(suiteCases('candidate')[0].id,'current-v2-development-and-frozen-release-boundary');
  assert(suiteCases('candidate').some(row=>row.id==='current-v2-ordinary-app-replay'));
  assert(suiteCases('candidate').some(row=>row.id==='current-v2-generated-adapter-input-witness'));
  process.env.GITHUB_REF_TYPE='tag';
  const cases=suiteCases('candidate');
  assert.equal(cases[0].id,'v020-product-identity');
  assert(cases.some(row=>row.id==='candidate-release-surface-model'));
} finally {
  if(previous===undefined)delete process.env.GITHUB_REF_TYPE;else process.env.GITHUB_REF_TYPE=previous;
}
for(const file of ['host-file-io.yml','host-lib-e2e.yml']){
  const text=readFileSync('.github/workflows/'+file,'utf8');
  assert.match(text,/github\.ref_type == 'tag'/);
  assert.match(text,/github\.ref_type != 'tag'/);
  assert.doesNotMatch(text,/github\.ref == 'refs\/heads\/main'/);
}
const search=readFileSync('.github/workflows/lib-search.yml','utf8');
assert.match(search,/GITHUB_REF_TYPE.*tag/);
assert.match(search,/scripts\/validate-current-development.mjs/);
assert.match(search,/release-candidate.mjs verify channels\/candidates\/0.0.20.json/);
const surfaces=readFileSync('.github/workflows/release-surfaces.yml','utf8');
assert.match(surfaces,/GITHUB_REF_TYPE.*tag/);
assert.match(surfaces,/--frozen-release-ecosystem/);
const libSource=readFileSync('.github/workflows/lib-source.yml','utf8');
const validateJob=libSource.split(/^  validate:/m)[1].split(/^  tls-client-canonical:/m)[0];
assert.match(validateJob,/uses: actions\/checkout@[^\n]+\n\s+with:\n(?:\s+#.*\n)*\s+fetch-depth: 0/);
assert.match(validateJob,/name: Preserve validation diagnostics even on failure\n\s+if: always\(\)/);
assert.match(validateJob,/path: target\/ci/);
const hostBoundary=readFileSync('scripts/validate-host-lib-defined-boundary-workstream.mjs','utf8');
assert.match(hostBoundary,/import \{ usesCurrentDevelopment \} from "\.\/ci-suite\.mjs"/);
assert.match(hostBoundary,/script === "scripts\/validate-release-surfaces\.mjs" && usesCurrentDevelopment\(\)/);
assert.match(hostBoundary,/\? \["--frozen-release-ecosystem"\] : \[\]/);
const tagAttempt=spawnSync(process.execPath,['scripts/validate-release-surfaces.mjs','--frozen-release-ecosystem'],{env:{...process.env,GITHUB_REF_TYPE:'tag'},encoding:'utf8'});
assert.notEqual(tagAttempt.status,0);
assert.match(tagAttempt.stderr,/never a release tag/);
console.log(JSON.stringify({accepted:true,development_route:true,tag_release_route:true,tag_override_rejected:true,workflow_routes:5,lib_source_release_baseline_available:true,lib_source_failed_diagnostics_retained:true}));
