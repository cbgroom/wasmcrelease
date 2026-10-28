// Candidate-only syntax migration of generated Rust. The compiler's original
// cold source is retained separately and still bound by its activation hash.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
const [source,pin,out]=process.argv.slice(2);
assert.ok(isAbsolute(source??'')&&isAbsolute(out??'')&&/^[a-f0-9]{64}$/.test(pin??''));
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=readFileSync(source);assert.equal(sha(bytes),pin);
let s=bytes.toString('utf8');assert.equal(Buffer.from(s).compare(bytes),0,'source must be UTF-8');
const externs=[...s.matchAll(/\bextern\s+"C"\s*\{/g)].length;
const noMangle=[...s.matchAll(/#\[no_mangle\]/g)].length;
const exports=[...s.matchAll(/#\[export_name\s*=\s*"[^"]+"\]/g)].length;
assert.ok(externs>0&&noMangle>0);
s=s.replace(/\bextern\s+"C"\s*\{/g,'unsafe extern "C" {').replaceAll('#[no_mangle]','#[unsafe(no_mangle)]')
  .replace(/#\[export_name\s*=\s*("[^"]+")\]/g,'#[unsafe(export_name=$1)]');
const result=Buffer.from('#![allow(static_mut_refs)]\n'+s);writeFileSync(out,result,{flag:'wx'});
console.log(JSON.stringify({schema:'wasmc.candidate-transfer-edition2024/v1',source_sha256:pin,
  converted_sha256:sha(result),extern_blocks:externs,no_mangle:noMangle,export_names:exports,
  scope:'syntax-derived candidate; does not repair the producer',formal_release:false}));
