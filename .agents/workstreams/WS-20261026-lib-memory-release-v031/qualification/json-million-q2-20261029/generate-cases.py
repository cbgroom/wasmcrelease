import json
import sys
from pathlib import Path

expected = '[' + ','.join(['1234567890'] * 1_000_000) + ']'
case = [{'export': 'run', 'arguments': [], 'expected': {'ok': expected}}]
with Path(sys.argv[1]).open('x', encoding='utf-8') as output:
    json.dump(case, output)
