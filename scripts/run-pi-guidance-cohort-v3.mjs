import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const protocolBytes = readFileSync(join(root, 'agent-evaluation/fresh-agent-learning-v3.json'));
const protocol = JSON.parse(protocolBytes);
const v2 = JSON.parse(readFileSync(join(root, 'agent-evaluation/fresh-agent-learning-v2.json')));
assert.equal(protocol.schema, 'wasmc.fresh-agent-learning/v3');
assert.deepEqual(protocol.cases.slice(0, 6), v2.cases, 'original frozen six cases must not change');
assert.deepEqual(protocol.cohort_gate, v2.cohort_gate, 'preserve exact models and thresholds');
assert.equal(protocol.cases.length, 10); assert.equal(protocol.repeat_policy.fresh_rounds, 3);
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) options[args[i]] = args[i + 1];
const commit = options['--commit'], output = options['--out-dir'];
assert.match(commit ?? '', /^[0-9a-f]{40}$/); assert.ok(output);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), '', 'freeze a clean guidance commit before evaluated runs');
assert.equal(git('rev-parse', 'HEAD'), commit);
const tree = git('rev-parse', `${commit}^{tree}`); mkdirSync(output, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
assert.equal(sha(execFileSync('git', ['show', `${commit}:agent-evaluation/fresh-agent-learning-v3.json`], { cwd: root })), sha(protocolBytes));
const reports = [];
for (let round = 1; round <= 3; round++) {
  const results = await Promise.all(protocol.cohort_gate.required_models.map(model => new Promise((resolvePromise, reject) => {
    const path = resolve(output, `round-${round}-${model.identity}.json`);
    const child = spawn(process.execPath, ['scripts/run-pi-learning-model-v3.mjs', '--commit', commit,
      '--model', `${model.provider}/${model.identity}`, '--out', path, '--timeout-ms', '300000'], { cwd: root, stdio: 'inherit' });
    child.once('error', reject); child.once('close', exit => resolvePromise({ round, model, path, exit_code: exit }));
  })));
  reports.push(...results);
  writeFileSync(join(output, 'progress.json'), JSON.stringify({ guidance_commit: commit, guidance_tree: tree, protocol_sha256: sha(protocolBytes), reports }, null, 2) + '\n');
  if (results.some(row => row.exit_code !== 0)) break;
}
const accepted = reports.length === 6 && reports.every(row => row.exit_code === 0);
const result = { accepted, scope: 'structural-guidance-experiment-only; independent semantic and artifact review required, not whole-product release qualification',
  guidance_commit: commit, guidance_tree: tree, protocol_sha256: sha(protocolBytes), planned_rounds: 3, completed_rounds: reports.length / 2,
  models: 2, cases: reports.length * 10, stopped_on_failed_round: !accepted, reports };
writeFileSync(join(output, 'cohort.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
if (!accepted) process.exitCode = 1;
