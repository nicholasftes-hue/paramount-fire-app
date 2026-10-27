"""Independently parse fictional PDFs produced by Node and the real browser."""
from pathlib import Path
from pypdf import PdfReader

for filename in ('service-draft.pdf', 'browser-service-draft.pdf'):
    path = Path('test-results') / filename
    reader = PdfReader(path, strict=True)
    text = '\n'.join(page.extract_text() for page in reader.pages)
    assert 'Fire alarm service certificate — DRAFT' in text
    assert 'Reference:' in text and 'Revision:' in text
    for page in reader.pages:
        assert 'NOT A COMPLIANCE CERTIFICATE' in page.extract_text()
    if filename == 'service-draft.pdf':
        assert len(reader.pages) >= 3
        assert 'Device 99' in text and 'FINAL-DEFECT-MARKER' in text
        assert '£ Ω' in text
        assert '[U+03A9]' not in text
    else:
        assert '24.125' in text and 'Demo HMO' in text
        assert 'Renamed fictional property' not in text
    print(f'PASS: {filename}, {len(reader.pages)} page(s), parsed and content verified')


for kind in ('pat','lighting'):
    reader=PdfReader(Path('test-results') / (kind+'-draft.pdf'),strict=True)
    text='\n'.join(p.extract_text() for p in reader.pages)
    assert 'DRAFT SIGNATURE ACKNOWLEDGEMENTS' in text
    assert 'Engineer signature (typed)' in text and 'Customer signature (typed)' in text
    assert all('NOT A COMPLIANCE CERTIFICATE' in p.extract_text() for p in reader.pages)
    if kind=='pat':
        assert 'Zoë — Ω' in text and 'José' in text and '0.14 Ω' in text
    else:
        assert '180' in text and 'Duration test' in text
    print('PASS:',kind,'Unicode / signatures / draft PDF')

for width in (320,360,412,800):
    for kind in ('certificate','pat-register','lighting','lighting-register'):
        reader=PdfReader(Path('test-results') / f'{kind}-{width}.pdf',strict=True)
        text=' '.join('\n'.join(p.extract_text() for p in reader.pages).split())
        assert all('NOT A COMPLIANCE CERTIFICATE' in p.extract_text() for p in reader.pages)
        assert 'Zoë — Ω' in text and 'José' in text
        assert 'Customer signature (typed)' in text
        if kind=='certificate': assert '✓ £ Ω ≥ MΩ — café' in text
        if kind=='pat-register':
            assert 'K009' in text and 'K010' in text
            assert 'Pass within recorded test scope' in text and 'Fail / unsafe — action required' in text
            assert '0.12 Ω; ≥2 MΩ; ✓' in text
        if kind.startswith('lighting'): assert '180' in text and 'charge indicator on' in text
        print('PASS: mobile PDF',kind,width,'Unicode, results, signatures and draft labels')
