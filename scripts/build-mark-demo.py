"""Build a separate static demo; never edit the source app or contact a service."""
from pathlib import Path
import hashlib,json,re,sys,zipfile
root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/paramount-mark-demo').resolve()
if out==root or root in out.parents: raise SystemExit('Use a separate output directory')
out.mkdir(parents=True,exist_ok=True)
def write(name,value): (out/name).write_text(value)
html=(root/'index-3.html').read_text()
# Drop the complete production connection, auth, credentials and network handlers.
start=html.index("const CLOUD_URL=")
end=html.index('render();</script>',start)
html=html[:start]+"let cloudSession=null;\n"+html[end:]
start=html.index("if(tab==='Cloud Properties')")
end=html.index("if(tab==='Dashboard')",start)
html=html[:start]+html[end:]
html=html.replace(",'Cloud Properties'",'')
html=html.replace('Prototype · Existing tabs store locally; Cloud Properties uses Supabase','Fictional demo · All entries stay in this browser')
html=html.replace("const key='paramount-demo-v1'","const key='paramount-mark-demo-v2'")
html=html.replace("Demo HMO — Bury","Fictional Example House — Bury").replace("Demo HMO — Bolton","Fictional Sample Court — Bolton")
html=html.replace("panel:'C-TEC Conventional',last:","postcode:'BL9 0ZZ',address:'1 Fictional Lane — demonstration only',panel:'Example conventional panel',last:")
html=html.replace("panel:'Conventional panel',last:","postcode:'BL1 0ZZ',address:'2 Imaginary Road — demonstration only',panel:'Example panel',last:")
# Replace the binary template screen, whose original files are preserved in source.
start=html.index("if(tab==='Documents')")
end=html.index("if(tab==='Quotes')",start)
html=html[:start]+"if(tab==='Documents'){html=`<div class=\"panel\"><h2>Demo document previews</h2><p>Use the saved draft Preview / PDF buttons in Service Records, PAT Testing, Emergency Lighting, Quotes or Invoices. Your browser provides Print / Save as PDF; phone behaviour needs device testing.</p><p>Editable Word and fillable PDF templates are not bundled in this isolated demo. Documents are DRAFT / NOT ISSUED and are not compliance certificates.</p><button data-tab=\"Quotes\">Open quotations</button> <button data-tab=\"Invoices\">Open invoices</button></div>`}"+html[end:]
html=html.replace('<link rel="apple-touch-icon" href="./icon-192.png">','<link rel="icon" href="./icon.svg" type="image/svg+xml">')
csp="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'none'"
html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+csp+'">',1)
before,after=html.rsplit('</body>',1)
html=before+'<script src="./demo-notice.js"></script></body>'+after
write('index.html',html)
main=(root/'main-app.js').read_text()
main=main.replace('paramount-main-app-v1:','paramount-mark-workspace-v2:')
start=main.index('  async function upload()')
end=main.index('  function stopSpeech()',start)
main=main[:start]+main[end:]
start=main.index('  function backupPage()')
end=main.index('  const originalRender=',start)
main=main[:start]+'''  function backupPage(){return `<section class="panel"><h2>Demo backup</h2><p>Fictional records only. Backups contain your local demo entries.</p><button data-main-export>Download workspace JSON</button><button data-backup>Download property records</button><button data-main-raw>Download raw workspace</button><label>Restore fictional demo workspace<input type="file" id="main-import" accept="application/json,.json"></label></section>`}
'''+main[end:]
start=main.index("      else if(b.hasAttribute('data-main-upload'))")
end=main.index('      else if(b.dataset.mainDictate)',start)
main=main[:start]+main[end:]
start=main.index('  function dictate(name)')
end=main.index("  document.addEventListener('input'",start)
main=main[:start]+"  function dictate(){throw Error('Voice services are disabled in this offline demonstration. Type fictional notes.')}\n"+main[end:]
main=main.replace('Main-app development workspace','Mark’s isolated demonstration').replace('Backup / cloud snapshots','Demo backup')
main=main.replace('Records and unfinished forms are saved on this device, separated by signed-in account.','Fictional records and unfinished forms are saved in this browser only.')
main=main.replace('Cloud records require the separately reviewed setup.','No login, shared synchronisation or external database is connected.')
write('main-app.js',main)
for name in ['main-app.css','academy.js','academy.css','app-updates.js']:
 text=(root/name).read_text()
 if name=='academy.js': text=text.replace('paramount-academy','paramount-mark-academy')
 write(name,text)
standalone=(root/'academy-test.html').read_text().replace('./index-3.html','./index.html')
write('academy-test.html',standalone)
write('icon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#102c48"/><text x="50" y="67" text-anchor="middle" font-family="Arial" font-size="55" fill="#70c5e9">P</text></svg>')
write('manifest.webmanifest',json.dumps({'name':'Paramount — Mark demo','short_name':'Paramount Demo','start_url':'./','scope':'./','display':'standalone','theme_color':'#ffffff','background_color':'#ffffff','icons':[{'src':'icon.svg','sizes':'any','type':'image/svg+xml','purpose':'any'}]}))
worker=(root/'service-worker.js').read_text()
worker=re.sub(r"const CACHE = '[^']+'", "const CACHE = 'paramount-mark-demo-shell-v2'",worker,count=1)
assets=['index.html','main-app.js','main-app.css','academy.js','academy.css','academy-test.html','app-updates.js','demo-notice.js','manifest.webmanifest','icon.svg']
worker=re.sub(r'const ASSETS = .*?;', 'const ASSETS = '+json.dumps(['./'+x for x in assets])+';',worker,count=1)
worker=worker.replace("(key.startsWith('paramount-demo-') || key.startsWith('paramount-shell-'))","key.startsWith('paramount-mark-demo-shell-')")
write('service-worker.js',worker)
write('demo-notice.js', '''(() => {
 const notice=document.createElement('aside');notice.style.cssText='padding:16px;background:#fff4cf;color:#193b57;border-bottom:2px solid #c49a26';
 notice.innerHTML='<b>MARK DEMO — FICTIONAL DATA ONLY</b><p>No login or live database. Entries stay on this device. Certificates, quotations and invoices are drafts; no documents are issued, signatures collected, payments taken or messages sent. Offline reopening requires a successful first online load and browser storage.</p><button type="button" id="demo-reset">Reset this demo</button>';
 document.body.prepend(notice);
 document.getElementById('demo-reset').onclick=()=>{if(!confirm('Delete fictional records and unfinished forms in this demo only?'))return;const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k==='paramount-mark-demo-v2'||k.startsWith('paramount-mark-workspace-v2:'))keys.push(k)}keys.forEach(k=>localStorage.removeItem(k));location.reload()};
})();
''')
write('.nojekyll','')
write('README.md', '''# Paramount Mark demo
Fictional data only. Separate static build, with production connection, authentication and database code removed. No network services, cloud synchronisation, certificate issuing, customer approval, signing, payments or automatic reminders. Existing six Academy lessons are draft training, not competency assessment. Follow approved procedures; never bypass safety functions.

## Publish
Create a separate public repository named `paramount-mark-demo`. Upload this directory to its main branch, then enable GitHub Pages: deploy from branch main, root folder. Do not change Pages settings on paramount-fire-app. Expected URL after a successful deployment: https://nicholasftes-hue.github.io/paramount-mark-demo/ (not verified or live merely because this file exists).

## Verify
Open on Samsung and iPhone. Navigate all tabs; save/reopen a fictional service, PAT and lighting draft; print draft previews; calculate a quote; convert to invoice; run Academy quizzes; reload after disabling connectivity. Offline availability depends on the first successful cache installation. Local JSON backup is supported. Reset clears only this demo's own record keys. This demo has no secure storage for real customer data.

## Testing limits
Static isolation, script syntax and unit tests are automated. Real browser/mobile and phone PDF saving require acceptance testing. Binary editable document templates are omitted; draft print previews remain available.
''')
for p in out.iterdir():
 if p.is_file() and p.suffix in ['.js','.html']:
  text=p.read_text()
  for forbidden in ['supabase.co','CLOUD_URL','CLOUD_KEY','access_token','refresh_token','cloudAuthorizedRequest','/auth/v1','/rest/v1','cloudLoginForm']:
   if forbidden in text: raise SystemExit(f'Forbidden live integration {forbidden} in {p.name}')
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file() and p.name!='SHA256.json'}
write('SHA256.json',json.dumps(manifest,indent=2))
archive=out.parent/'paramount-mark-demo-2026-10-27.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(out.iterdir()):
  if p.is_file(): z.write(p,p.name)
print(json.dumps({'output':str(out),'archive':str(archive),'files':len(manifest)+1,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
