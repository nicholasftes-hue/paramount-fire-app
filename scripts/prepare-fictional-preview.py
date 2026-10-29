"""Prepare an unhosted, isolated fictional preview. Never deploy or connect to cloud."""
import json,re,shutil,hashlib,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'test-results'/'fictional-preview'
out.mkdir(parents=True,exist_ok=True)
for name in ['index.html','index-3.html','main-app.js','main-app.css','pdf-font.js','academy.js','academy.css','academy-test.html','manifest.webmanifest','icon-192.png','icon-512.png']:
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
workspace_script='if(!localStorage.getItem("paramount-fictional-main-v1:device-guest"))localStorage.setItem("paramount-fictional-main-v1:device-guest",'+json.dumps(json.dumps(workspace))+');'
seed['properties'].append({'id':'P002','name':'FICTIONAL — Example Workshop','address':'2 Sample Road','postcode':'TEST 2','panel':'Fictional conventional panel','last':'2026-09-01','months':6})
script='<script>'+workspace_script+'if(!localStorage.getItem("paramount-fictional-preview-v1"))localStorage.setItem("paramount-fictional-preview-v1",'+json.dumps(json.dumps(seed))+');</script>'
html=html.replace('<body>', '<body>'+script+'<p style="background:#fff0bf;padding:12px">FICTIONAL DATA PREVIEW — LOCAL ONLY — CLOUD DISABLED</p>',1)
(out/'index-3.html').write_text(html)
p=out/'main-app.js';p.write_text(p.read_text().replace('paramount-main-app-v1:', 'paramount-fictional-main-v1:'))
p=out/'academy.js';p.write_text(p.read_text().replace('paramount-academy-session-v1:', 'paramount-fictional-academy-session-v1:'))
(out/'README.txt').write_text('UNDEPLOYED FICTIONAL PREVIEW\nServe only on a new loopback origin, e.g. python -m http.server 8769 --bind 127.0.0.1\nDo not reuse the live or Mark demo origin. Network connections, workers, frames and forms are blocked by CSP.\nNo production credentials or customer data are included. No hosting was created.\n')
(out/'TEST-GUIDE.txt').write_text('FICTIONAL PREVIEW TEST GUIDE\nOpen Properties > Services / dates / defects. Review historical services and overdue dates.\nOpen PAT, lighting, fire alarm and extinguisher forms to resume prepared Not Tested examples.\nChange, add and remove equipment; reload to check local resume. Enter current fictional results before saving.\nUse Repeat Entire Property Visit to reset all prepared services. Original records must remain unchanged.\nReview/edit the fictional quotation and prepare an invoice. Download Word/PDF drafts.\nAll 22 Academy lessons remain available. Browser storage must be enabled.\nThis static preview blocks cloud, workers and external connections; it does not demonstrate offline reload caching.\nUse the app regression suite for service-worker offline acceptance. Do not upload to a live or existing demo origin.\n')
manifest={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob('*')) if p.is_file() and p.name!='SHA256SUMS.json'}
(out/'SHA256SUMS.json').write_text(json.dumps(manifest,indent=2)+'\n')
archive=out.parent/'paramount-fictional-preview.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(out))
archive.with_suffix('.zip.sha256').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(out)
print(archive)
