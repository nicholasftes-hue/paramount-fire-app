"""Independent strict-reader and appearance checks for imported PDF outputs."""
from pathlib import Path
from pypdf import PdfReader, PdfWriter
for kind in ['Invoice','Quotation']:
    original = PdfReader(f'templates/Paramount_{kind}_Fillable.pdf', strict=True)
    for brand in ['paramount','absolute']:
        path=Path(f'test-results/imported-{kind}-{brand}.pdf')
        pdf=PdfReader(path,strict=True)
        fields=pdf.get_fields()
        assert fields['prepared_by']['/V']=='Fictional Engineer'
        assert fields['document_number']['/V']=='TEST-1'
        assert len(fields)==len(original.get_fields())
        assert len(pdf.pages)==len(original.pages)
        for old,page in zip(original.pages,pdf.pages):
            assert page.mediabox==old.mediabox
            assert page.get_contents().get_data()==old.get_contents().get_data()
            stamps=[a.get_object() for a in page['/Annots'] if a.get_object().get('/Subtype')=='/Stamp']
            assert len(stamps)==1
            stamp=stamps[0]
            assert 'DRAFT - NOT ISSUED' in stamp['/Contents']
            expected='Absolute Property Surveys' if brand=='absolute' else 'Paramount Fire Protection'
            assert expected in stamp['/Contents']
            appearance=stamp['/AP']['/N'].get_object().get_data().decode('ascii')
            assert expected in appearance and 'Paramount Fire Protection' in appearance
            assert 'DRAFT - NOT ISSUED' in appearance
        for page in pdf.pages:
            for ref in page['/Annots']:
                widget=ref.get_object()
                if widget.get('/T') in ['prepared_by','document_number']:
                    assert str(widget['/V']) in widget['/AP']['/N'].get_object().get_data().decode('ascii')
        writer=PdfWriter(clone_from=pdf)
        reopened=path.with_suffix('.reopened.pdf')
        writer.write(reopened)
        assert PdfReader(reopened,strict=True).get_fields()['prepared_by']['/V']=='Fictional Engineer'
        print(f'PASS {path}: strict parse, values, visible appearances, branding, preserved content and save/reopen')
