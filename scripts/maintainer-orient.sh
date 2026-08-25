#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "repository: $repo_root"
git status --short --branch
printf 'head: '
git rev-parse HEAD
printf 'latest release: '
python3 -c 'import json; print(json.load(open("package-index.json"))["latest"])'
printf 'manifest: '
python3 -c 'import json; m=json.load(open("manifest.json")); print(m["release_id"], "released=" + str(m["released"]).lower())'
echo "facade exports:"
node -e 'import("./dist/wasmc.mjs").then(m => console.log(Object.keys(m).sort().join(", ")))'
./scripts/validate-maintainer.sh
echo "handoff: .agents/HANDOFF.md"
echo "registry: .agents/skills.registry.yaml"
