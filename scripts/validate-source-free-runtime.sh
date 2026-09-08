#!/usr/bin/env bash
set -euo pipefail

runtime="${1:-}"
case "$runtime" in
  node|bun|deno) ;;
  *) echo "usage: $0 <node|bun|deno>" >&2; exit 2 ;;
esac

command -v "$runtime" >/dev/null || { echo "missing runtime executable: $runtime" >&2; exit 1; }

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/wasmc-source-free.XXXXXX")"
stage_root="$temporary_root/deployment"
mkdir "$stage_root"
trap 'rm -rf "$temporary_root"' EXIT

worktree_index="$(git -C "$repo_root" rev-parse --git-path index)"
temporary_index="$temporary_root/git-index"
cp "$worktree_index" "$temporary_index"
staged_tree="$(GIT_INDEX_FILE="$temporary_index" git -C "$repo_root" write-tree)"
git -C "$repo_root" archive "$staged_tree" | tar -xf - -C "$stage_root"
test ! -e "$stage_root/.git" || { echo "deployment unexpectedly contains .git" >&2; exit 1; }
test -f "$stage_root/runtime/wasmc-runtime-v0/compiler.wasm"
test -f "$stage_root/runtime/wasmc-runtime-v0/bootstrap.mjs"

runtime_root="$stage_root/runtime/wasmc-runtime-v0"
output="$runtime_root/examples/ci-output.wasm"

case "$runtime" in
  node)
    (cd "$runtime_root" && node bootstrap.mjs self-test)
    (cd "$runtime_root" && node bootstrap.mjs compile --input examples/add.wasmc --output "$output")
    node "$stage_root/scripts/assert-runtime-output.mjs" "$output"
    ;;
  bun)
    (cd "$runtime_root" && bun bootstrap.mjs self-test)
    (cd "$runtime_root" && bun bootstrap.mjs compile --input examples/add.wasmc --output "$output")
    bun "$stage_root/scripts/assert-runtime-output.mjs" "$output"
    ;;
  deno)
    (cd "$runtime_root" && deno run --allow-read --allow-write bootstrap.mjs self-test)
    (cd "$runtime_root" && deno run --allow-read --allow-write bootstrap.mjs compile --input examples/add.wasmc --output "$output")
    deno run --allow-read "$stage_root/scripts/assert-runtime-output.mjs" "$output"
    ;;
esac

echo "PASS source-free staged deployment: runtime=$runtime git_metadata=absent"
