#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, copyFileSync, lstatSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {verifyBuildInputsUnchanged} from './current-v2-build-input-snapshot.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataCore = process.argv[2] === '--data-core';
const inputs = process.argv.slice(dataCore ? 3 : 2).map(p => resolve(p));
assert.equal(inputs.length, dataCore ? 1 : 4, 'supply independent private build receipt directories');
const batchRoot = dataCore ? 'admission/current-v2-data-core' : 'admission/current-v2-next';
const output = join(root, batchRoot);
assert.equal(existsSync(output), false, 'never overwrite a reviewed staging batch');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const rows = inputs.flatMap(work => {
  const receipt = JSON.parse(readFileSync(join(work, 'build-receipt.json')));
  assert.equal(receipt.producer_authority, '3b797a77d0afa25264a11362603b0d596d2e0ba7');
  return receipt.packages.map(row => ({ work, receipt, row }));
});
assert.deepEqual(rows.map(x => x.row.id).sort(), dataCore ? ['wasmc-data-core'] : ['wasmc-host-clock','wasmc-http1','wasmc-owned-algorithms','wasmc-resource-counter']);
// Validate the entire batch before copying any delivery bytes.
for (const {work, row} of rows) {
  assert.equal(row.strict_reopen, true);
  assert.equal(row.complete_second_build_byte_identical, true);
  assert.deepEqual(row.builds[0].inventory, row.builds[1].inventory);
  assert.deepEqual(row.builds[0].source_inputs,row.builds[1].source_inputs,'independent source-input witness drift');
  for(const [index,pass]of ['first','second'].entries()){
    const build=row.builds[index];
    assert.equal(build.build_inputs_unchanged,true,'new staging requires a pre/post-build input witness');
    verifyBuildInputsUnchanged(join(work,row.id,pass,'workspace'),build.source_inputs,
      {siblingWit:Boolean(row.canonical_source_recovered)});
  }
  for (const pass of ['first','second']) for (const [path, expected] of Object.entries(row.builds[0].inventory)) {
    assert(!path.startsWith('/') && !path.split('/').includes('..'));
    const input = join(work,row.id,pass,'package',row.id,path);
    assert(lstatSync(input).isFile(), 'symlink/non-file delivery rejected');
    const bytes = readFileSync(input);
    assert.deepEqual({bytes:bytes.length,sha256:hash(bytes)}, expected);
  }
}
mkdirSync(output, { recursive: true });
for (const {work,row} of rows) for (const path of Object.keys(row.builds[0].inventory)) {
  const dest = join(output,'packages',row.id,row.version,path);
  mkdirSync(dirname(dest), {recursive:true});
  copyFileSync(join(work,row.id,'first','package',row.id,path),dest);
}
writeFileSync(join(output,'build-receipts.json'),JSON.stringify({
  schema:'wasmc.current-v2-next-builds/v1', status:'qualification-pending',
  selected_current_catalog:false, release_qualified:false,
  packages:rows.map(({receipt,row})=>({...row,public_input_authority:receipt.source_authority,
    producer_authority:receipt.producer_authority,root:`${batchRoot}/packages/${row.id}/${row.version}`})),
},null,2)+'\n');
console.log(JSON.stringify({accepted:true,staged:rows.length,current_catalog_changed:false,release_qualified:false}));
