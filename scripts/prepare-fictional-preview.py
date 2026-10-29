"""Prepare an unhosted, isolated fictional preview. Never deploy or connect to cloud."""
import json,re,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'test-results'/'fictional-preview'
out.mkdir(parents=True,exist_ok=True)
for name in ['index.html','index-3.html','main-app.js','main-app.css','pdf-font.js','academy.js','academy.css','icon-192.png','icon-512.png']:
    shutil.copyfile(root/name,out/name)
shutil.copytree(root/'templates',out/'templates',dirs_exist_ok=True)
html=(out/'index-3.html').read_text()
html=re.sub(r"const CLOUD_URL='[^']+'", "const CLOUD_URL='https://fictional.invalid'",html)
html=re.sub(r"const CLOUD_KEY='[^']+'", "const CLOUD_KEY='FICTIONAL-NO-CREDENTIAL'",html)
html=re.sub(r'<script src="\./app-updates.js[^<]+</script>','',html)
html=html.replace('</head>', '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' data: blob:; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; connect-src \'none\'; worker-src \'none\'; frame-src \'none\'; form-action \'none\'"></head>',1)
# A fresh storage namespace preserves any unrelated device data even on accidental origin reuse.
html=html.replace('paramount-demo-v1','paramount-fictional-preview-v1')
seed={'properties':[{'id':'P001','name':'FICTIONAL — Example House','address':'1 Example Lane','postcode':'TEST 1','panel':'Fictional panel','last':'2026-10-01','months':6}], 'services':[{'property':'P001','date':'2026-04-01','engineer':'Fictional legacy engineer','battery':'Not recorded','devices':'Not recorded','notes':'Fictional historical draft only'}], 'inventory':[], 'pat':[], 'lighting':[], 'quotes':[], 'jobs':[], 'settings':{}}
script='<script>if(!localStorage.getItem("paramount-fictional-preview-v1"))localStorage.setItem("paramount-fictional-preview-v1",'+json.dumps(json.dumps(seed))+');</script>'
html=html.replace('<body>', '<body>'+script+'<p style="background:#fff0bf;padding:12px">FICTIONAL DATA PREVIEW — LOCAL ONLY — CLOUD DISABLED</p>',1)
(out/'index-3.html').write_text(html)
p=out/'main-app.js';p.write_text(p.read_text().replace('paramount-main-app-v1:', 'paramount-fictional-main-v1:'))
(out/'README.txt').write_text('UNDEPLOYED FICTIONAL PREVIEW\nServe only on a new loopback origin, e.g. python -m http.server 8769 --bind 127.0.0.1\nDo not reuse the live or Mark demo origin. Network connections, workers, frames and forms are blocked by CSP.\nNo production credentials or customer data are included. No hosting was created.\n')
print(out)
