#!/usr/bin/env node
// Run reviewed public adapters through an explicitly selected private producer.
// Never build compiler/provider sources or put private inputs in this repository.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {snapshotBuildInputs,verifyBuildInputsUnchanged} from './current-v2-build-input-snapshot.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [producerArg, workArg, selectedId] = process.argv.slice(2);
assert.ok(producerArg && workArg, 'usage: build-current-v2-portable.mjs PRIVATE_PRODUCER PRIVATE_EMPTY_OUTPUT');
const producer = resolve(producerArg);
const work = resolve(workArg);
assert.ok(work.startsWith(producer + '/'), 'output must be inside the selected private producer');
assert.ok(!work.startsWith(root + '/'), 'no private build in public checkout');
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, {
  cwd, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 600000,
  env: { ...process.env, RUSTUP_TOOLCHAIN: '1.96.0' },
}).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const authority = run('git', ['rev-parse', 'HEAD']);
assert.equal(run('git',['status','--porcelain']),'','public input tree must be clean');
const producerAuthority = run('git', ['rev-parse', 'HEAD'], producer);
assert.equal(producerAuthority, '3b797a77d0afa25264a11362603b0d596d2e0ba7');
assert.equal(run('git', ['status', '--porcelain'], producer), '', 'producer must be clean');
const source = path => execFileSync('git', ['show', `${authority}:${path}`], { cwd: root });
const privateSource = path => execFileSync('git', ['show', `${producerAuthority}:${path}`], { cwd: producer });
const recovered = {
  'wasmc-host-clock': 'wasmc_lib_host_candidate_v0',
  'wasmc-owned-algorithms': 'wasmc_lib_dual_view_candidate_v0',
  'wasmc-resource-counter': 'wasmc_lib_resource_candidate_v0',
};
mkdirSync(work); // Fail on reused output; retain evidence for inspection.
const rows = [];
// Router's standalone WAT needs a real zero-dependency publication path;
// do not invent a dependency to satisfy the composition input schema.
const cohort = ['wasmc-http1', 'wasmc-data-core', ...Object.keys(recovered)];
assert.ok(!selectedId || cohort.includes(selectedId), 'unknown selected package');
for (const id of selectedId ? [selectedId] : cohort) {
  const prefix = `libsrc/${id}`;
  const canonical = recovered[id] && `examples/${recovered[id]}`;
  const originalSpec = canonical && JSON.parse(privateSource(`${canonical}/lib.build.json`));
  const candidate = canonical ? { version: originalSpec.skill.version }
    : JSON.parse(source(`${prefix}/candidate.json`));
  const delta = JSON.parse(source(`libs/${id}/references/agent-delta.json`));
  const builds = [];
  for (const pass of ['first', 'second']) {
    const workspace = join(work, id, pass, 'workspace');
    const publication = join(work, id, pass, 'package');
    mkdirSync(workspace, { recursive: true });
    mkdirSync(publication);
    const inputPrefix = canonical ? `${canonical}/workspace` : prefix;
    const inputCommit = canonical ? producerAuthority : authority;
    for (const path of run('git', ['ls-tree', '-r', '--name-only', inputCommit, inputPrefix], canonical ? producer : root).split('\n')) {
      const dest = canonical ? join(workspace, relative(inputPrefix, path))
        : join(workspace, 'adapter', relative(prefix, path));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, canonical ? privateSource(path) : source(path));
    }
    // Preserve the adapter's existing relative license path in staging.
    writeFileSync(join(work, id, pass, 'LICENSE'), source('LICENSE'));
    const wit = canonical ? privateSource(`${canonical}/lib.wit`) : source(`${prefix}/${candidate.wit}`);
    if (canonical) assert.deepEqual(wit, source(`libs/${id}/lib.wit`), `${id}: recovered WIT identity differs`);
    writeFileSync(join(workspace, 'lib.wit'), wit);
    // The canonical fixture's crate macro uses ../../lib.wit. Keep that
    // reviewed relative input layout intact instead of editing its source.
    if (canonical) writeFileSync(join(dirname(workspace), 'lib.wit'), wit);
    const spec = originalSpec || {
      schema: 'wasmc.lib-build/v0', wit: 'lib.wit',
      skill: { name: id, version: candidate.version, description: id === 'wasmc-http1'
        ? 'Bounded HTTP/1 request parsing, framing and response-head serialization without network authority.'
        : 'Bounded six-type columnar batch validation and row selection without host authority.' },
      apis: delta.apis.map(row => ({ api: row.api, ecosystem: row.ecosystem,
        origin: 'adapted', support: 'supported', implementation: 'lib', host_authorities: [],
        delta: id === 'wasmc-http1'
          ? 'Finite HTTP/1 wire subset with explicit byte/header limits and typed errors; no sockets, TLS, HTTP/2 or streaming.'
          : 'Reviewed six-type columnar snapshot subset and bounded typed failures; no arbitrary Arrow ABI or host IO.' })),
    };
    if (canonical) {
      // Use the exact canonical build contract, not a replacement inferred
      // from the historical binary's exports.
    } else {
      const artifactName = candidate.build.artifact.split('/').at(-1).replace(/\.wasm$/, '');
      assert.match(artifactName, /^[a-z0-9_]+$/);
      spec.rust = { artifact_name: artifactName, crate_dir: 'adapter', profile: 'wit-bindgen-component' };
    }
    writeFileSync(join(workspace, 'lib.build.json'), JSON.stringify(spec, null, 2) + '\n');
    const witnessOptions={siblingWit:Boolean(canonical)};
    const sourceInputs=snapshotBuildInputs(workspace,witnessOptions);
    const report = JSON.parse(run(join(producer, 'target/debug/wasmc'), [
      'lib', 'build', '--workspace', workspace, '--publication', publication, join(workspace, 'lib.build.json'),
    ], producer));
    verifyBuildInputsUnchanged(workspace,sourceInputs,witnessOptions);
    const packageRoot = join(publication, id);
    run(join(producer, 'target/debug/wasmc'), ['lib', 'verify', packageRoot], producer);
    const inventory = {};
    const walk = dir => { for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else { const bytes = readFileSync(path); inventory[relative(packageRoot, path)] = { bytes: bytes.length, sha256: hash(bytes) }; }
    }};
    walk(packageRoot);
    builds.push({ report, inventory, source_inputs:sourceInputs, build_inputs_unchanged:true });
  }
  assert.deepEqual(builds[1].inventory, builds[0].inventory, `${id}: complete package second-build drift`);
  assert.deepEqual(builds[1].source_inputs,builds[0].source_inputs,`${id}: independent build input drift`);
  rows.push({ id, version: candidate.version, builds, strict_reopen: true,
    implementation_source_authority: canonical ? producerAuthority : authority,
    canonical_source_recovered: Boolean(canonical),
    complete_second_build_byte_identical: true, release_qualified: false });
}
const receipt = { schema: 'wasmc.current-v2-portable-build/v1', source_authority: authority,
  producer_authority: producerAuthority, packages: rows, release_qualified: false };
writeFileSync(join(work, 'build-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({accepted:true,packages:rows.map(row=>({id:row.id,version:row.version,
  artifact:row.builds[0].report.artifact,component:row.builds[0].report.component,
  strict_reopen:true,complete_second_build_byte_identical:true})),release_qualified:false}));
