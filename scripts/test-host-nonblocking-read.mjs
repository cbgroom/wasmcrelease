import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== source) throw new Error('CI source mismatch');
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '';
if (process.env.GITHUB_SHA && dirty) throw new Error('CI requires clean exact source');
const output = execFileSync('cargo', ['test', '--release', '--locked', '--manifest-path',
  'host/completion/rust/Cargo.toml', '--lib', '--', '--test-threads=1'],
{ encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 });
process.stdout.write(output);
const result = /test result: ok\. (\d+) passed; 0 failed; 0 ignored;/.exec(output);
if (!result || Number(result[1]) !== 25) throw new Error('completion test coverage changed; review receipt contract');
const inputs = Object.fromEntries(['lib.rs', 'owner_supervisor.rs', 'nonblocking_tcp.rs'].map(name => {
  const path = `host/completion/rust/src/${name}`;
  return [path, createHash('sha256').update(readFileSync(path)).digest('hex')];
}));
const receipt = { schema_version: 1, source, source_dirty: dirty, platform: platform(), arch: arch(),
  passed: 25, added_nonblocking_controls: 10, inputs,
  scope: 'preopened exclusive TCP read owner + scoped supervisor; no reactor, guest async ABI or mobile proof' };
if (process.argv[2]) writeFileSync(process.argv[2], `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
