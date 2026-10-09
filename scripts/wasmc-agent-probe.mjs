import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// A captured negative subprocess result is distinct from successful execution.
const args = process.argv.slice(2), at = args.indexOf('--expected-compiler-sha256');
assert.ok(at >= 0, 'provide an independently expected compiler digest');
assert.match(args[at + 1] ?? '', /^[0-9a-f]{64}$/);
const result = spawnSync(process.execPath, [fileURLToPath(new URL('./wasmc-agent-execute.mjs', import.meta.url)), ...args], {
  encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024
});
assert.equal(result.error, undefined); assert.equal(result.signal, null);
assert.equal(result.status, 1, 'expected actual nonzero verifier exit');
assert.equal(result.stdout, '', 'digest rejection must precede execution');
const rejection = JSON.parse(result.stderr.trim());
assert.equal(rejection.accepted, false);
assert.equal(rejection.error, 'independent compiler digest mismatch');
assert.equal(rejection.expected, args[at + 1]); assert.notEqual(rejection.actual, rejection.expected);
console.log(JSON.stringify({ accepted: true, expected_rejection: true, verifier_exit_code: result.status,
  execution_accepted: false, verifier_stderr: rejection }));
