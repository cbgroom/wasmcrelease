#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

required=(
  AGENTS.md
  LANGUAGE.md
  LIB.md
  .agents/MAINTAINERS.md
  .agents/HANDOFF.md
  .agents/skills.registry.yaml
  manifest.json
  package-index.json
  provenance.json
  SHA256SUMS
  runtime/README.md
  runtime/wasmc-runtime-v0/manifest.json
  runtime/registry-v0/registry.json
)
for path in "${required[@]}"; do
  test -f "$path" || { echo "missing required file: $path" >&2; exit 1; }
done

skill_paths=()
while IFS= read -r path; do skill_paths+=("$path"); done < <(
  awk '$1 == "path:" { print $2 }' .agents/skills.registry.yaml
)
test "${#skill_paths[@]}" -gt 0 || { echo "registry contains no skills" >&2; exit 1; }

for path in "${skill_paths[@]}"; do
  skill_file="$path/SKILL.md"
  test -f "$skill_file" || { echo "missing skill: $skill_file" >&2; exit 1; }
  head -n 1 "$skill_file" | grep -qx -- '---' || { echo "missing frontmatter: $skill_file" >&2; exit 1; }
  grep -q '^name: ' "$skill_file" || { echo "missing skill name: $skill_file" >&2; exit 1; }
  grep -q '^description: ' "$skill_file" || { echo "missing skill description: $skill_file" >&2; exit 1; }
done

while IFS= read -r skill_file; do
  skill_dir="${skill_file%/SKILL.md}"
  printf '%s\n' "${skill_paths[@]}" | grep -qx "$skill_dir" || {
    echo "orphan skill directory: $skill_dir" >&2
    exit 1
  }
done < <(find .agents/skills -mindepth 2 -maxdepth 2 -name SKILL.md | sort)

for heading in {0..8}; do
  grep -q "^## $heading\." .agents/HANDOFF.md || {
    echo "HANDOFF missing section $heading" >&2
    exit 1
  }
done

node scripts/validate-integrity.mjs

node --input-type=module <<'JS'
const facade = await import('./dist/wasmc.mjs');
const required = ['compile', 'compilePackage', 'compileLib', 'instantiateLib', 'createCompiler', 'inspectWasm'];
for (const name of required) {
  if (typeof facade[name] !== 'function') throw new Error(`missing facade export: ${name}`);
}
JS

node scripts/validate-agent-docs.mjs

echo "PASS maintainer structure, release integrity, and facade contract"
