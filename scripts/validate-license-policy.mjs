import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

const policy = JSON.parse(await read("license-policy.json"));
assert.equal(policy.schema, "wasmc.license-policy/v1");
assert.equal(policy.applies_to, "current main and revisions containing this file");
assert.equal(policy.license, "WAsmC Research-Only Non-Commercial License 1.0");
assert.equal(policy.license_file, "LICENSE");
assert.equal(policy.source_available, true);
assert.equal(policy.open_source, false);
assert.equal(policy.commercial_use, false);
assert.equal(policy.production_use, false);
assert.deepEqual(policy.permissions, [
  "non-commercial research",
  "education",
  "evaluation",
  "reproducibility",
  "benchmarking",
]);
assert.equal(policy.commercial_license, "separate written agreement required");
assert.match(policy.immutable_prior_tags, /exact tag/);
assert.match(policy.immutable_prior_tags, /does not rewrite or revoke earlier grants/);
assert.equal(policy.check_command, "node scripts/validate-license-policy.mjs");

const license = await read("LICENSE");
assert.match(license, /^WAsmC Research-Only Non-Commercial License 1\.0$/m);
assert.match(license, /solely for Non-Commercial Research/);
assert.match(license, /Commercial use is not permitted without a separate written license/);
assert.match(license, /It is not an open-source license\./);
assert.doesNotMatch(license, /Permission is hereby granted, free of charge/);

const readme = await read("README.md");
assert.match(readme, /non-commercial research\nonly/);
assert.match(readme, /Immutable earlier tags retain the license text/);
assert.match(readme, /This is not an open-source license\./);

const contributing = await read("CONTRIBUTING.md");
assert.match(contributing, /External contributions are paused/);
assert.match(contributing, /do not submit a pull request/);

const agents = await read("AGENTS.md");
assert.match(agents, /^## License boundary$/m);
assert.match(agents, /read `license-policy\.json` and run its\s+named check/);
assert.match(agents, /source-available, not open source/);
assert.match(agents, /Do not claim that a current-main\s+policy retroactively rewrites or revokes an earlier grant/);

const quickstart = JSON.parse(await read("agent-quickstart.json"));
const quickstartRoute = quickstart.routes?.["license-policy"];
assert.equal(quickstartRoute?.authority_file, "license-policy.json");
assert.equal(quickstartRoute?.check_command, policy.check_command);
assert.deepEqual(quickstartRoute?.required_additional_reads, ["license-policy.json", "LICENSE"]);
assert.match(quickstartRoute?.decision ?? "", /non-commercial research only/);
assert.match(quickstartRoute?.prior_tag_rule ?? "", /does not rewrite or revoke an earlier grant/);

const expectedCargoLicenseFiles = new Map([
  ["host/contract/v0/rust/Cargo.toml", "../../../../LICENSE"],
  ["host/drivers/file/rust/Cargo.toml", "../../../../LICENSE"],
  ["host/drivers/memory/rust/Cargo.toml", "../../../../LICENSE"],
  ["host/drivers/tcp/rust/Cargo.toml", "../../../../LICENSE"],
  ["host/drivers/udp/rust/Cargo.toml", "../../../../LICENSE"],
  ["sdk/wasmc-core-runtime/Cargo.toml", "../../LICENSE"],
  ["sdk/wasmc-host/Cargo.toml", "../../LICENSE"],
  ["sdk/wasmc-native-compiler/Cargo.toml", "../../LICENSE"],
]);

for (const [relative, expected] of expectedCargoLicenseFiles) {
  const manifest = await read(relative);
  assert.doesNotMatch(manifest, /^license\s*=/m, `${relative} grants an unexpected SPDX license`);
  assert.ok(manifest.split("\n").includes(`license-file = "${expected}"`), `${relative} is not bound to the repository license`);
  await readFile(path.resolve(path.dirname(path.join(root, relative)), expected));
}

async function walk(directory, relative = "") {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "target") continue;
    const childRelative = path.join(relative, entry.name);
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(child, childRelative));
    else found.push(childRelative);
  }
  return found;
}

for (const relative of await walk(root)) {
  if (!/\.(?:md|json|toml|txt|mjs|js|rs|wit)$/.test(relative) && path.basename(relative) !== "LICENSE") continue;
  const content = await read(relative);
  assert.doesNotMatch(content, /license\s*=\s*["']MIT OR Apache-2\.0["']/i, `${relative} retains the old dual-license grant`);
  if (relative !== "scripts/validate-license-policy.mjs") {
    assert.doesNotMatch(content, /^MIT License$/m, `${relative} retains an MIT license declaration`);
  }
}

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.license-policy/v1",
  policy: "research-only-non-commercial",
  open_source: false,
  commercial_use: false,
  production_use: false,
  cargo_manifests_bound: expectedCargoLicenseFiles.size,
  immutable_prior_tags_preserved: true,
}));
