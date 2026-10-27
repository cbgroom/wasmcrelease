import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
export const policy=JSON.parse(readFileSync(new URL('./rust-glue-edition-policy.json',import.meta.url)));
assert.equal(policy.schema,'wasmc.rust-glue-edition-policy-candidate/v1');
assert.equal(policy.edition,'2024');
assert.equal(policy.max_bytes,16*1024*1024);
export function checkBytes(bytes,label){
  if(!Number.isSafeInteger(bytes)||bytes<0||bytes>policy.max_bytes)throw Error(`${label} exceeds candidate ${policy.max_bytes}-byte limit`);
}
export function checkedRead(path,label){checkBytes(statSync(path).size,label);const bytes=readFileSync(path);checkBytes(bytes.length,label);return bytes;}
