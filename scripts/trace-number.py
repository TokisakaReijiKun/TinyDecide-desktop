import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent / '.reference/analysis'
functions = {int(row['pc'], 16): row for row in map(json.loads, (root / 'functions.jsonl').open(encoding='utf-8'))}
index = list(map(json.loads, (root / 'index.jsonl').open(encoding='utf-8')))
for item in index:
    if 'NumberPage' not in item.get('class_name', ''):
        continue
    print('\n###', item['file'])
    for line in (root / item['file']).read_text(encoding='utf-8').splitlines():
        match = re.search(r'^(0x[0-9a-f]+).*\bBL \.\+(0x[0-9a-f]+)', line)
        if match:
            target = (int(match[1], 16) + int(match[2], 16)) % 2**64
            callee = functions.get(target, {})
            print(f"{match[1]} -> {target:08x} {callee.get('class_name', '')} {callee.get('method_name', '')}")
