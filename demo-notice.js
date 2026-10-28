(() => {
 const notice=document.createElement('aside');notice.style.cssText='padding:16px;background:#fff4cf;color:#193b57;border-bottom:2px solid #c49a26';
 notice.innerHTML='<b>PREVIEW 69c45d4 — FICTIONAL DATA ONLY</b><p>No login or live database. Entries stay on this device. Certificates, quotations and invoices are drafts; no documents are issued, verified signatures collected, payments taken or messages sent. Any typed draft acknowledgements must be fictional. Offline reopening requires a successful first online load and browser storage.</p><button type="button" id="demo-reset">Reset this demo</button>';
 document.body.prepend(notice);
 document.getElementById('demo-reset').onclick=()=>{if(!confirm('Delete fictional records and unfinished forms in this demo only?'))return;document.querySelectorAll('form[data-main-form]').forEach(form=>form.removeAttribute('data-main-form'));const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k==='paramount-preview-69c45d4-v2'||k.startsWith('paramount-preview-workspace-69c45d4-v2:'))keys.push(k)}keys.forEach(k=>localStorage.removeItem(k));location.reload()};
})();
