#!/usr/bin/env node
// Reconstruct the pinned candidate source and invoke the ordinary refresh runner.
// Producer, upstream, resource and license arguments retain the runner's checks.
import assert from 'node:assert/strict';
import {isAbsolute,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const a=process.argv.slice(2);
assert.ok(a.length>=12,'--snapshot PATH --snapshot-sha256 SHA --receipt PATH --receipt-sha256 SHA --stage ABSENT_DIR -- <refresh arguments>');
assert.deepEqual([a[0],a[2],a[4],a[6],a[8],a[10]],['--snapshot','--snapshot-sha256','--receipt','--receipt-sha256','--stage','--']);
assert.ok([a[1],a[5],a[9]].every(isAbsolute));assert.ok([a[3],a[7]].every(x=>/^[a-f0-9]{64}$/.test(x)));
const root=resolve(import.meta.dirname,'..'),stage=resolve(a[9]);
const staged=spawnSync(process.execPath,[resolve(root,'scripts/stage-current-refresh-source-v1.mjs'),a[1],a[3],a[5],a[7],stage],
 {cwd:root,encoding:'utf8',maxBuffer:1024*1024});
if(staged.stdout)process.stderr.write(staged.stdout);if(staged.stderr)process.stderr.write(staged.stderr);
if(staged.error)throw staged.error;if(staged.status!==0)process.exit(staged.status??1);
const receipt=JSON.parse(staged.stdout.trim());assert.equal(receipt.accepted,true);assert.equal(receipt.source_files,183);
const run=spawnSync(process.execPath,['scripts/lib-refresh-v2.mjs',...a.slice(11)],{cwd:stage,stdio:'inherit',env:process.env});
if(run.error)throw run.error;process.exit(run.status??1);
