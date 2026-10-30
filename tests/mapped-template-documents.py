"""Independently open and edit mapped Word and parse both branding PDF variants."""
from pathlib import Path
from tempfile import TemporaryDirectory
from docx import Document
from pypdf import PdfReader
root=Path(__file__).resolve().parents[1]/'test-results'
doc=Document(root/'mapped-existing-template.docx')
assert 'A & <B>' in '\n'.join(p.text for p in doc.paragraphs)
with TemporaryDirectory() as temp:
    doc.paragraphs[0].text+=' Office edit'
    path=Path(temp)/'edited.docx';doc.save(path)
    assert 'Office edit' in Document(path).paragraphs[0].text
branded=Document(root/'absolute-brand-draft.docx')
assert 'ABSOLUTE PROPERTY SURVEYS' in '\n'.join(p.text for p in branded.paragraphs)
for name,heading in [('absolute','ABSOLUTE PROPERTY SURVEYS'),('paramount','PARAMOUNT FIRE PROTECTION')]:
    pdf=PdfReader(root/f'{name}-brand-draft.pdf',strict=True)
    text='\n'.join(p.extract_text() for p in pdf.pages)
    assert heading in text
    assert 'Service provider / contractor: Paramount Fire Protection' in text
    assert all('NOT A COMPLIANCE CERTIFICATE' in p.extract_text() for p in pdf.pages)
print('PASS mapped Word edit/save/reopen and both branded Word/PDF drafts, attribution and draft labels')
try:
    import pypdfium2 as pdfium
except ImportError:
    print('PDF rasterisation unavailable; independent strict parsing completed')
else:
    for name in ['absolute','paramount']:
        pdf=pdfium.PdfDocument(root/f'{name}-brand-draft.pdf')
        pdf[0].render(scale=1).to_pil().save(root/f'{name}-brand-render.png')
    print('PASS both branding PDFs rendered independently with PDFium')
