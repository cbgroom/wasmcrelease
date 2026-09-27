import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const manifest = readJson("host/manifest.json");
const architecture = readJson("host/architecture.json");
const boundary = readJson(manifest.boundary_contract);
const failures = [];

const expectedMechanisms = [
  "external-target",
  "opaque-resource",
  "bounded-window",
  "operation",
  "completion",
  "wait",
  "cancel",
  "release",
  "lib-defined-native-descriptor",
];
const retainedV015Domains = [
  "file", "memory", "tcp", "udp", "clock", "random",
  "camera", "audio", "display", "gpu", "npu",
];

if (architecture.schema !== "wasmc.host-architecture/v2") failures.push("invalid host architecture schema");
if (architecture.status !== "architecture-workstream-not-released") failures.push("Host v2 must remain explicitly unreleased");
if (architecture.guest_authority !== "exact-lib-package-wit") failures.push("exact Lib WIT must own public domain semantics");
if (manifest.schema !== "wasmc.host-layout/v2") failures.push("invalid Host layout schema");
if (manifest.domain_semantic_authority !== "exact-lib-package-wit") failures.push("manifest must route domain semantics to Lib WIT");
if (manifest.domain_physical_binding_authority !== "exact-lib-package-native-boundary-descriptor") failures.push("manifest must route physical bindings to exact Lib descriptors");
if (!Array.isArray(manifest.host_domain_capabilities) || manifest.host_domain_capabilities.length !== 0) failures.push("Host canonical domain capability inventory must be empty");
if (Object.hasOwn(manifest, "capabilities")) failures.push("legacy manifest.capabilities authority is forbidden");
if (manifest.legacy_domain_qualification?.future_extension_authority !== false) failures.push("legacy provider matrices must not be future extension authority");
if (manifest.legacy_domain_qualification?.new_domain_rows_allowed !== false) failures.push("legacy provider matrices must reject new domain rows");

if (boundary.schema !== "wasmc.lib-defined-host-boundary/v1") failures.push("invalid Lib-defined boundary schema");
if (boundary.status !== "architecture-workstream-not-released") failures.push("boundary must remain explicitly unreleased");
if (JSON.stringify(boundary.mechanisms) !== JSON.stringify(expectedMechanisms)) failures.push("boundary mechanism set drifted");
if (boundary.full_host_profile?.per_domain_grant_api !== false || boundary.full_host_profile?.per_domain_allowlist_api !== false) failures.push("full-host boundary must not add per-domain grant/allowlist APIs");
if (boundary.semantic_authority?.public_types !== "exact Lib package WIT") failures.push("boundary public types must be Lib-owned");
if (boundary.semantic_authority?.physical_binding !== "exact Lib package native boundary descriptor") failures.push("boundary physical binding must be Lib-owned");
if (boundary.release?.included_in_v0_0_15 !== false || boundary.release?.admitted !== false || boundary.release?.released !== false) failures.push("unreleased boundary lifecycle is overstated");

const forbiddenMechanismFragments = boundary.host_forbidden_domain_apis ?? [];
for (const mechanism of boundary.mechanisms ?? []) {
  for (const domain of forbiddenMechanismFragments) {
    if (mechanism.includes(domain)) failures.push(`domain leaked into fixed boundary mechanism: ${mechanism}`);
  }
}
if (architecture.boundary_rules?.rust_or_javascript_domain_api_growth !== false) failures.push("domain API growth must be forbidden");
if (architecture.boundary_rules?.descriptor_owned_by_exact_lib !== true) failures.push("native descriptors must be exact-Lib owned");
if (architecture.boundary_rules?.host_binary_unchanged_for_new_domain !== true) failures.push("new-domain Host identity must remain unchanged");
if ((architecture.domain_model?.host_inventory ?? ["missing"]).length !== 0) failures.push("architecture Host domain inventory must be empty");
const prototype = architecture.prototype;
if (prototype?.status !== "local-node-qualified-not-admitted-not-released") failures.push("prototype lifecycle is missing or overstated");
if (!fs.existsSync(path.join(root, prototype?.executor ?? "missing"))) failures.push("fixed boundary executor missing");
else {
  const executorHash = createHash("sha256").update(fs.readFileSync(path.join(root, prototype.executor))).digest("hex");
  if (executorHash !== prototype.executor_sha256) failures.push("fixed boundary executor identity drifted");
}
if (JSON.stringify(prototype?.system_libs) !== JSON.stringify([
  "libsrc/wasmc-system-file-prototype",
  "libsrc/wasmc-system-process-prototype",
  "libsrc/wasmc-system-network-prototype",
])) failures.push("prototype system Lib graph drifted");
for (const libRoot of prototype?.system_libs ?? []) {
  for (const required of ["candidate.json", "lib.wit", "native-boundary.json", "native-adapter.mjs"]) {
    if (!fs.existsSync(path.join(root, libRoot, required))) failures.push(`prototype system Lib file missing: ${libRoot}/${required}`);
  }
}

const architectureRoots = new Set((architecture.layers ?? []).map((layer) => layer.root));
for (const dir of ["contract", "core", "runtime", "drivers", "platform", "embedding", "sdk", "qualification"]) {
  if (!architectureRoots.has(`host/${dir}`)) failures.push(`architecture layer missing: host/${dir}`);
}
if (JSON.stringify(architecture.orthogonal_dimensions?.platform) !== JSON.stringify(manifest.platforms)) failures.push("architecture platform dimension must match manifest.platforms");
if (JSON.stringify(architecture.orthogonal_dimensions?.embedding) !== JSON.stringify(manifest.embeddings)) failures.push("architecture embedding dimension must match manifest.embeddings");
if (JSON.stringify(architecture.domain_model?.locality) !== JSON.stringify(["local", "remote"])) failures.push("domain locality dimension must remain local/remote");

for (const dir of manifest.canonical_roots) {
  const candidate = path.join(root, "host", dir);
  if (!fs.statSync(candidate, { throwIfNoEntry: false })?.isDirectory()) failures.push(`missing canonical root host/${dir}`);
}

const providerStatuses = new Set(["unimplemented", "implemented", "qualified"]);
let qualifiedLegacy = 0;
let implementedLegacy = 0;
for (const platform of manifest.platforms) {
  const platformRoot = path.join(root, "host", "platform", platform);
  if (!fs.statSync(platformRoot, { throwIfNoEntry: false })?.isDirectory()) failures.push(`missing platform root host/platform/${platform}`);
  const providersPath = path.join(platformRoot, "providers.json");
  if (!fs.existsSync(providersPath)) {
    failures.push(`missing retained provider evidence host/platform/${platform}/providers.json`);
    continue;
  }
  const providers = JSON.parse(fs.readFileSync(providersPath, "utf8"));
  if (providers.schema !== "wasmc.host-platform-providers/v1") failures.push(`invalid retained provider schema on ${platform}`);
  if (providers.platform !== platform) failures.push(`retained provider platform mismatch on ${platform}`);
  const domainRows = (providers.providers ?? []).map((provider) => provider.capability);
  if (JSON.stringify(domainRows) !== JSON.stringify(retainedV015Domains)) failures.push(`retained v0.0.15 domain rows changed on ${platform}`);
  for (const provider of providers.providers ?? []) {
    if (!providerStatuses.has(provider.status)) failures.push(`invalid retained provider status ${provider.status} on ${platform}/${provider.capability}`);
    if (provider.status === "unimplemented" && (provider.implementation || provider.qualification || provider.binding)) failures.push(`unimplemented retained provider claims implementation on ${platform}/${provider.capability}`);
    if (provider.status === "implemented") {
      implementedLegacy += 1;
      if (!provider.implementation) failures.push(`implemented retained provider lacks implementation on ${platform}/${provider.capability}`);
    }
    if (provider.status === "qualified") {
      qualifiedLegacy += 1;
      if (!provider.implementation || !fs.existsSync(path.join(root, provider.implementation))) failures.push(`qualified retained provider implementation missing on ${platform}/${provider.capability}`);
      if (!provider.qualification?.workflow || !fs.existsSync(path.join(root, provider.qualification.workflow))) failures.push(`qualified retained provider workflow missing on ${platform}/${provider.capability}`);
      if (!(provider.qualification?.architectures?.length > 0)) failures.push(`qualified retained provider architecture scope missing on ${platform}/${provider.capability}`);
    }
  }
}

for (const embedding of ["node", "deno", "bun", "browser"]) {
  const candidate = path.join(root, "host", "embedding", embedding);
  if (!fs.statSync(candidate, { throwIfNoEntry: false })?.isDirectory()) failures.push(`missing embedding root host/embedding/${embedding}`);
  if (fs.existsSync(path.join(root, "host", "platform", embedding))) failures.push(`execution environment must not be a platform: ${embedding}`);
}

const qualification = readJson("host/qualification/matrix.json");
for (const row of qualification.current_evidence ?? []) {
  if (row.scope === "embedding-only" && !String(row.embedding).startsWith("browser/")) failures.push(`embedding-only qualification is reserved for browser engines: ${row.embedding}`);
  if (row.scope === "platform×embedding" && (!row.platform || !row.embedding)) failures.push("platform×embedding qualification requires both dimensions");
  if (row.platform === "browser") failures.push("Browser must not appear as a physical platform");
}

if (manifest.legacy_paths_retained !== false) failures.push("legacy_paths_retained must be false");
for (const legacy of ["v0", "completion", "file-io", "tcp", "udp", "corelib-io", "lib-e2e", "browser"]) {
  if (fs.existsSync(path.join(root, "host", legacy))) failures.push(`legacy Host root is forbidden: host/${legacy}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  accepted: true,
  schema: manifest.schema,
  architecture: architecture.schema,
  boundary: boundary.schema,
  host_domain_capabilities: manifest.host_domain_capabilities.length,
  boundary_mechanisms: boundary.mechanisms.length,
  retained_v0_0_15_domains: retainedV015Domains.length,
  retained_qualified_provider_cells: qualifiedLegacy,
  retained_implemented_provider_cells: implementedLegacy,
  new_domain_extension: "exact-lib-package-only",
  prototype_executor_sha256: prototype.executor_sha256,
  prototype_system_libs: prototype.system_libs.length,
}));
