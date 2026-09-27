import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("host/manifest.json", "utf8"));
const architecture = JSON.parse(fs.readFileSync("host/architecture.json", "utf8"));
const boundary = JSON.parse(fs.readFileSync(manifest.boundary_contract, "utf8"));
const linux = JSON.parse(fs.readFileSync("host/platform/linux/providers.json", "utf8"));

const rejection = (candidate) => {
  if (Object.hasOwn(candidate.manifest, "capabilities")) return "legacy-host-capability-authority";
  if ((candidate.manifest.host_domain_capabilities ?? []).length) return "host-domain-capability-added";
  if (candidate.boundary.full_host_profile?.per_domain_grant_api !== false) return "per-domain-grant-api-added";
  if (candidate.boundary.full_host_profile?.per_domain_allowlist_api !== false) return "per-domain-allowlist-api-added";
  for (const mechanism of candidate.boundary.mechanisms ?? []) {
    if ((candidate.boundary.host_forbidden_domain_apis ?? []).some((domain) => mechanism.includes(domain))) {
      return "domain-specific-boundary-mechanism";
    }
  }
  if (candidate.providerDomains.length !== linux.providers.length) return "legacy-provider-domain-growth";
  return null;
};

const baseline = {
  manifest: structuredClone(manifest),
  architecture: structuredClone(architecture),
  boundary: structuredClone(boundary),
  providerDomains: linux.providers.map((provider) => provider.capability),
};
assert.equal(rejection(baseline), null);

const mutations = [
  ["legacy-host-capability-authority", (value) => { value.manifest.capabilities = ["process"]; }],
  ["host-domain-capability-added", (value) => { value.manifest.host_domain_capabilities.push("process"); }],
  ["per-domain-grant-api-added", (value) => { value.boundary.full_host_profile.per_domain_grant_api = true; }],
  ["per-domain-allowlist-api-added", (value) => { value.boundary.full_host_profile.per_domain_allowlist_api = true; }],
  ["domain-specific-boundary-mechanism", (value) => { value.boundary.mechanisms.push("file-open"); }],
  ["legacy-provider-domain-growth", (value) => { value.providerDomains.push("process"); }],
];

for (const [expected, mutate] of mutations) {
  const candidate = structuredClone(baseline);
  mutate(candidate);
  assert.equal(rejection(candidate), expected);
}

assert.equal(architecture.boundary_rules.host_binary_unchanged_for_new_domain, true);
assert.equal(architecture.domain_model.semantic_authority, "exact Lib package WIT");
assert.equal(architecture.domain_model.physical_binding_authority, "matching exact Lib package native boundary descriptor");
assert.equal(boundary.platform_convergence.device_selection_owned_by_lib, true);
assert.equal(boundary.platform_convergence.device_names_in_fixed_host, false);
assert.match(boundary.platform_convergence.linux, /VFS.*file descriptors.*procfs.*sysfs/);
assert.equal(architecture.prototype.linux_native.executor, "host/runtime/lib-boundary/native-linux");
assert.equal(architecture.prototype.linux_native.system_lib, "libsrc/wasmc-system-linux-endpoint");

console.log(JSON.stringify({
  accepted: true,
  schema: "wasmc.lib-defined-host-boundary-regression/v1",
  positive_controls: 1,
  rejection_controls: mutations.length,
  host_domain_capabilities: 0,
  linux_device_names_in_fixed_host: 0,
}));
