import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "host", "manifest.json"), "utf8"));
const platformRows = manifest.platforms.map((platform) => ({
  platform,
  providers: JSON.parse(fs.readFileSync(path.join(root, "host", "platform", platform, "providers.json"), "utf8")).providers ?? [],
}));
const domains = platformRows[0]?.providers.map((provider) => provider.capability) ?? [];
const rows = platformRows.map(({ platform, providers }) => ({
  platform,
  domains: Object.fromEntries(providers.map((provider) => [provider.capability, {
    status: provider.status,
    binding: provider.binding ?? null,
    implementation: provider.implementation ?? null,
  }])),
}));
const count = (status) => rows.reduce(
  (sum, row) => sum + Object.values(row.domains).filter((entry) => entry.status === status).length,
  0,
);
const summary = {
  schema: "wasmc.host-legacy-domain-evidence-report/v2",
  authority: "v0.0.15-migration-evidence-only",
  future_extension_authority: false,
  host_domain_capabilities: manifest.host_domain_capabilities.length,
  platforms: manifest.platforms.length,
  retained_domains: domains.length,
  retained_cells: manifest.platforms.length * domains.length,
  qualified: count("qualified"),
  implemented: count("implemented"),
  unimplemented: count("unimplemented"),
};

if (process.argv.includes("--markdown")) {
  const header = ["Platform", ...domains];
  const lines = [
    "Retained v0.0.15 migration evidence only; future domains are exact Lib packages and do not add Host rows.",
    "",
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${[row.platform, ...domains.map((domain) => row.domains[domain].status)].join(" | ")} |`),
    "",
    `Host canonical domain capabilities: 0. Retained qualified: ${summary.qualified}; implemented-not-qualified: ${summary.implemented}; unimplemented: ${summary.unimplemented}.`,
  ];
  console.log(lines.join("\n"));
} else {
  console.log(JSON.stringify({ ...summary, rows }));
}
