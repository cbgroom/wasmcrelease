#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "repository: $repo_root"
git status --short --branch
printf 'head: '
git rev-parse HEAD
printf 'latest release: '
node -e 'console.log(JSON.parse(require("fs").readFileSync("package-index.json","utf8")).latest)'
printf 'manifest: '
node -e 'const m=JSON.parse(require("fs").readFileSync("manifest.json","utf8")); console.log(m.release_id, `released=${String(m.released)}`)'
echo "facade exports:"
node -e 'import("./dist/wasmc.mjs").then(m => console.log(Object.keys(m).sort().join(", ")))'
./scripts/validate-maintainer.sh
echo "handoff: .agents/HANDOFF.md"
echo "registry: .agents/skills.registry.yaml"
