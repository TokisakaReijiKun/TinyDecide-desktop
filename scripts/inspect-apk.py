"""Inspect reference AOT strings; this does not execute any APK code."""
import re
from pathlib import Path

data = (Path(__file__).resolve().parent.parent / '.reference/libapp.so').read_bytes()
strings = [(m.start(), m.group().decode('ascii')) for m in re.finditer(rb'[\x20-\x7e]{5,}', data)]
for offset, value in strings:
    if re.search(r'package:tiny_decisions/.*(number|coin)|shuffle|NumberPage|Number.*(Animation|Roll)|_Number|generateNumber|numberAnimation|AnimationDuration|rotationAnimation|ShakeAnimation', value, re.I):
        print(f'{offset:08x} {value[:500]}')
print('--- Dart snapshot version ---')
for offset, value in strings:
    if re.search(r'\b[23]\.\d+\.\d+ \(|dart_vm|dart [23]|flutter [23]', value):
        print(f'{offset:08x} {value[:200]}')
