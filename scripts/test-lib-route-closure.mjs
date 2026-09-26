import assert from 'node:assert/strict';
import { buildClosure, parseLsi, parseWitRoutes, validateRouteSets } from './lib-route-closure.mjs';
import { readFileSync } from 'node:fs';

const candidate=JSON.parse(readFileSync('channels/candidates/0.0.14.json'));
const model=buildClosure(undefined,{release:{version:'0.0.14',tag:'v0.0.14',staged_product_manifest:'channels/candidates/0.0.14.json'},stagedProduct:candidate});
assert.equal(model.release_bindings.length,14);
assert.equal(model.search_index.package_routes,14);
assert.equal(model.search_index.api_routes,108);
assert.equal(model.candidate_extras.length,0);
assert.deepEqual(model.claims,{
  release_catalog_exact:true,
  release_package_routes_exact:true,
  release_api_routes_exact:true,
  api_parents_closed:true,
  formal_release_ready:true,
  automatic_version_selection:false,
  candidate_extra_grants_release:false
});
assert.deepEqual(model.blocking_conditions,[]);

const indexEntries=parseLsi(readFileSync('examples/lib-search/index-v014-v020.lsi'));
const releasePackages=model.release_bindings.map(row=>({identity:row.identity,root:row.root,api_routes:indexEntries.filter(entry=>entry.signature&&entry.identity.startsWith(row.identity+'/')).map(entry=>entry.identity)}));
const catalogPackages=releasePackages.map(({identity,root})=>({identity,root}));
const active=parseWitRoutes(readFileSync('standard/wasmc-lib-search/0.2.0/lib.wit'));
const activePackage={identity:active.identity,root:'standard/wasmc-lib-search/0.2.0',api_routes:active.api_routes};
const rejected=(mutate,code)=>assert.throws(()=>validateRouteSets(mutate({releasePackages:structuredClone(releasePackages),catalogPackages:structuredClone(catalogPackages),indexEntries:structuredClone(indexEntries),activePackage:structuredClone(activePackage)})),error=>error.code===code);
rejected(input=>({...input,catalogPackages:input.catalogPackages.slice(1)}),'route.catalog_release_set_mismatch');
rejected(input=>({...input,indexEntries:input.indexEntries.filter(row=>row.identity!==input.releasePackages[0].identity)}),'route.package_set_mismatch');
rejected(input=>({...input,indexEntries:input.indexEntries.filter(row=>row.identity!==input.releasePackages[0].api_routes[0])}),'route.api_set_mismatch');
rejected(input=>{input.indexEntries.push({identity:'wasmc:unknown@9.9.9',signature:''});return input;},'route.package_set_mismatch');
rejected(input=>{input.releasePackages[0].identity='wasmc:csv@9.9.9';return input;},'route.catalog_release_set_mismatch');
rejected(input=>{const old=input.releasePackages[0].api_routes[0],next='unbound/api#route';input.releasePackages[0].api_routes[0]=next;input.indexEntries.find(row=>row.identity===old).identity=next;return input;},'route.api_parent_unbound');

console.log(JSON.stringify({accepted:true,schema:model.schema,release_packages:14,package_routes:14,api_routes:108,negative_tests:6,candidate_extras:0,formal_release_ready:true}));
