import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Known legacy budgets in generated Canonical Core SDKs. This is a regression
// check for these exact old limits, not proof that all possible limits are gone.
const legacyBudgets = [
  /\bbytes\s*:\s*16\s*\*\s*1024\s*\*\s*1024\b/,
  /\bnodes\s*:\s*1024\s*\*\s*1024\b/,
  /\bdepth\s*:\s*32\b/,
];
const excluded = new Set(['wasmc-app-authorization-policy','wasmc-tls-client','wasmc-tls-core']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function knownLegacyCoreSdkBudgets(text) {
  return legacyBudgets.map(pattern=>pattern.test(text));
}
export function checkNormalCoreSdkBudgets(catalog,read) {
  let checked=0;const selected=[];
  for(const row of catalog.packages){
    if(excluded.has(row.id)||row.profile==='native'||row.profile==='host')continue;
    const find=path=>{const pin=row.files.find(file=>file.path===path);assert.ok(pin,'missing selected Root file: '+path);const bytes=read(path);assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256);return bytes;};
    const wit=find(row.root+'/lib.wit').toString('utf8');
    if(!/\b(?:string|list\s*<)/.test(wit))continue;
    const manifest=JSON.parse(find(row.root+'/lib.json'));const binding=manifest.bindings?.rust_core;
    if(!binding)continue;
    const path=row.root+'/'+binding.source.path,bytes=find(path);
    assert.equal(sha(bytes),binding.source.sha256,'SDK source binding drift');
    assert.deepEqual(knownLegacyCoreSdkBudgets(bytes.toString('utf8')),[false,false,false],row.id+' uses a known legacy per-SDK budget');
    checked++;selected.push(row.id+'@'+row.version);
  }
  assert.ok(checked>0,'no normal dynamic Core SDKs were checked');
  return {checked,selected,scope:'known legacy SDK budgets only'};
}
