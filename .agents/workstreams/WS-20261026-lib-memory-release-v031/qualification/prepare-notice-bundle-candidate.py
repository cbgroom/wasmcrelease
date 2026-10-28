#!/usr/bin/env python3
"""Stage the old notice text plus pinned new snapshots for publication review."""
import argparse, base64, hashlib, json
from pathlib import Path

sha = lambda value: hashlib.sha256(value).hexdigest()
p = argparse.ArgumentParser()
p.add_argument('--baseline', required=True, type=Path)
p.add_argument('--baseline-sha256', required=True)
p.add_argument('--delta', required=True, type=Path)
p.add_argument('--delta-sha256', required=True)
p.add_argument('--additional-delta', type=Path)
p.add_argument('--additional-delta-sha256')
p.add_argument('--output', required=True, type=Path)
a = p.parse_args()
files = sorted(a.baseline.glob('DEPENDENCY-NOTICES-[0-9][0-9][0-9].txt'))
if not files:
    raise SystemExit('missing baseline notices')
baseline = [f.read_bytes() for f in files]
if sha(b''.join(baseline)) != a.baseline_sha256:
    raise SystemExit('baseline notice digest mismatch')
delta_bytes = a.delta.read_bytes()
if sha(delta_bytes) != a.delta_sha256:
    raise SystemExit('delta digest mismatch')
delta = json.loads(delta_bytes)
if delta['baseline_notices_sha256'] != a.baseline_sha256:
    raise SystemExit('delta was collected against a different baseline')
deltas = [delta]
if bool(a.additional_delta) != bool(a.additional_delta_sha256):
    raise SystemExit('additional delta path and digest must be supplied together')
if a.additional_delta:
    extra_bytes = a.additional_delta.read_bytes()
    if sha(extra_bytes) != a.additional_delta_sha256:
        raise SystemExit('additional delta digest mismatch')
    extra = json.loads(extra_bytes)
    if extra['baseline_notices_sha256'] != a.baseline_sha256 or extra.get('previous_delta_sha256') != a.delta_sha256:
        raise SystemExit('additional delta chain mismatch')
    deltas.append(extra)
text = b''.join(baseline).decode('utf-8')
inventory, _ = json.JSONDecoder().raw_decode(text[text.index('[\n'):])
known = {row['sha256'] for package in inventory for row in package['snapshots']}
new = {}
packages = []
for package in [p for d in deltas for p in d['packages']]:
    if package['requires_manual_followup']:
        raise SystemExit('unresolved license snapshot: ' + package['name'])
    entry = {k: v for k, v in package.items() if k != 'snapshots'}
    entry['snapshots'] = []
    for snapshot in package['snapshots']:
        raw = base64.b64decode(snapshot['content_base64'], validate=True)
        if len(raw) != snapshot['bytes'] or sha(raw) != snapshot['sha256']:
            raise SystemExit('delta snapshot digest mismatch')
        raw.decode('utf-8')
        entry['snapshots'].append({k: v for k, v in snapshot.items() if k != 'content_base64'})
        if snapshot['sha256'] not in known:
            new[snapshot['sha256']] = raw
    packages.append(entry)
rust = delta['rust_library_copyright']
rust_bytes = base64.b64decode(rust['content_base64'], validate=True)
if len(rust_bytes) != rust['bytes'] or sha(rust_bytes) != rust['sha256']:
    raise SystemExit('Rust copyright digest mismatch')
rust_bytes.decode('utf-8')
header = {'schema': 'wasmc.release-notice-supplement-candidate/v1',
          'cargo_lock_sha256': delta['cargo_lock_sha256'], 'packages': packages,
          'rust_library_copyright': {k: v for k, v in rust.items() if k != 'content_base64'},
          'release_notice_complete': False}
if len(deltas) > 1:
    header['additional_cargo_lock_sha256'] = [d['cargo_lock_sha256'] for d in deltas[1:]]
addition = b'\n\nCandidate supplement; original baseline remains unchanged.\n' + json.dumps(header, sort_keys=True, indent=2).encode() + b'\n'
for digest, content in sorted(new.items()):
    addition += ('\n===== Original snapshot SHA256 ' + digest + ' =====\n\n').encode() + content + b'\n'
addition += ('\n===== Rust library copyright SHA256 ' + rust['sha256'] + ' =====\n\n').encode() + rust_bytes + b'\n'
# Split only at valid UTF-8 boundaries for the producer's per-file contract.
chunks = list(baseline)
while addition:
    end = min(len(addition), 240 * 1024)
    while end and end < len(addition) and addition[end] & 0xc0 == 0x80:
        end -= 1
    part, addition = addition[:end], addition[end:]
    part.decode('utf-8')
    chunks.append(part)
if len(chunks) > 31:
    raise SystemExit('notice file count exceeds current producer contract')
a.output.mkdir(parents=False, exist_ok=False)
pins = []
for i, part in enumerate(chunks, 1):
    name = f'DEPENDENCY-NOTICES-{i:03d}.txt'
    (a.output / name).write_bytes(part)
    pins.append({'path': 'licenses/' + name, 'bytes': len(part), 'sha256': sha(part)})
manifest = {'schema': 'wasmc.release-notices-input/v1', 'files': pins}
manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode()
(a.output / 'dependency-notices.json').write_bytes(manifest_bytes)
print(json.dumps({'manifest_sha256': sha(manifest_bytes), 'files': len(pins),
                  'notice_bytes': sum(x['bytes'] for x in pins), 'new_unique_snapshots': len(new),
                  'release_notice_complete': False}))
