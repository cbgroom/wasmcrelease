#!/usr/bin/env python3
"""Reuse a prior executor only for identical Rust inputs and toolchain."""
import hashlib
import json
from pathlib import Path
import platform
import sys

own=Path('.agents/workstreams/WS-20261026-lib-memory-release-v031/candidate-host/native-linux-operation')
rustc=Path(sys.argv[1])
sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
try:
    pin=json.loads((own/'provenance.json').read_text())
    evidence=Path('.agents/workstreams/WS-20261026-lib-memory-release-v031/qualification/operation-ci-40409527972')
    receipt=json.loads((evidence/'receipt.json').read_text())
    if not receipt['accepted'] or pin['qualified_run']!=receipt['run'] or pin['source_commit']!=receipt['source']:
        raise ValueError('independent qualification identity differs')
    if pin['sha256']!=receipt['executor_sha256'] or pin['inputs']!=receipt['executor_inputs_sha256']:
        raise ValueError('independent qualification pins differ')
    if pin['rustc_vv_sha256']!=receipt['rustc_vv_sha256'] or sha(evidence/'rustc.txt')!=pin['rustc_vv_sha256']:
        raise ValueError('independent Rust toolchain pin differs')
    if sha(own/'executor')!=pin['sha256']:
        raise ValueError('qualified executor digest differs')
    if pin['features']!=['operation-bridge'] or pin['profile']!='release' or pin['target']!='x86_64-unknown-linux-gnu':
        raise ValueError('qualified build profile differs')
    if platform.system()!='Linux' or platform.machine()!='x86_64':
        raise ValueError('qualified executor target differs')
    changed=[path for path,digest in pin['inputs'].items() if sha(path)!=digest]
    if sha(rustc)!=pin['rustc_vv_sha256']:
        changed.append('rustc -vV')
    if changed:
        print(json.dumps({'reused':False,'changed_inputs':changed}))
        sys.exit(1)
    print(json.dumps({'reused':True,'qualified_run':pin['qualified_run'],'source_commit':pin['source_commit'],'executor_sha256':pin['sha256'],'exact_inputs_and_toolchain':True}))
except (OSError,KeyError,ValueError,json.JSONDecodeError) as error:
    print(json.dumps({'reused':False,'provenance_error':str(error)}))
    sys.exit(2)
