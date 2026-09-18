import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "host", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const failures = [];
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
  capabilities: manifest.capabilities.length,
  legacy_paths_retained: manifest.legacy_paths_retained
}));
