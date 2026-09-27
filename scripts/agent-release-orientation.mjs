#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const release = readJson('release.json');
const prod = readJson('channels/prod.json');
const quickstart = readJson('agent-quickstart.json');
const candidate = readJson(release.staged_product_manifest);
const route = quickstart.routes['release-orientation'];
const base64 = quickstart.routes['library-first-selection'];

assert.equal(release.schema, 'wasmc-public-release/v1');
assert.equal(release.stage, 'prod');
assert.equal(prod.stage, 'prod');
assert.equal(prod.version, release.version);
assert.equal(prod.tag, release.tag);
assert.equal(prod.product_candidate_commit, release.product_candidate_commit);
assert.equal(prod.product_set_sha256, candidate.product_set_sha256);
assert.equal(route.product_version, release.tag);
assert.equal(base64.product_release, release.tag);

const model = {
  schema: 'wasmc.agent-release-orientation/v1',
  scope: 'Complete compact authority for release orientation; do not read the full release artifact inventory unless a listed verification fails.',
  release: {
    version: release.version,
    tag: release.tag,
    stage: release.stage,
    stable: prod.stable,
    release_commit: release.source_commit,
    product_candidate_commit: release.product_candidate_commit,
    product_manifest: release.staged_product_manifest,
    product_set_sha256: candidate.product_set_sha256
  },
  public_agent_entrypoint: route.entrypoint,
  compiler: route.compiler,
  facade: route.facade,
  library_catalog: {
    release_snapshot: base64.catalog_release_snapshot,
    path: base64.catalog_path,
    sha256: base64.catalog_sha256,
    carried_forward: base64.catalog_snapshot_carried_forward
  },
  exact_authorities: ['agent-release-orientation.json', 'release.json', 'channels/prod.json', release.staged_product_manifest, 'manifest.json', 'SHA256SUMS'],
  verify: 'node scripts/agent-release-orientation.mjs --check',
  mutable_not_authority: route.mutable_not_authority,
  stop: 'For release orientation, report these exact identities after the check passes and stop. Do not scan the full manifest, catalogs, history or implementation tests.'
};
const encoded = `${JSON.stringify(model, null, 2)}\n`;
const output = resolve(root, 'agent-release-orientation.json');
const action = process.argv[2];
if (action === '--write') writeFileSync(output, encoded);
else if (action === '--check') assert.equal(readFileSync(output, 'utf8'), encoded, 'agent release orientation is stale');
else throw new Error('usage: agent-release-orientation.mjs --write|--check');
console.log(JSON.stringify({ accepted: true, action: action.slice(2), release: release.tag, bytes: Buffer.byteLength(encoded), product_set_sha256: candidate.product_set_sha256 }));
