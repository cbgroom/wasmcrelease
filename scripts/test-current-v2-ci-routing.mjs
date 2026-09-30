import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {suiteCases,usesCurrentDevelopment} from './ci-suite.mjs';
assert.equal(usesCurrentDevelopment('branch'),true);
assert.equal(usesCurrentDevelopment('tag'),false);
const previous=process.env.GITHUB_REF_TYPE;
try {
  process.env.GITHUB_REF_TYPE='branch';
  assert.equal(suiteCases('candidate')[0].id,'current-v2-development-and-frozen-release-boundary');
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
console.log(JSON.stringify({accepted:true,development_route:true,tag_release_route:true,workflow_routes:3}));
