import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "host", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const architecturePath = path.join(root, "host", "architecture.json");
const architecture = JSON.parse(fs.readFileSync(architecturePath, "utf8"));

const failures = [];
if (architecture.schema !== "wasmc.host-architecture/v1") {
  failures.push("invalid host/architecture.json schema");
}
if (architecture.guest_authority !== "host/contract") {
  failures.push("contract must remain the only Guest ABI authority");
}
const architectureRoots = new Set((architecture.layers ?? []).map((layer) => layer.root));
for (const dir of ["contract", "core", "runtime", "drivers", "platform", "embedding", "sdk", "qualification"]) {
  if (!architectureRoots.has(`host/${dir}`)) {
    failures.push(`architecture layer missing: host/${dir}`);
  }
}
if (JSON.stringify(architecture.orthogonal_dimensions?.platform) !== JSON.stringify(manifest.platforms)) {
  failures.push("architecture platform dimension must match manifest.platforms");
}
if (JSON.stringify(architecture.orthogonal_dimensions?.embedding) !== JSON.stringify(manifest.embeddings)) {
  failures.push("architecture embedding dimension must match manifest.embeddings");
}
if (manifest.capabilities.includes("remote")) {
  failures.push("remote must be modeled as locality/provider state, not a canonical capability");
}
if (JSON.stringify(architecture.resource_dimensions?.locality) !== JSON.stringify(["local", "remote"])) {
  failures.push("resource locality dimension must be exactly local/remote");
}
const providerStatuses = new Set(architecture.provider_statuses ?? []);
const allowedImplementationRoots = architecture.provider_rules?.implementation_allowed_roots ?? [];
const forbiddenImplementationRoots = architecture.provider_rules?.implementation_forbidden_roots ?? [];
for (const dir of manifest.canonical_roots) {
  const p = path.join(root, "host", dir);
  if (!fs.statSync(p, { throwIfNoEntry: false })?.isDirectory()) {
    failures.push(`missing canonical root host/${dir}`);
  }
}
for (const platform of manifest.platforms) {
  const p = path.join(root, "host", "platform", platform);
  if (!fs.statSync(p, { throwIfNoEntry: false })?.isDirectory()) {
    failures.push(`missing platform root host/platform/${platform}`);
  }
  const providersPath = path.join(p, "providers.json");
  if (!fs.existsSync(providersPath)) {
    failures.push(`missing platform provider binding host/platform/${platform}/providers.json`);
    continue;
  }
  const providers = JSON.parse(fs.readFileSync(providersPath, "utf8"));
  if (providers.schema !== "wasmc.host-platform-providers/v1") {
    failures.push(`invalid platform provider schema: host/platform/${platform}/providers.json`);
  }
  if (providers.platform !== platform) {
    failures.push(`platform provider identity mismatch: host/platform/${platform}/providers.json`);
  }
  const seenCapabilities = new Set();
  for (const provider of providers.providers ?? []) {
    if (!manifest.capabilities.includes(provider.capability)) {
      failures.push(`unknown platform capability ${provider.capability} on ${platform}`);
    }
    if (seenCapabilities.has(provider.capability)) {
      failures.push(`duplicate platform capability ${provider.capability} on ${platform}`);
    }
    seenCapabilities.add(provider.capability);
    if (!providerStatuses.has(provider.status)) {
      failures.push(`invalid provider status ${provider.status} for ${platform}/${provider.capability}`);
    }
    if (provider.status === "unqualified") {
      failures.push(`legacy ambiguous provider status is forbidden: ${platform}/${provider.capability}`);
    }
    if (provider.implementation) {
      const normalized = provider.implementation.replaceAll("\\", "/");
      if (normalized.includes("..")) {
        failures.push(`provider implementation may not escape Host tree: ${provider.implementation}`);
      }
      if (!allowedImplementationRoots.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
        failures.push(`provider implementation outside allowed roots: ${provider.implementation}`);
      }
      if (forbiddenImplementationRoots.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
        failures.push(`provider implementation uses forbidden root: ${provider.implementation}`);
      }
    }
    if (provider.status === "unimplemented" && (provider.implementation || provider.qualification || provider.binding)) {
      failures.push(`unimplemented provider must not claim binding/evidence: ${platform}/${provider.capability}`);
    }
    if (provider.status === "implemented" && !provider.implementation) {
      failures.push(`implemented provider lacks implementation: ${platform}/${provider.capability}`);
    }
    if (provider.status === "qualified") {
      if (!provider.implementation) {
        failures.push(`qualified provider lacks implementation: ${platform}/${provider.capability}`);
      } else if (!fs.existsSync(path.join(root, provider.implementation))) {
        failures.push(`qualified provider implementation missing: ${provider.implementation}`);
      }
      if (!provider.qualification?.workflow) {
        failures.push(`qualified provider lacks workflow evidence: ${platform}/${provider.capability}`);
      } else if (!fs.existsSync(path.join(root, provider.qualification.workflow))) {
        failures.push(`qualified provider workflow missing: ${provider.qualification.workflow}`);
      }
      if (!(provider.qualification?.architectures?.length > 0)) {
        failures.push(`qualified provider lacks architecture scope: ${platform}/${provider.capability}`);
      }
    }
  }
  for (const capability of manifest.capabilities) {
    if (!seenCapabilities.has(capability)) {
      failures.push(`platform capability state must be explicit: ${platform}/${capability}`);
    }
  }
  if (seenCapabilities.size !== manifest.capabilities.length) {
    failures.push(`platform provider manifest must cover every canonical capability exactly once: ${platform}`);
  }
}
for (const embedding of ["node", "deno", "bun", "browser"]) {
  const p = path.join(root, "host", "embedding", embedding);
  if (!fs.statSync(p, { throwIfNoEntry: false })?.isDirectory()) {
    failures.push(`missing embedding root host/embedding/${embedding}`);
  }
}
for (const forbidden of ["node", "deno", "bun", "browser"]) {
  const p = path.join(root, "host", "platform", forbidden);
  if (fs.existsSync(p)) failures.push(`execution environment must not be a platform: host/platform/${forbidden}`);
}

const forbiddenTopLevel = manifest.platforms
  .map((p) => path.join(root, "host", `${p}-host`))
  .filter((p) => fs.existsSync(p));
for (const p of forbiddenTopLevel) {
  failures.push(`platform Host API fork is forbidden: ${path.relative(root, p)}`);
}


const qualification = JSON.parse(fs.readFileSync(path.join(root, "host", "qualification", "matrix.json"), "utf8"));
for (const row of qualification.current_evidence ?? []) {
  if (row.scope === "embedding-only" && !String(row.embedding).startsWith("browser/")) {
    failures.push(`embedding-only qualification is reserved for browser engines: ${row.embedding}`);
  }
  if (row.scope === "platform×embedding" && (!row.platform || !row.embedding)) {
    failures.push("platform×embedding qualification requires both dimensions");
  }
  if (row.platform === "browser") failures.push("Browser must not appear as a physical platform");
}

if (manifest.legacy_paths_retained !== false) {
  failures.push("legacy_paths_retained must be false for the canonical Host tree");
}

for (const legacy of ["v0", "completion", "file-io", "tcp", "udp", "corelib-io", "lib-e2e", "browser"]) {
  const p = path.join(root, "host", legacy);
  if (fs.existsSync(p)) failures.push(`legacy Host root is forbidden: host/${legacy}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  accepted: true,
  schema: manifest.schema,
  canonical_roots: manifest.canonical_roots.length,
  platforms: manifest.platforms.length,
  qualified_platform_providers: manifest.platforms
    .flatMap((platform) => JSON.parse(fs.readFileSync(path.join(root, "host", "platform", platform, "providers.json"), "utf8")).providers ?? [])
    .filter((provider) => provider.status === "qualified").length,
  implemented_unqualified_platform_providers: manifest.platforms
    .flatMap((platform) => JSON.parse(fs.readFileSync(path.join(root, "host", "platform", platform, "providers.json"), "utf8")).providers ?? [])
    .filter((provider) => provider.status === "implemented").length,
  capabilities: manifest.capabilities.length,
  legacy_paths_retained: manifest.legacy_paths_retained
}));
