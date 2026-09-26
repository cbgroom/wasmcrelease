import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=new URL('../',import.meta.url).pathname;
const work=mkdtempSync(join(tmpdir(),'wasmc-release-route-'));
const path=join(work,'candidate.json');
const run=(args)=>spawnSync(process.execPath,['scripts/release-candidate.mjs',...args],{cwd:root,encoding:'utf8',maxBuffer:16<<20});
const created=run(['create',path,'a'.repeat(40),'0.0.14']);
assert.notEqual(created.status,0,'formal candidate must reject while active LibSearch is only a candidate extra');
assert.match(created.stderr+created.stdout,/active LibSearch must be inside the product, catalog and exact route set/);
console.log(JSON.stringify({accepted:true,required_schema:'wasmc.release-product-candidate/v2',release_ready:false,blocker:'active-lib-search-candidate-extra',candidate_extras:1,publishes:false}));
