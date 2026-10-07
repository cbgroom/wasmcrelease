import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkQ2Evidence, checkQ2Resume } from './lib-q2-evidence-v2.mjs';

const cases = [{export:'validate',arguments:[],expected:{ok:null}},
  {export:'select',arguments:[],expected:{ok:[{some:'值'},null]}}];
const pins = {root:'root-pin',source:'source-pin',wasmi:'2.0.0',wasmtime:'49.0.2'};
function report() { return {schema:'wasmc.generated-root-ordinary-caller-q2/v2',
  accepted:true,rounds:8,calls_per_engine:16,all_cases_dual_engine:true,
  shared_logical_decoder:true,wrong_root_pin_rejected:true,wrong_bundle_pin_rejected:true,
  unknown_export_rejected:true,ordinary_wasmc_source:true,fuel_diagnostic_only:true,
  public_admission:false,root_manifest_sha256:pins.root,source_sha256:pins.source,
  wasmi_version:pins.wasmi,wasmtime_version:pins.wasmtime,
  cases:cases.map(c=>({export:c.export,wasmi:structuredClone(c.expected),
    wasmtime:{tested:true,value:structuredClone(c.expected)}}))}; }
test('accepts complete dual-engine Unit and nested values',()=>{
  assert.equal(checkQ2Evidence(report(),cases,pins,8),true);
});
for (const [name,change] of [
  ['rejects skipped Wasmtime',r=>{r.cases[0].wasmtime.tested=false;}],
  ['rejects wrong Wasmtime value',r=>{r.cases[1].wasmtime.value={ok:[]};}],
  ['rejects wrong Wasmi value',r=>{r.cases[0].wasmi={err:'wrong'};}],
  ['rejects missing cases',r=>{r.cases.pop();}],
  ['rejects duplicate case substitution',r=>{r.cases[1]=r.cases[0];}],
  ['rejects false repeat count',r=>{r.calls_per_engine=2;}],
  ['rejects wrong pinned source',r=>{r.source_sha256='different';}],
  ['rejects old scalar-only evidence',r=>{r.schema='wasmc.generated-root-ordinary-caller-q2/v1';}],
  ['rejects absent identity negative',r=>{r.wrong_bundle_pin_rejected=false;}],
]) test(name,()=>{const r=report();change(r);assert.throws(()=>checkQ2Evidence(r,cases,pins,8));});

const resume = {schema:'wasmc.current-lib-search-ordinary-q2/v2',cases_sha256:'cases',
  index_sha256:'index',root_manifest_sha256:'root',public_admission:false,results:[],
  tooling:{runner:{sha256:'runner'},provider:{sha256:'provider'}}};
test('resume accepts exact pinned attempt only',()=>assert.equal(checkQ2Resume(resume,resume),true));
for (const key of ['schema','cases_sha256','index_sha256','root_manifest_sha256','tooling']) {
  test('resume rejects changed '+key,()=>{
    const changed=structuredClone(resume);changed[key]='different';
    assert.throws(()=>checkQ2Resume(changed,resume));
  });
}
