#!/usr/bin/env python3
"""Refresh manifest artifact identities and repository SHA256SUMS."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "manifest.json"
CHECKSUMS = ROOT / "SHA256SUMS"
PUBLIC_DOCS = ("AGENTS.md", "LANGUAGE.md", "HOSTING.md", "FASTAPI.md")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


manifest = json.loads(MANIFEST.read_text())
artifact_paths = [item["path"] for item in manifest["artifacts"]]
for path in PUBLIC_DOCS:
    if path not in artifact_paths:
        artifact_paths.insert(artifact_paths.index("dist/wasmc_compiler.wasm"), path)

manifest["artifacts"] = [
    {
        "path": path,
        "bytes": (ROOT / path).stat().st_size,
        "mode": "0755" if (ROOT / path).stat().st_mode & 0o111 else "0644",
        "sha256": digest(ROOT / path),
    }
    for path in artifact_paths
]
MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")

tracked = subprocess.run(
    ["git", "ls-files", "-z"],
    cwd=ROOT,
    check=True,
    capture_output=True,
).stdout.split(b"\0")
paths = sorted(
    path.decode()
    for path in tracked
    if path and path.decode() != "SHA256SUMS"
)
CHECKSUMS.write_text(
    "".join(f"{digest(ROOT / path)}  {path}\n" for path in paths)
)
