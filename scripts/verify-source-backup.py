"""Verify the exact source archive without executing or hosting its restored contents."""
import hashlib
from pathlib import Path, PurePosixPath
import subprocess
import tempfile
import zipfile

archive = Path('paramount-main-app-backup.zip')
expected = Path(str(archive) + '.sha256').read_text().split()[0]
assert len(expected) == 64 and hashlib.sha256(archive.read_bytes()).hexdigest() == expected
entries = subprocess.check_output(['git','ls-tree','-r','-z','HEAD']).split(b'\0')
blobs = {}
for entry in entries:
    if not entry:
        continue
    meta, raw_path = entry.split(b'\t',1)
    mode, kind, sha = meta.split()
    assert kind == b'blob' and mode in (b'100644',b'100755')
    blobs[raw_path.decode()] = sha.decode()
with tempfile.TemporaryDirectory(prefix='paramount-source-restore-') as temporary:
    restored = Path(temporary)
    with zipfile.ZipFile(archive) as source:
        members = [entry for entry in source.infolist() if not entry.is_dir()]
        assert len(members) == len(blobs) and {entry.filename for entry in members} == set(blobs)
        for entry in members:
            relative = PurePosixPath(entry.filename)
            assert not relative.is_absolute() and '..' not in relative.parts and '\\' not in entry.filename
            assert entry.file_size <= 4*1024*1024
            data = source.read(entry)
            actual = hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
            assert actual == blobs[entry.filename], entry.filename
            target = restored / entry.filename
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(data)
            assert target.read_bytes() == data
print(f'PASS source backup checksum, safe isolated extraction and all {len(blobs)} exact Git blob hashes; no restored code executed')
