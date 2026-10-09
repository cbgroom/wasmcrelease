import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAgentRoute, readPublishedLifecycle } from './agent-routes.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const opts = {}, args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: node scripts/agent-library-check.mjs --codec CODEC --text TEXT\nCODEC: base64 or hex. Read and approve the selected Root Skill and WIT API first.');
  process.exit(0);
}
for (let i = 0; i < args.length; i += 2) opts[args[i]] = args[i + 1];
const codec = opts['--codec'], text = opts['--text'];
assert.ok(['base64', 'hex'].includes(codec) && typeof text === 'string');
const route = loadAgentRoute('library-first-selection');
const run = argv => {
  const bytes = execFileSync(process.execPath, argv, { cwd: root, timeout: 30000 });
  return { value: JSON.parse(bytes), stdout_sha256: createHash('sha256').update(bytes).digest('hex') };
};
const search = run(['scripts/wasmc-lib.mjs', 'search', codec, '--catalog-sha256', route.catalog_sha256, '--limit', '8']);
assert.equal(search.value.selection_authority, false); assert.equal(search.value.result.tag, 'ok');
const suffixes = codec === 'hex' ? ['try-encode-lower', 'try-decode'] : ['try-encode-standard', 'try-decode-standard'];
const apis = suffixes.map(s => `${route.package}/${codec}#${s}`);
for (const api of apis) assert.ok(search.value.result.value.some(hit => hit.wit_route === api && hit.profile === 'resource'), `missing exact API search hit: ${api}`);
const rootPath = route.required_additional_reads[0].slice(0, -'/SKILL.md'.length);
assert.ok(readFileSync(resolve(root, rootPath, 'SKILL.md')).length > 0);
const wit = readFileSync(resolve(root, rootPath, 'lib.wit'), 'utf8');
const body = wit.match(new RegExp(`interface ${codec} \\{([\\s\\S]*?)\\n\\}`))?.[1]; assert.ok(body);
for (const suffix of suffixes) assert.ok(body.includes(suffix + ': func('));
const lifecycle = readPublishedLifecycle(); assert.equal(lifecycle.states.installable, true, 'stop before resolution without publication');
const resolved = run(route.resolve.split(' ').slice(1)); assert.equal(resolved.value.verified, true); assert.equal(resolved.value.authority_granted, false);
const behavior = codec === 'base64' && text === 'abc'
  ? run(['examples/base64/run.mjs']) : run(['examples/lib-bytes/run.mjs', '--codec', codec, '--text', text]);
assert.equal(behavior.value.accepted, true); assert.equal(behavior.value.package, route.package); assert.deepEqual(behavior.value.apis, apis);
assert.equal(behavior.value.encoded_utf8, Buffer.from(text).toString(codec)); assert.equal(behavior.value.decoded_utf8, text);
assert.equal(behavior.value.invalid_input_rejected, true); assert.equal(behavior.value.explicit_drops, 1024);
const report = `Package: ${route.package}\nAPIs:\n${apis.map(api => '- ' + api).join('\n')}\nSearch discovered the candidate but was not authority.\nResolve verified catalog_sha256, manifest_sha256, root_inventory_sha256, wit_sha256 and artifact_sha256.\nBehavior separately verified companion_sha256 and import_module and passed.`;
console.log(JSON.stringify({ ...behavior.value, codec, selected_Root_verified: true, imports_verified: true,
  states: lifecycle.states, authority_granted: false, search_wit_routes: apis,
  stage_receipts: { search: search.stdout_sha256, resolve: resolved.stdout_sha256, behavior: behavior.stdout_sha256 },
  report_text: report }));
