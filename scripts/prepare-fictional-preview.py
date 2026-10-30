"""Prepare an unhosted, isolated fictional preview. Never deploy or connect to cloud."""
import json,re,shutil,hashlib,zipfile,base64,io,copy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'test-results'/'fictional-preview'
out.mkdir(parents=True,exist_ok=True)
for name in ['index.html','index-3.html','main-app.js','document-templates.js','imported-pdf.js','main-app.css','pdf-font.js','academy.js','academy.css','academy-test.html','manifest.webmanifest','icon-192.png','icon-512.png']:
    shutil.copyfile(root/name,out/name)
shutil.copytree(root/'templates',out/'templates',dirs_exist_ok=True)
html=(out/'index-3.html').read_text()
html=re.sub(r"const CLOUD_URL='[^']+'", "const CLOUD_URL='https://fictional.invalid'",html)
html=re.sub(r"const CLOUD_KEY='[^']+'", "const CLOUD_KEY='FICTIONAL-NO-CREDENTIAL'",html)
html=re.sub(r'<script src="\./app-updates.js[^<]+</script>','',html)
html=html.replace('</head>', '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' data: blob:; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; connect-src \'none\'; worker-src \'none\'; frame-src \'none\'; form-action \'none\'"></head>',1)
# A fresh storage namespace preserves any unrelated device data even on accidental origin reuse.
html=html.replace('paramount-demo-v1','paramount-fictional-preview-v1').replace('paramount-cloud-session','paramount-fictional-cloud-session')
seed={'properties':[{'id':'P001','name':'FICTIONAL — Example House','address':'1 Example Lane','postcode':'TEST 1','panel':'Fictional panel','last':'2026-10-01','months':6}], 'services':[{'property':'P001','date':'2026-04-01','engineer':'Fictional legacy engineer','battery':'Not recorded','devices':'Not recorded','notes':'Fictional historical draft only'}], 'inventory':[], 'pat':[], 'lighting':[], 'quotes':[], 'jobs':[], 'settings':{}}
workspace=json.loads((root/'scripts'/'fictional-preview-data.json').read_text())
# Independent new-service examples contain stable asset details only.
for record in workspace['records']:
    kind=record['kind'];v=record['values']
    if kind not in ['service','pat','lighting','extinguisher']:continue
    stable=['property','system','standard','ratedDuration','asset','appliance','location','equipmentClass','model','capacity']
    values={k:v[k] for k in stable if k in v}
    rows=json.loads(v.get('equipment','[]'))
    for row in rows:
        for field in ['readings','defects','actions','duration']:row[field]=''
        row['result']='Not Tested'
    values.update(date='2026-10-29',serviceStatus='In progress',testState='Not Tested',reviewed='',repeatSource=record['id'],equipment=json.dumps(rows))
    workspace['drafts'][kind]={'values':values,'editing':None,'updated':'2026-10-29T12:00:00Z'}
# Deliberately fictional, unissued same-day visits remain independent.
for i,record in enumerate(workspace['records']):
    v=record['values']
    v['branding']='absolute' if i%2 else 'paramount'
    v['visitId']='FICTIONAL-MORNING-'+v.get('property','P001')+'-'+v['date']
source=next(r for r in workspace['records'] if r['kind']=='service')
afternoon=copy.deepcopy(source)
afternoon.update(id='FICTIONAL-AFTERNOON-SERVICE',revision=1,history=[])
afternoon['values'].update(visitId='FICTIONAL-AFTERNOON-VISIT',branding='absolute',serviceStatus='In progress',testState='Not Tested',engineerSignature='',customerSignature='',engineerSigned='',customerSigned='',tests='Fictional afternoon draft — not tested',battery='Not tested',measurements='Not tested',declaration='Draft only — not certified')
for field in ['batteryVoltage','duration']:afternoon['values'].pop(field,None)
rows=json.loads(afternoon['values'].get('equipment','[]'))
for row in rows:
    row.update(result='Not Tested',readings='',defects='',actions='',duration='')
afternoon['values']['equipment']=json.dumps(rows)
workspace['records'].append(afternoon)
for kind,d in workspace['drafts'].items():
    d['values'].update(branding='absolute' if kind=='service' else 'paramount',visitId='FICTIONAL-NEW-WHOLE-VISIT')
# A real OOXML blank with explicit mapping fields, without any invented customer logo.
sample=io.BytesIO()
with zipfile.ZipFile(sample,'w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    texts=['FICTIONAL BLANK TEMPLATE — DRAFT ONLY','Branding: {{branding}}','Status: {{status}}','Contractor: {{contractor}}','Issuer: {{issuer}}','Reference: {{reference}}','Revision: {{revision}}','Visit: {{visitId}}','Date: {{date}}','Engineer: {{engineer}}','Tests and actual results: {{tests}}','Defects: {{defects}}','Actions: {{actions}}','Review in Word before use; not a compliance certificate.']
    z.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+''.join('<w:p><w:r><w:t>'+t+'</w:t></w:r></w:p>' for t in texts)+'</w:body></w:document>')
original=sample.getvalue()
(out/'templates'/'FICTIONAL_Mapped_Certificate.docx').write_bytes(original)
template={'id':'FICTIONAL-TEMPLATE-V1','family':'FICTIONAL-TEMPLATE','version':1,'name':'Fictional existing fire certificate','company':'','property':'','kind':'service','filename':'FICTIONAL_Mapped_Certificate.docx','created':'2026-10-29T12:00:00Z','active':True,'hash':hashlib.sha256(original).hexdigest(),'content':base64.b64encode(original).decode(),'format':'docx','fields':['branding','status','contractor','issuer','reference','revision','visitId','date','engineer','tests','defects','actions'],'preview':'Fictional blank Word certificate. Text placeholders are mapped; no Absolute logo is bundled.'}
workspace['drafts']['service']['values'].update(templateRef=template['id'],templateName=template['name']+' · version 1')
library_script='if(!localStorage.getItem("paramount-fictional-templates-v1:device-guest"))localStorage.setItem("paramount-fictional-templates-v1:device-guest",'+json.dumps(json.dumps([template]))+');'
workspace_script='if(!localStorage.getItem("paramount-fictional-main-v1:device-guest"))localStorage.setItem("paramount-fictional-main-v1:device-guest",'+json.dumps(json.dumps(workspace))+');'
seed['properties'].append({'id':'P002','name':'FICTIONAL — Example Workshop','address':'2 Sample Road','postcode':'TEST 2','panel':'Fictional conventional panel','last':'2026-09-01','months':6})
script='<script>'+library_script+workspace_script+'if(!localStorage.getItem("paramount-fictional-preview-v1"))localStorage.setItem("paramount-fictional-preview-v1",'+json.dumps(json.dumps(seed))+');</script>'
html=html.replace('<body>', '<body>'+script+'<p style="background:#fff0bf;padding:12px">FICTIONAL DATA PREVIEW — LOCAL ONLY — CLOUD DISABLED</p>',1)
(out/'index-3.html').write_text(html)
p=out/'main-app.js';p.write_text(p.read_text().replace('paramount-main-app-v1:', 'paramount-fictional-main-v1:'))
p=out/'document-templates.js';p.write_text(p.read_text().replace('paramount-templates-v1:', 'paramount-fictional-templates-v1:'))
p=out/'academy.js';p.write_text(p.read_text().replace('paramount-academy-session-v1:', 'paramount-fictional-academy-session-v1:'))
(out/'README.txt').write_text('UNDEPLOYED FICTIONAL PREVIEW\nServe only on a new loopback origin, e.g. python -m http.server 8769 --bind 127.0.0.1\nDo not reuse the live or Mark demo origin. Network connections, workers, frames and forms are blocked by CSP.\nNo production credentials or customer data are included. No hosting was created.\nUPLOAD INSTRUCTIONS (approval required before hosting): unzip all files into a NEW isolated static hosting project, keep directory paths, use a fresh origin, and open index.html. Never replace production or Mark demo files. Do not add real customer data. Keep the CSP in index-3.html intact. Review with the owner before any publication.\n')
(out/'TEST-GUIDE.txt').write_text('FICTIONAL PREVIEW TEST GUIDE\nChoose Paramount or Absolute branding on each form. The real Absolute logo is pending.\nUse Existing Certificate / Template selects the bundled fictional mapped Word blank. Save a service, then use Download selected template / mapped Word draft. Manage templates to import, preview, replace, deactivate or back up a personal device library. Classic PDFs support saved text field mappings; unsupported PDFs are rejected.\nTwo same-day fire service records have distinct visit IDs. Repeat Entire Property Visit prepares a shared NEW ID and Not Tested results.\nOpen Properties > Services / dates / defects. Review historical services and overdue dates.\nOpen PAT, lighting, fire alarm and extinguisher forms to resume prepared Not Tested examples.\nChange, add and remove equipment; reload to check local resume. Enter current fictional results before saving.\nUse Repeat Entire Property Visit to reset all prepared services. Original records must remain unchanged.\nReview/edit the fictional quotation and prepare an invoice. Download Word/PDF drafts.\nAll 22 Academy lessons remain available. Browser storage must be enabled.\nThis static preview blocks cloud, workers and external connections; it does not demonstrate offline reload caching.\nUse the app regression suite for service-worker offline acceptance. Do not upload to a live or existing demo origin.\n')
manifest={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob('*')) if p.is_file() and p.name!='SHA256SUMS.json'}
(out/'SHA256SUMS.json').write_text(json.dumps(manifest,indent=2)+'\n')
archive=out.parent/'paramount-fictional-preview.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(out))
archive.with_suffix('.zip.sha256').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(out)
print(archive)
