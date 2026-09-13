import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== source) throw new Error('CI source mismatch');
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '';
if (process.env.GITHUB_SHA && dirty) throw new Error('CI requires clean exact source');
const readiness = process.argv.includes('--readiness');
const receiptPath = process.argv.slice(2).find(arg => arg !== '--readiness');
const features = readiness ? ['--features', 'native-readiness'] : [];
const output = execFileSync('cargo', ['test', '--release', '--locked', '--manifest-path',
  'host/completion/rust/Cargo.toml', ...features, '--lib', '--', '--test-threads=1'],
{ encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 });
process.stdout.write(output);
const result = /test result: ok\. (\d+) passed; 0 failed; 0 ignored;/.exec(output);
const expected = readiness ? 42 : 25;
if (!result || Number(result[1]) !== expected) throw new Error('completion test coverage changed; review receipt contract');
const paths = ['lib.rs', 'owner_supervisor.rs', 'nonblocking_tcp.rs', ...(readiness ? ['readiness.rs', 'read_reactor.rs', 'nonblocking_udp.rs'] : [])]
  .map(name => `host/completion/rust/src/${name}`);
paths.push('host/completion/rust/Cargo.toml', 'host/completion/rust/Cargo.lock');
const inputs = Object.fromEntries(paths.map(path => {
  return [path, createHash('sha256').update(readFileSync(path)).digest('hex')];
}));
const receipt = { schema_version: 1, source, source_dirty: dirty, platform: platform(), arch: arch(),
  passed: expected, added_nonblocking_controls: 10, readiness_controls: readiness ? 6 : 0, inputs,
  shared_reactor_controls: readiness ? 8 : 0,
  datagram_owner_controls: readiness ? 3 : 0,
  profile: readiness ? 'native-readiness' : 'default',
  scope: 'preopened exclusive TCP/connected-UDP read owners + scoped supervisor; optional bounded OS reactor, no guest Future/executor or mobile proof' };
if (receiptPath) writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
