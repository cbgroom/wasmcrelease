import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertFrozenRootIdentities} from './frozen-root-identities-v1.mjs';

const row = {id:'wasmc-example',version:'1.0.0',manifest_sha256:'a'.repeat(64),root_inventory_sha256:'b'.repeat(64)};
const base = {schema:'wasmc.public-lib-catalog/v2',packages:[row]};
test('same identity and exact inventory is accepted',()=>assert.doesNotThrow(()=>assertFrozenRootIdentities(base,[{...row}])));
test('a successor version is distinct',()=>assert.doesNotThrow(()=>assertFrozenRootIdentities(base,[{...row,version:'1.0.1',manifest_sha256:'c'.repeat(64)}])));
test('changed manifest under a published identity is rejected',()=>assert.throws(()=>assertFrozenRootIdentities(base,[{...row,manifest_sha256:'c'.repeat(64)}]),/published Root identity changed/));
test('changed Root inventory under a published identity is rejected',()=>assert.throws(()=>assertFrozenRootIdentities(base,[{...row,root_inventory_sha256:'c'.repeat(64)}]),/published Root identity changed/));
test('ambiguous duplicate published or candidate identities are rejected',()=>{
 assert.throws(()=>assertFrozenRootIdentities({...base,packages:[row,row]},[row]),/duplicate published/);
 assert.throws(()=>assertFrozenRootIdentities(base,[row,row]),/duplicate candidate/);
});
