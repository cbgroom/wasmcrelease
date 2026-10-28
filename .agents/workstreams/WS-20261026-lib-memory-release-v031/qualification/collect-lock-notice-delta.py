#!/usr/bin/env python3
"""Collect original license snapshots missing from an existing notice inventory.

This is a review candidate, not a declaration of license completeness.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile
import tomllib

sha = lambda data: hashlib.sha256(data).hexdigest()
parser = argparse.ArgumentParser()
parser.add_argument('--lock', required=True, type=Path)
parser.add_argument('--lock-sha256', required=True)
parser.add_argument('--notices-dir', required=True, type=Path)
parser.add_argument('--cargo-cache', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--rust-copyright', type=Path)
parser.add_argument('--rust-copyright-sha256')
parser.add_argument('--rust-version')
args = parser.parse_args()
lock_bytes = args.lock.read_bytes()
if sha(lock_bytes) != args.lock_sha256:
    raise SystemExit('lock digest mismatch')
notice_files = sorted(args.notices_dir.glob('DEPENDENCY-NOTICES-[0-9][0-9][0-9].txt'))
if not notice_files:
    raise SystemExit('no baseline notices')
notice_bytes = b''.join(p.read_bytes() for p in notice_files)
text = notice_bytes.decode('utf-8')
start = text.index('[\n')
inventory, _ = json.JSONDecoder().raw_decode(text[start:])
seen = {(p['name'], p['version'], p['registry_source']) for p in inventory}
packages = tomllib.loads(lock_bytes.decode('utf-8'))['package']
missing = sorted((p for p in packages if p.get('source', '').startswith('registry+') and
                  (p['name'], p['version'], p['source']) not in seen),
                 key=lambda p: (p['name'], p['version'], p['source']))
rows = []
for package in missing:
    name, version = package['name'], package['version']
    matches = list(args.cargo_cache.glob('*/' + name + '-' + version + '.crate'))
    if not matches:
        raise SystemExit(f'archive unavailable: {name} {version}')
    if any(sha(p.read_bytes()) != package['checksum'] for p in matches):
        raise SystemExit(f'archive checksum mismatch: {name} {version}')
    archive = sorted(matches)[0]
    snapshots = []
    with tarfile.open(archive) as tar:
        for entry in sorted(tar.getmembers(), key=lambda m: m.name):
            parts = PurePosixPath(entry.name).parts
            if not entry.isfile() or len(parts) != 2 or parts[0] != name + '-' + version:
                continue
            if not parts[-1].upper().startswith(('LICENSE', 'LICENCE', 'COPYING', 'NOTICE', 'AUTHORS')):
                continue
            content = tar.extractfile(entry).read()
            snapshots.append({'path': parts[-1], 'bytes': len(content), 'sha256': sha(content),
                              'content_base64': base64.b64encode(content).decode('ascii')})
        manifest_entry = tar.getmember(name + '-' + version + '/Cargo.toml')
        manifest = tar.extractfile(manifest_entry).read()
    info = tomllib.loads(manifest.decode('utf-8')).get('package', {})
    rows.append({'name': name, 'version': version, 'registry_source': package['source'],
                 'archive_sha256': package['checksum'], 'manifest_sha256': sha(manifest),
                 'declared_license': info.get('license'), 'declared_license_file': info.get('license-file'),
                 'snapshots': snapshots, 'requires_manual_followup': not bool(snapshots)})
result = {'schema': 'wasmc.notice-delta-candidate/v1', 'cargo_lock_sha256': sha(lock_bytes),
          'baseline_notices_sha256': sha(notice_bytes), 'packages': rows,
          'complete_release_notice': False}
if any((args.rust_copyright, args.rust_copyright_sha256, args.rust_version)):
    if not all((args.rust_copyright, args.rust_copyright_sha256, args.rust_version)):
        raise SystemExit('Rust copyright path, digest and version must be supplied together')
    rust_bytes = args.rust_copyright.read_bytes()
    if sha(rust_bytes) != args.rust_copyright_sha256:
        raise SystemExit('Rust copyright digest mismatch')
    result['rust_library_copyright'] = {'toolchain_version': args.rust_version, 'bytes': len(rust_bytes),
                                      'sha256': sha(rust_bytes),
                                      'content_base64': base64.b64encode(rust_bytes).decode('ascii')}
payload = (json.dumps(result, indent=2, sort_keys=True) + '\n').encode()
with args.output.open('xb') as output:
    output.write(payload)
print(json.dumps({'output_sha256': sha(payload), 'packages': len(rows),
                  'manual_followup': [p['name'] + '@' + p['version'] for p in rows if p['requires_manual_followup']],
                  'complete_release_notice': False}))
