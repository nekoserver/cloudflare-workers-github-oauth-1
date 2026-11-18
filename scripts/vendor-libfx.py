#!/usr/bin/env python3
"""Vendor only the official browser engine's dependency closure; no compilation."""
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile
import urllib.request

VERSION = '0.0.16'
URL = f'https://registry.npmjs.org/libfx/-/libfx-{VERSION}.tgz'
SHA256 = '3b9f0c1dca43c756be452ea6b47360c568b368d36fe23d806dbfade609efc8b1'
DEST = Path(__file__).resolve().parents[1] / 'public/vendor/libfx'


def main():
    with urllib.request.urlopen(URL, timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise SystemExit('libfx archive checksum mismatch')
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        files = {m.name.removeprefix('package/'): archive.extractfile(m).read()
                 for m in archive.getmembers() if m.isfile()}
    pending = ['browser-agent.js', 'engine.js', 'fx-core.wasm', 'LICENSE']
    selected = {}
    while pending:
        name = pending.pop()
        if name in selected:
            continue
        selected[name] = files[name]
        if name.endswith('.js'):
            pending.extend(re.findall(r'(?:from\s*|import\s*\()\s*[\'"]\./([^\'"]+\.js)[\'"]', files[name].decode()))
    DEST.mkdir(parents=True, exist_ok=True)
    for name, content in selected.items():
        (DEST / name).write_bytes(content)
    manifest = {'package': 'libfx', 'version': VERSION, 'source': URL, 'archiveSha256': SHA256,
                'license': 'Apache-2.0', 'files': {n: hashlib.sha256(b).hexdigest() for n, b in sorted(selected.items())}}
    (DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Verified and copied {len(selected)} libfx browser assets')


if __name__ == '__main__':
    main()
