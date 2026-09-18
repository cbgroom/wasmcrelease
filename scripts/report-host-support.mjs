import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "host", "manifest.json"), "utf8"));

const rows = [];
for (const platform of manifest.platforms) {
  const providers = JSON.parse(
    fs.readFileSync(path.join(root, "host", "platform", platform, "providers.json"), "utf8"),
  );
  const byCapability = new Map((providers.providers ?? []).map((provider) => [provider.capability, provider]));
  rows.push({
    platform,
    capabilities: Object.fromEntries(
      manifest.capabilities.map((capability) => {
        const provider = byCapability.get(capability);
        return [
          capability,
          {
            status: provider?.status ?? "missing",
            binding: provider?.binding ?? null,
            implementation: provider?.implementation ?? null,
          },
        ];
      }),
    ),
  });
}

const summary = {
  schema: "wasmc.host-support-report/v1",
  platforms: manifest.platforms.length,
  capabilities: manifest.capabilities.length,
  cells: manifest.platforms.length * manifest.capabilities.length,
  qualified: rows.reduce(
    (sum, row) => sum + Object.values(row.capabilities).filter((item) => item.status === "qualified").length,
    0,
  ),
  implemented: rows.reduce(
    (sum, row) => sum + Object.values(row.capabilities).filter((item) => item.status === "implemented").length,
    0,
  ),
  unimplemented: rows.reduce(
    (sum, row) => sum + Object.values(row.capabilities).filter((item) => item.status === "unimplemented").length,
    0,
  ),
};

if (process.argv.includes("--markdown")) {
  const header = ["Platform", ...manifest.capabilities];
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) =>
      `| ${[
        row.platform,
        ...manifest.capabilities.map((capability) => row.capabilities[capability].status),
      ].join(" | ")} |`,
    ),
    "",
    `Qualified: ${summary.qualified}; implemented-not-qualified: ${summary.implemented}; unimplemented: ${summary.unimplemented}; total cells: ${summary.cells}.`,
  ];
  console.log(lines.join("\n"));
} else {
  console.log(JSON.stringify({ ...summary, rows }));
}
