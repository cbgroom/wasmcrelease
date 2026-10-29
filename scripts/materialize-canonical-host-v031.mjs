#!/usr/bin/env node
// Create a successor-only wrapper; never alter the pinned historical input.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,lstatSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';

const [version,input,output,...rest]=process.argv.slice(2);
assert.equal(rest.length,0,'unexpected arguments');
assert.equal(version,'0.0.31','this recipe is specific to the v0.0.31 successor');
assert.ok(input&&output&&isAbsolute(input)&&isAbsolute(output),'input and output must be absolute');
assert.notEqual(resolve(input),resolve(output),'output must differ from frozen input');
const stat=lstatSync(input);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'input must be a real regular file');
const bytes=readFileSync(input),hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(bytes),'3e95ff2514c6b7ec20f49653c8964f8c642dd248cfd88d539518ddda725d58e0','frozen v030 wrapper identity');
const source=bytes.toString('utf8');assert.deepEqual(Buffer.from(source),bytes,'wrapper UTF-8 identity');
const old='input.length > 1024 * 1024',next='input.length > 16 * 1024 * 1024';
assert.equal(source.split(old).length,2,'exact historical guard');
const oldCompiler="bytes.length > 2097152) throw new Error('Compiler exceeds the public 2 MiB artifact budget')";
const nextCompiler="bytes.length > 16 * 1024 * 1024) throw new Error('Compiler exceeds the public 16 MiB artifact budget')";
assert.equal(source.split(oldCompiler).length,2,'exact historical compiler guard');
const result=Buffer.from(source.replace(old,next).replace(oldCompiler,nextCompiler));
writeFileSync(output,result,{flag:'wx'});
console.log(JSON.stringify({accepted:true,version,input_sha256:hash(bytes),output_sha256:hash(result),output_bytes:result.length,output}));
