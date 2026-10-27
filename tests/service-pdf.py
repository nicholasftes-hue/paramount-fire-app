"""Independently parse fictional PDFs produced by Node and the real browser."""
from pathlib import Path
from pypdf import PdfReader

for filename in ('service-draft.pdf', 'browser-service-draft.pdf'):
    path = Path('test-results') / filename
    reader = PdfReader(path, strict=True)
    text = '\n'.join(page.extract_text() for page in reader.pages)
    assert 'Fire alarm service record - DRAFT' in text
    assert 'Reference:' in text and 'Revision:' in text
    for page in reader.pages:
        assert 'NOT A COMPLIANCE CERTIFICATE' in page.extract_text()
    if filename == 'service-draft.pdf':
        assert len(reader.pages) >= 3
        assert 'Device 99' in text and 'FINAL-DEFECT-MARKER' in text
        assert '[U+03A9]' in text
    else:
        assert '24.125' in text and 'Demo HMO' in text
        assert 'Renamed fictional property' not in text
    print(f'PASS: {filename}, {len(reader.pages)} page(s), parsed and content verified')
