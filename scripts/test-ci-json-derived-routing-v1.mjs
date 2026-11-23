// Exercise CI routing using disposable catalog and candidate fixtures only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

const sourceRoot=fileURLToPath(new URL('../',import.meta.url));
const temporary=mkdtempSync(join(tmpdir(),'wasmc-ci-json-route-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=v=>Buffer.from(JSON.stringify(v));
let count=0;
async function fixture(schema,actual=false){
  const root=join(temporary,String(count++));
  for(const dir of ['scripts','catalog','admission','channels/candidates'])mkdirSync(join(root,dir),{recursive:true});
  copyFileSync(join(sourceRoot,'scripts/ci-suite.mjs'),join(root,'scripts/ci-suite.mjs'));
  let cohort,catalog;
  if(actual){
    catalog=readFileSync(join(sourceRoot,'catalog/libs-current-v2.json'));
    const parsed=JSON.parse(catalog);cohort=readFileSync(join(sourceRoot,parsed.cohort.path));
    assert.equal(JSON.parse(cohort).schema,schema);
    mkdirSync(join(root,parsed.cohort.path.split('/').slice(0,-1).join('/')),{recursive:true});
    writeFileSync(join(root,parsed.cohort.path),cohort);
  }else{
    cohort=json({schema});writeFileSync(join(root,'admission/cohort.json'),cohort);
    catalog=json({version:'0.0.31',cohort:{path:'admission/cohort.json',bytes:cohort.length,sha256:sha(cohort)}});
  }
  const version=JSON.parse(catalog).version,digest=sha(catalog);
  writeFileSync(join(root,'catalog/libs-current-v2.json'),catalog);
  const candidate={schema:'wasmc.release-product-candidate/v3',version,current_catalog:{path:'catalog/libs-current-v2.json',sha256:digest},test_only:true};
  const candidatePath=join(root,'channels/candidates',version+'.json');writeFileSync(candidatePath,json(candidate));
  const mod=await import(pathToFileURL(join(root,'scripts/ci-suite.mjs')).href);
  return {mod,candidate,candidatePath,digest};
}
try{
  for(const schema of ['wasmc.json-overlay-cohort/v1','wasmc.json-derived-overlay-cohort/v1']){
    const x=await fixture(schema);
    for(const family of ['integrity','candidate']){
      const cases=x.mod.suiteCases(family,'node');
      const product=cases.find(c=>c.id==='current-complete-product-reopen-negatives');
      const notices=cases.find(c=>c.id==='json-overlay-declared-notice-bytes');
      assert.equal(product.args[0],'scripts/test-json-overlay-product-ci-v1.mjs');
      assert.equal(product.args[product.args.indexOf('--catalog-sha256')+1],x.digest);
      assert.equal(notices.args[0],'scripts/test-json-overlay-product-ci-v1.mjs');
      assert.equal(cases.some(c=>c.id==='json-derived-ci-routing'),schema==='wasmc.json-derived-overlay-cohort/v1');
    }
    x.candidate.current_catalog.sha256='0'.repeat(64);writeFileSync(x.candidatePath,json(x.candidate));
    assert.throws(()=>x.mod.suiteCases('candidate','node'),/candidate catalog identity drift/);
  }
  const legacy=await fixture('wasmc.public-current-refresh-cohort/v1');
  assert.equal(legacy.mod.suiteCases('candidate','node').find(c=>c.id==='current-complete-product-reopen-negatives').args[0],'scripts/test-current-product-v3.mjs');
  const actualCatalog=JSON.parse(readFileSync(join(sourceRoot,'catalog/libs-current-v2.json')));
  const actualSchema=JSON.parse(readFileSync(join(sourceRoot,actualCatalog.cohort.path))).schema;
  let actualDerivedChecked=false;
  if(actualSchema==='wasmc.json-derived-overlay-cohort/v1'){
    const x=await fixture(actualSchema,true);
    const c=x.mod.suiteCases('candidate','node').find(row=>row.id==='current-complete-product-reopen-negatives');
    assert.equal(c.args[c.args.indexOf('--catalog-sha256')+1],x.digest);
    actualDerivedChecked=true;
  }
  console.log(JSON.stringify({accepted:true,synthetic_schemas:3,actual_derived_catalog_checked:actualDerivedChecked,candidate_binding_rejection:true,release:false}));
}finally{rmSync(temporary,{recursive:true,force:true});}
