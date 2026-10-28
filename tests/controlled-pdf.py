from pathlib import Path
from pypdf import PdfReader
for kind in ['service','pat','lighting','quote']:
    reader=PdfReader(Path('test-results')/f'controlled-{kind}.pdf',strict=True)
    text='\n'.join(page.extract_text() for page in reader.pages)
    for expected in ['Fictional signed site','roof access','fictional@example.invalid','Fictional Customer','SHA-256','fixture-request','Mailbox verified','one-time email code','not a cryptographic PDF signature']:
        assert expected in text,(kind,expected)
    assert 'Ω' in text and '£' in text
    assert 'DRAFT - NOT ISSUED' not in text
print('PASS: four controlled evidence PDFs independently parsed; frozen content, scope, Unicode, verification, consent and signature audit evidence retained')

reader=PdfReader('test-results/cryptographically-signed-quote.pdf',strict=True)
fields=reader.get_fields()
assert fields['Paramount controlled evidence']['/FT']=='/Sig'
assert 'Fictional Customer' in '\n'.join(page.extract_text() for page in reader.pages)
print('PASS: incremental cryptographic PDF signature preserves independent parsing and signed field')
