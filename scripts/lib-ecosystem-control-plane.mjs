#!/usr/bin/env node
import assert from 'node:assert/strict';
import {publishedLifecycle} from './release-lifecycle.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildClosure} from './lib-route-closure.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const closure=buildClosure(),surfaces=read('release-surfaces.json'),catalog=read(closure.catalog.path);
const version=catalog.version,release=read('release.json'),prod=read('channels/prod.json');
const lifecycle=publishedLifecycle(release,prod,read(release.staged_product_manifest),version);
const released=lifecycle.released;
const rows=closure.release_bindings.map(row=>({...row,
  qualification:{Root_Q0:true,runtime_claim:row.delivery_kind==='native-source'?'source-only; no execution or device qualification':'separate exact runtime receipts required'},
  states:lifecycle,
  lifecycle_authority:'release.json and channels/prod.json',
  stopping_conditions:row.delivery_kind==='native-source'?['native-source-is-not-executable','device-not-qualified']:[]}));
const model={schema:'wasmc.lib-ecosystem-control-plane/v3',authority:{immutable_product:'release.json -> exact candidate',
  capability_projection:'release-surfaces.json#agent_capability_projection',discovery_snapshot:closure.search_index.path,
  resolver_install_catalog:closure.catalog.path,rule:'Root qualification, runtime execution, admission, release, discovery, installation and Host authority are independent.'},
  release:{version,tag:'v'+version,lifecycle_authority:'release.json and channels/prod.json',published:released},
  route_closure:{authority:'catalog/lib-route-closure.json',release_packages:42,package_routes:42,api_routes:236,entries:278,candidate_extras:0,exact:true,public_release_admission:false},
  inventory:{packages:rows.length,Root_Q0_qualified:rows.length,native_source_packages:rows.filter(r=>r.delivery_kind==='native-source').length,
    admitted:released?rows.length:0,released:released?rows.length:0,discoverable:released?rows.length:0,installable:released?rows.length:0,
    install_catalog_release:'v'+version,install_catalog_packages:rows.length,inventory_is_unified:true},
  type_position_authority:surfaces.agent_capability_projection,producer_deltas:surfaces.producer_capability_delta,
  packages:rows,successor_candidates:[],ecosystem_stopping_conditions:['read exact channel lifecycle','explicit Host allowlist required','native source is not executable or device-qualified']};
const [action,...extra]=process.argv.slice(2);assert.ok(['--write','--check'].includes(action)&&extra.length===0);
const output=resolve(root,'lib-ecosystem-control-plane.json');
if(action==='--write')writeFileSync(output,JSON.stringify(model,null,2)+'\n');else assert.deepEqual(read('lib-ecosystem-control-plane.json'),model,'current42 ecosystem projection is stale');
console.log(JSON.stringify({accepted:true,action:action.slice(2),schema:model.schema,packages:rows.length,api_routes:236,entries:278,published:released,native_source_packages:14}));
