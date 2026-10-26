/* Additive main-app workflows. The original inline app and Supabase auth remain intact. */
(() => {
  'use strict';
  const VERSION = 1;
  const kinds = ['service','extinguisher','installation','quote','invoice','visit','callout','enquiry','drawing','equipment'];
  const names = {service:'Fire alarm service',extinguisher:'Extinguisher register / service',installation:'Installation / commissioning',quote:'Quotation',invoice:'Invoice',visit:'Scheduled visit',callout:'Call-out / defect / repair',enquiry:'Customer enquiry',drawing:'Site layout',equipment:'Equipment reference'};
  const pages = {'Service Records':'service','Extinguishers':'extinguisher','Installation Forms':'installation','Quotes':'quote','Invoices':'invoice','Planner':'visit','Call-outs':'callout','Office':'enquiry','Drawing Studio':'drawing','Equipment Library':'equipment'};
  const extra = ['Extinguishers','Installation Forms','Invoices','Call-outs','Office','Property History','Drawing Studio','Equipment Library','Record Backup'];
  extra.forEach(s=>{if(!sections.includes(s))sections.push(s)});
  let activeScope = '', state, editing = null, speech = null, speechTarget = null;
  let draft = {}, storageError = '';
  const scope = () => cloudSession?.user?.id || 'device-guest';
  const storageKey = () => 'paramount-main-app-v1:' + scope();
  const empty = () => ({version:VERSION,records:[],drafts:{}});
  const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const safe = value => esc(value);
  function read() {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return empty();
    const data = JSON.parse(raw);
    if (data.version!==VERSION || !Array.isArray(data.records) || !data.drafts || typeof data.drafts!=='object') throw Error('Stored workspace is unreadable. Export the raw backup before continuing. It has not been replaced.');
    for(const r of data.records){if(!r||typeof r.id!=='string'||!kinds.includes(r.kind)||!Number.isInteger(r.revision)||r.revision<1||!Array.isArray(r.history))throw Error('Stored records are unreadable. Export the raw backup for recovery.');validate(r.kind,r.values);for(const h of r.history)validate(r.kind,h.values)}
    return data;
  }
  function load() {
    if (activeScope===scope() && state) return;
    stopSpeech(); editing=null;draft={};activeScope=scope();storageError='';
    try {state=read()} catch(error){state=empty();storageError=error.message}
  }
  function commit(change) {
    if(storageError) throw Error(storageError);
    const fresh=read();change(fresh);
    localStorage.setItem(storageKey(),JSON.stringify(fresh));state=fresh;
  }
  function message(text) {const el=document.getElementById('main-status');if(el)el.textContent=text}
  const record = id => state.records.find(r=>r.id===id);
  const property = id => db.properties.find(p=>p.id===id);
  const propertyName = id => property(id)?.name || id || 'No property selected';
  function fields(form) {return Object.fromEntries(new FormData(form).entries())}
  function remember() {
    const form=document.querySelector('form[data-main-form]');
    if(!form || activeScope!==scope() || form.dataset.mainScope!==scope())return;
    const values=fields(form), id=form.dataset.mainForm;
    try{commit(s=>{s.drafts[id]={values,editing,updated:now()}})}catch(error){message('Draft could not be saved: '+error.message)}
  }
  function input(label,name,type='text',required=true,value='') {
    return `<label>${safe(label)}<input name="${name}" type="${type}" ${required?'required':''} value="${safe(value)}" ${type==='number'?'step="any"':''}></label>`;
  }
  function area(label,name,required=false) {return `<label class="main-wide">${safe(label)}<textarea name="${name}" ${required?'required':''}></textarea><button type="button" data-main-dictate="${name}">Dictate draft</button></label>`}
  function select(label,name,values,required=true) {return `<label>${safe(label)}<select name="${name}" ${required?'required':''}><option value="">Select…</option>${values.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('')}</select></label>`}
  function prop() {return `<label>Property<select name="property" required><option value="">Select property…</option>${db.properties.map(p=>`<option value="${safe(p.id)}">${safe(p.name)}</option>`).join('')}</select></label>`}
  function review() {return `<label class="main-check main-wide"><input type="checkbox" name="reviewed" value="yes" required><span>I have reviewed the entered results, scope, defects and any dictated text. This saves a draft record; it does not certify compliance or operate an alarm.</span></label>`}
  function buildFields(kind) {
    const site = kind==='enquiry' ? input('Customer name','customer')+input('Email / phone','contact') : prop();
    const common=site+input(kind==='visit'?'Visit date':'Record date','date','date',true,today());
    switch(kind) {
      case 'service': return common+input('Engineer','engineer')+input('System / panel make, model and category','system')+input('Service scope / agreed standard and edition','standard')+area('Devices / zones tested and actual results (one per line)','tests',true)+select('Battery inspection','battery',['Satisfactory','Unsatisfactory','Not inspected','Not applicable'])+area('Measured values, instruments and calibration reference','measurements',true)+area('Defects / limitations / inaccessible areas','defects',true)+area('Actions and advice to responsible person','actions',true)+input('Next agreed service date','next','date',false)+input('Responsible person / handover recipient','recipient')+area('Engineer declaration / work completed within stated scope','declaration',true)+review();
      case 'extinguisher': return common+input('Engineer','engineer')+input('Asset / serial number','asset')+input('Location','location')+input('Manufacturer / model','model')+input('Type and capacity','capacity')+input('Manufacture date / year','manufactured','text',false)+input('Last extended service / test date','lastTest','date',false)+select('Visit type','visitType',['Basic service','Extended service','Replacement','Inspection only'])+area('Checks performed and measured results','tests',true)+select('Recorded outcome','outcome',['Satisfactory within recorded scope','Defective / action required','Not serviced / inaccessible'])+area('Defects, limitations and action taken','defects',true)+input('Next agreed service date','next','date',false)+review();
      case 'installation': return common+input('Engineer','engineer')+select('Form stage','stage',['Installation record','Commissioning record'])+input('System make / model / category','system')+input('Design / specification reference and standard edition','standard')+input('Drawing revision / cause-and-effect reference','drawingRef')+area('Installed devices, addresses / zones and locations','devices',true)+area('Inspection and test results, actual measurements','tests',true)+area('Variations, defects, exclusions and limitations','defects',true)+area('Handover documents, training and outstanding actions','actions',true)+input('Responsible person / recipient','recipient')+area('Engineer declaration limited to recorded scope','declaration',true)+review();
      case 'quote': case 'invoice': return common+input(kind==='quote'?'Quotation number':'Invoice number','number')+input('Customer / billing name','customer')+area('Billing address','address',true)+input(kind==='quote'?'Valid until':'Payment due','due','date')+area('Line items: description | quantity | unit price (£), one per line','lines',true)+input('VAT rate (%) — confirm applicability','vat','number',true,'0')+input('VAT registration (if applicable)','vatNumber','text',false)+input('Related quote / job reference','source','text',false)+area('Terms, exclusions and payment instructions (verified details only)','terms',true)+`<p class="main-wide main-total" id="main-total">Enter line items to calculate totals.</p>`+review();
      case 'visit': return common+input('Engineer / team','engineer')+input('Start time (local)','time','time')+input('Duration (minutes)','minutes','number',true,'60')+select('Service type','serviceType',['Fire alarm','Extinguisher','PAT','Emergency lighting','Call-out','Installation / commissioning'])+select('Visit status','status',['Planned','Confirmed','Completed','Cancelled'])+area('Access arrangements / scope / reminder notes','notes',true)+review();
      case 'callout': return common+input('Engineer','engineer')+input('Job reference','number')+select('Priority','priority',['Routine','Urgent','Immediate responsible-person attention'])+select('Status','status',['Open','Investigating','Repair proposed','Repaired — awaiting verification','Closed after verification'])+area('Reported issue and affected equipment / locations','issue',true)+area('Observed defects, risks and advice to responsible person','defects',true)+area('Actions taken / parts / verification results','actions',true)+input('Follow-up date','next','date',false)+review();
      case 'enquiry': return common+input('Site / address enquiry relates to','site')+select('Status','status',['New','Contacted','Survey needed','Quote prepared','Closed'])+input('Office owner','owner')+input('Follow-up date','next','date',false)+area('Request and next action','notes',true)+review();
      case 'drawing': return common+input('Layout title / revision','title')+area('Editable layout: label | x | y | width | height (0–100), one rectangle per line','layout',true)+area('Equipment markers: label | x | y (0–100), one per line','markers')+area('Legend, scale / not to scale, survey limitations','notes',true)+`<p class="main-wide">Coordinates use a 100 × 100 grid. Edit the values to move or resize elements. Layouts are survey drafts and must be checked on site.</p><div class="main-wide" id="drawing-preview"></div>`+review();
      case 'equipment': return common+input('Manufacturer (e.g. SmartCell)','manufacturer')+input('Exact model / part number','model')+input('Manual title / revision','title')+input('Official manufacturer HTTPS guide URL','url','url')+input('Guide checked date','checked','date')+area('Equipment notes / approved guide references','notes',true)+review();
    }
  }
  function parseMoney(value) {
    if(!/^\d+(?:\.\d{1,2})?$/.test(String(value).trim()))throw Error('Use a non-negative price with at most two decimal places.');
    const [whole,fraction='']=String(value).trim().split('.');
    const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
    if(!Number.isSafeInteger(n)||n>100000000)throw Error('Price exceeds the supported £1,000,000 limit.');return n;
  }
  function totals(values) {
    const lines=String(values.lines||'').trim().split('\n').filter(x=>x.trim()).map(line=>{
      const parts=line.split('|').map(x=>x.trim());
      if(parts.length!==3||!parts[0]||!/^\d+$/.test(parts[1])||Number(parts[1])<1||Number(parts[1])>10000)throw Error('Each line needs description | whole quantity (1–10000) | price.');
      const unit=parseMoney(parts[2]),quantity=Number(parts[1]),amount=unit*quantity;
      if(!Number.isSafeInteger(amount))throw Error('Line total is too large.');return {description:parts[0],quantity,unit,amount};
    });
    if(!lines.length)throw Error('Enter at least one line item.');
    const vat=String(values.vat??'');if(!/^\d+(?:\.\d{1,2})?$/.test(vat)||Number(vat)>100)throw Error('Enter a VAT percentage from 0 to 100 with at most two decimals.');
    const subtotal=lines.reduce((n,l)=>n+l.amount,0);if(!Number.isSafeInteger(subtotal)||subtotal>10000000000)throw Error('Document total exceeds the supported limit.');
    const tax=Math.round(subtotal*Math.round(Number(vat)*100)/10000);return {lines,subtotal,tax,total:subtotal+tax};
  }
  const pounds = p => '£'+(p/100).toFixed(2);
  function rectangles(value,marker=false) {
    return String(value||'').trim().split('\n').filter(x=>x.trim()).map(line=>{
      const p=line.split('|').map(x=>x.trim());
      if(p.length!==(marker?3:5)||!p[0]||p.slice(1).some(x=>x===''||!Number.isFinite(Number(x))))throw Error('Check layout format and numeric coordinates.');
      const [x,y,w,h]=p.slice(1).map(Number);
      if(x<0||y<0||x>100||y>100||(!marker&&(w<=0||h<=0||x+w>100||y+h>100)))throw Error('Layout elements must fit within the 0–100 grid.');
      return {label:p[0],x,y,w,h};
    });
  }
  function drawing(values) {
    const rooms=rectangles(values.layout),markers=rectangles(values.markers,true);
    return `<svg viewBox="0 0 600 600" width="100%" role="img" aria-label="Draft site layout"><title>Draft site layout — verify on site</title>${rooms.map(r=>`<rect x="${r.x*6}" y="${r.y*6}" width="${r.w*6}" height="${r.h*6}" fill="#e6f6fd" stroke="#173b5c"/><text x="${r.x*6+4}" y="${r.y*6+16}" font-size="12">${safe(r.label)}</text>`).join('')}${markers.map(r=>`<circle cx="${r.x*6}" cy="${r.y*6}" r="5" fill="#b42332"/><text x="${r.x*6+8}" y="${r.y*6+5}" font-size="12">${safe(r.label)}</text>`).join('')}</svg>`;
  }
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value}
  function validate(kind,v) {
    if(!kinds.includes(kind))throw Error('Unknown record type.');
    if(!validDate(v.date))throw Error('Enter a valid record date.');
    if(kind!=='enquiry'&&!property(v.property))throw Error('Select an existing property.');
    for(const field of ['next','due','checked'])if(v[field]&&!validDate(v[field]))throw Error('Enter a valid '+field+' date.');
    if(v.reviewed!=='yes')throw Error('Engineer / office review is required.');
    const required={service:['engineer','system','standard','tests','battery','measurements','defects','actions','recipient','declaration'],extinguisher:['engineer','asset','location','model','capacity','visitType','tests','outcome','defects'],installation:['engineer','stage','system','standard','drawingRef','devices','tests','defects','actions','recipient','declaration'],quote:['number','customer','address','due','lines','terms'],invoice:['number','customer','address','due','lines','terms'],visit:['engineer','time','minutes','serviceType','status','notes'],callout:['engineer','number','priority','status','issue','defects','actions'],enquiry:['customer','contact','site','status','owner','notes'],drawing:['title','layout','notes'],equipment:['manufacturer','model','title','url','checked','notes']};
    for(const field of required[kind])if(typeof v[field]!=='string'||!v[field].trim())throw Error('Complete '+field+' before saving.');
    for(const value of Object.values(v))if(typeof value!=='string'||value.length>100000)throw Error('Record fields must be text, at most 100,000 characters each.');
    if(['quote','invoice'].includes(kind)) {
      totals(v);if(v.due<v.date)throw Error('Due / validity date cannot precede the document date.');
      if(Number(v.vat)>0&&!v.vatNumber?.trim())throw Error('Enter the verified VAT registration before preparing a VAT draft.');
    }
    if(kind==='visit'&&(!/^\d+$/.test(v.minutes)||Number(v.minutes)<1||Number(v.minutes)>1440||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)))throw Error('Enter a valid time and duration from 1 to 1440 minutes.');
    if(kind==='visit'&&(Number(v.time.slice(0,2))*60+Number(v.time.slice(3))+Number(v.minutes)>1440))throw Error('Split overnight visits into separate dated visits.');
    if(kind==='drawing'){if(!rectangles(v.layout).length)throw Error('Enter a layout element.');rectangles(v.markers,true)}
    if(kind==='equipment'&&new URL(v.url).protocol!=='https:')throw Error('Guide links must use HTTPS.');
    if(v.next&&v.next<v.date)throw Error('Follow-up date cannot precede the record date.');
    if(kind==='callout'&&v.status==='Closed after verification'&&!v.actions?.trim())throw Error('Record verification before closing a defect.');
  }
  function overlaps(a,b) {
    if(a.kind!=='visit'||b.kind!=='visit'||a.id===b.id||a.values.date!==b.values.date||a.values.engineer.trim().toLowerCase()!==b.values.engineer.trim().toLowerCase()||['Completed','Cancelled'].includes(a.values.status)||['Completed','Cancelled'].includes(b.values.status))return false;
    const minute=v=>Number(v.time.split(':')[0])*60+Number(v.time.split(':')[1]);
    return minute(a.values)<minute(b.values)+Number(b.values.minutes)&&minute(b.values)<minute(a.values)+Number(a.values.minutes);
  }
  function saveRecord(kind,values) {
    validate(kind,values);
    let saved;
    commit(s=>{
      const old=editing?s.records.find(r=>r.id===editing.id):null;
      if(editing&&(!old||old.revision!==editing.revision))throw Error('This record changed in another tab. Reload and review the latest record before editing.');
      const candidate={id:old?.id||uid(),kind,values,revision:(old?.revision||0)+1,created:old?.created||now(),updated:now()};
      if(['quote','invoice'].includes(kind)&&s.records.some(r=>r.id!==candidate.id&&r.kind===kind&&r.values.number?.trim().toLowerCase()===values.number?.trim().toLowerCase()))throw Error('That document number already exists in this workspace.');
      if(s.records.some(r=>overlaps(candidate,r)))throw Error('This engineer already has an overlapping active visit. Adjust the time or engineer.');
      candidate.history=old?[...(old.history||[]),{revision:old.revision,values:old.values,updated:old.updated}]:[];
      s.records=s.records.filter(r=>r.id!==candidate.id);s.records.push(candidate);delete s.drafts[kind];saved=candidate;
    });
    editing=null;draft={};return saved;
  }
  function recordCard(r) {
    const v=r.values;
    return `<article class="main-record"><h3>${safe(names[r.kind])} · ${safe(v.number||v.asset||v.title||v.status||'Draft')}</h3><p>${safe(v.date)} · ${safe(propertyName(v.property)||v.site)}<br>${safe(v.engineer||v.customer||v.manufacturer||'')} · revision ${r.revision}</p>${v.next?`<p>Follow-up: ${safe(v.next)}</p>`:''}${['quote','invoice'].includes(r.kind)?`<p>${pounds(totals(v).total)} · DRAFT — not issued</p>`:''}<div class="main-actions"><button type="button" data-main-edit="${r.id}">Review / edit</button><button type="button" data-main-print="${r.id}">Preview / PDF draft</button>${r.kind==='quote'?`<button type="button" data-main-convert="${r.id}">Prepare invoice</button>`:''}${['service','callout','installation','extinguisher'].includes(r.kind)?`<button type="button" data-main-job-quote="${r.id}">Prepare quotation</button>`:''}</div><details><summary>Record details and revision history</summary>${detail(r)}${(r.history||[]).map(h=>`<details><summary>Revision ${h.revision} · ${safe(h.updated)}</summary>${detail({...r,values:h.values,history:[]})}</details>`).join('')}</details></article>`;
  }
  function detail(r) {
    let result=Object.entries(r.values).map(([key,value])=>`<p><b>${safe(key)}:</b> ${safe(value)}</p>`).join('');
    if(['quote','invoice'].includes(r.kind)){const t=totals(r.values);result+=`<p>Subtotal ${pounds(t.subtotal)} · VAT ${pounds(t.tax)} · Total ${pounds(t.total)}</p>`}
    if(r.kind==='drawing')result+=drawing(r.values);
    if(r.kind==='equipment'&&new URL(r.values.url).protocol==='https:')result+=`<p><a href="${safe(r.values.url)}" target="_blank" rel="noopener noreferrer">Open recorded manufacturer guide</a></p>`;
    return result;
  }
  function preview(id) {
    const r=record(id);if(!r)return;
    if(r.values.reviewed!=='yes')throw Error('Review the record before previewing.');
    let body=detail(r);
    if(['quote','invoice'].includes(r.kind)){
      const v=r.values,t=totals(v);
      body=`<p><b>${safe(names[r.kind])} number:</b> ${safe(v.number)}<br><b>Date:</b> ${safe(v.date)}<br><b>${r.kind==='quote'?'Valid until':'Payment due'}:</b> ${safe(v.due)}</p><h3>Customer / billing address</h3><p>${safe(v.customer)}<br>${safe(v.address).replace(/\n/g,'<br>')}</p><p><b>Site:</b> ${safe(propertyName(v.property))}<br><b>Related job / quote:</b> ${safe(v.source||'—')}</p><table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${t.lines.map(l=>`<tr><td>${safe(l.description)}</td><td>${l.quantity}</td><td>${pounds(l.unit)}</td><td>${pounds(l.amount)}</td></tr>`).join('')}</tbody></table><p>Subtotal: ${pounds(t.subtotal)}<br>VAT (${safe(v.vat)}%): ${pounds(t.tax)}<br><b>Total: ${pounds(t.total)}</b><br>VAT registration: ${safe(v.vatNumber||'Not supplied / confirm applicability')}</p><h3>Terms / exclusions</h3><p>${safe(v.terms).replace(/\n/g,'<br>')}</p><p>Company address, registration and payment details must be verified before issue.</p>`;
    }
    printDocument(names[r.kind]+' — DRAFT',`<p><b>DRAFT — NOT ISSUED. NOT A COMPLIANCE CERTIFICATE.</b></p><p>Reference ${safe(r.id)} · revision ${r.revision} · ${safe(propertyName(r.values.property))}</p>${body}<p>Prepared / reviewed by: ${safe(r.values.engineer||r.values.owner||'Office review recorded')}<br>No digital signature or statutory certification is conferred. Verify company details, scope, results and required approved certification before issue.</p>`);
  }
  function list(kind) {return state.records.filter(r=>!kind||r.kind===kind).sort((a,b)=>b.updated.localeCompare(a.updated))}
  function banner() {return `<div class="main-banner"><strong>Main-app development workspace</strong><p>Records and unfinished forms are saved on this device, separated by signed-in account. ${scope()==='device-guest'?'Guest workspace — shared on this device.':''} Existing prototype records remain in their original storage. Cloud records require the separately reviewed setup.</p><p>Drafts require review. This app does not control, silence, reset or isolate a fire alarm.</p><div class="main-actions"><button type="button" data-tab="Property History">Property history</button><button type="button" data-tab="Record Backup">Backup / cloud snapshots</button><a href="#academy">Training Academy</a></div><p id="main-status" class="main-status" role="status" aria-live="polite">${safe(storageError)}</p></div>`}
  function workspace(kind) {
    const stored=state.drafts[kind];if(stored){draft=stored.values;editing=stored.editing}else {draft={};editing=null}
    return `${kind==='equipment'?'<p>SmartCell: add the exact model and verified official manual below. No manufacturer procedures have been invented or bundled. Links open only after your choice.</p>':''}<section class="panel"><h2>${editing?'Edit':'New'} ${safe(names[kind])} — draft</h2><form data-main-form="${kind}" data-main-scope="${safe(scope())}"><div class="main-grid">${buildFields(kind)}</div><div class="main-actions"><button type="submit">Review and save draft</button><button type="button" data-main-clear="${kind}">Start new / clear draft</button></div><p>Unfinished forms save locally as you type. Dictation uses your browser’s speech service and may send audio to its provider; review every word before saving.</p><p id="dictation-status" role="status"></p><button type="button" data-main-stop>Stop dictation</button></form></section><section class="panel"><h2>Saved ${safe(names[kind])} records (${list(kind).length})</h2>${list(kind).map(recordCard).join('')||'<p>No new records yet.</p>'}</section>`;
  }
  function restore() {
    const form=document.querySelector('form[data-main-form]');if(!form)return;
    for(const [name,value]of Object.entries(draft)){const el=form.elements.namedItem(name);if(el){if(el.type==='checkbox')el.checked=value==='yes';else el.value=value}}
    updatePreview(form);
  }
  function updatePreview(form) {
    const v=fields(form);
    if(['quote','invoice'].includes(form.dataset.mainForm)){
      const el=document.getElementById('main-total');try{const t=totals(v);el.textContent=`Subtotal ${pounds(t.subtotal)} · VAT ${pounds(t.tax)} · Total ${pounds(t.total)}`}catch(error){el.textContent=error.message}
    }
    if(form.dataset.mainForm==='drawing'){const el=document.getElementById('drawing-preview');try{el.innerHTML=drawing(v)}catch(error){el.textContent=error.message}}
  }
  function historyPage() {
    return `<section class="panel"><h2>Property history</h2><label>Property<select id="main-history-property"><option value="">Select property…</option>${db.properties.map(p=>`<option value="${safe(p.id)}">${safe(p.name)}</option>`).join('')}</select></label><div id="main-history"></div></section>`;
  }
  function showHistory(id) {
    const target=document.getElementById('main-history');if(!target)return;
    let html=list().filter(r=>r.values.property===id).map(recordCard).join('');
    const legacy=['services','pat','lighting','quotes','jobs'].flatMap(kind=>(db[kind]||[]).filter(r=>r.property===id).map(r=>({kind,values:r})));
    html+=`<h3>Existing prototype records (${legacy.length})</h3><p>Original device records are preserved and have no new approval or certification status.</p>`+legacy.map(r=>`<article class="main-record"><b>${safe(r.kind)}</b>${Object.entries(r.values).map(([k,v])=>`<p>${safe(k)}: ${safe(typeof v==='object'?JSON.stringify(v):v)}</p>`).join('')}</article>`).join('');
    target.innerHTML=html||'<p>No history recorded.</p>';
  }
  function scheduleSummary() {
    const t=today();const visits=list('visit').filter(r=>!['Completed','Cancelled'].includes(r.values.status)).sort((a,b)=>(a.values.date+a.values.time).localeCompare(b.values.date+b.values.time));
    const follow=list().filter(r=>r.values.next&&r.values.next<=new Date(Date.now()+30*86400000).toISOString().slice(0,10));
    return `<section class="panel"><h2>Service reminders</h2><p>On-screen reminders only. No unattended email, SMS or background delivery is configured.</p>${visits.map(r=>`<p><b>${r.values.date<t?'Overdue':'Upcoming'}</b> ${safe(r.values.date)} ${safe(r.values.time)} · ${safe(propertyName(r.values.property))} · ${safe(r.values.engineer)}</p>`).join('')||'<p>No active visits.</p>'}${follow.map(r=>`<p>Follow-up ${safe(r.values.next)} · ${safe(names[r.kind])} · ${safe(propertyName(r.values.property))}</p>`).join('')}</section>`;
  }
  function officeSummary() {
    return `<section class="panel"><h2>Office dashboard</h2><p>${list('enquiry').filter(r=>r.values.status!=='Closed').length} open enquiries · ${list('callout').filter(r=>r.values.status!=='Closed after verification').length} open call-outs / defects · ${list('quote').length} draft quotes · ${list('invoice').length} draft invoices</p><p>Follow-ups and engineer visits appear below. Public enquiry submission and automatic messages are not configured.</p><div class="main-actions"><button data-tab="Call-outs">Call-outs</button><button data-tab="Quotes">Quotes</button><button data-tab="Invoices">Invoices</button><button data-tab="Planner">Planner</button></div></section>`+scheduleSummary();
  }
  function backupPage(){return `<section class="panel"><h2>Record backup and cloud snapshots</h2><p>Export includes this account’s new records, revisions and unfinished forms. Existing device records have a separate backup. Neither export includes authentication tokens.</p><div class="main-actions"><button data-main-export>Download workspace JSON</button><button data-backup>Download existing device records</button><button data-main-raw>Download raw workspace (recovery)</button></div><label>Restore workspace JSON (merge only; conflicting records are rejected)<input type="file" id="main-import" accept="application/json,.json"></label><h3>Supabase snapshots — optional, manual</h3><p>Requires an owner-reviewed main_app_snapshots table and RLS policies. No setup runs automatically. Upload saves an immutable snapshot; it never replaces cloud properties or other snapshots. Automatic syncing and team sharing are not enabled.</p><div class="main-actions"><button data-main-upload>Upload reviewed workspace snapshot</button><button data-main-cloud-list>List my cloud snapshots</button></div><div id="main-cloud-list"></div></section>`}
  const originalRender=render;
  render=function(){
    remember();load();stopSpeech();originalRender();
    const kind=pages[tab],view=document.getElementById('view');
    if(tab==='Dashboard'){
      view.insertAdjacentHTML('beforeend',`<section class="main-app"><div class="main-heading"><h2>Main-app workflows</h2></div><div class="main-actions">${extra.map(t=>`<button type="button" data-tab="${t}">${t}</button>`).join('')}</div>${banner()}${officeSummary()}</section>`);return;
    }
    if(kind){const legacy=['Service Records','Quotes','Planner'].includes(tab)?`<details class="panel"><summary>Preserved prototype ${safe(tab)} — existing records</summary><div id="main-legacy"></div></details>`:'';const old=view.innerHTML;view.innerHTML=`<div class="main-app">${banner()}${tab==='Office'?officeSummary():''}${tab==='Planner'?scheduleSummary():''}${workspace(kind)}${legacy}</div>`;const el=document.getElementById('main-legacy');if(el){el.innerHTML=old;el.querySelectorAll('form').forEach(f=>f.remove());if(tab==='Planner'){el.querySelectorAll('[data-plan-filter]').forEach(b=>b.remove())}}restore();}
    else if(tab==='Property History'||tab==='Record Backup')view.innerHTML=`<div class="main-app">${banner()}${tab==='Property History'?historyPage():backupPage()}</div>`;
    else if(tab==='Properties')view.insertAdjacentHTML('beforeend','<div class="main-actions"><button data-tab="Property History">Open property history</button></div>');
  };
  function download(name,value,type='application/json') {const url=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function exportData(){return {application:'paramount-main-app',version:VERSION,scope:scope(),exported:now(),records:state.records,drafts:state.drafts}}
  function merge(data) {
    if(data.application!=='paramount-main-app'||data.version!==VERSION||data.scope!==scope()||!Array.isArray(data.records)||data.records.length>10000)throw Error('Use a valid backup for this signed-in account / guest workspace.');
    const ids=new Set();for(const r of data.records){if(!r||typeof r.id!=='string'||ids.has(r.id)||!kinds.includes(r.kind)||!Number.isInteger(r.revision)||r.revision<1||!Array.isArray(r.history)||!validDate(r.values?.date))throw Error('Backup contains an invalid or duplicate record.');ids.add(r.id);validate(r.kind,r.values);for(const h of r.history)validate(r.kind,h.values)}
    commit(s=>{for(const r of data.records){const old=s.records.find(x=>x.id===r.id);if(old&&JSON.stringify(old)!==JSON.stringify(r))throw Error('Backup conflicts with an existing record. No changes imported.')}for(const r of data.records)if(!s.records.some(x=>x.id===r.id))s.records.push(r)});
    // Unfinished forms are exported for recovery but never overwrite current work on import.
  }
  async function upload() {
    if(!cloudSession?.user?.id)throw Error('Sign in using the existing Cloud Properties screen first.');
    if(storageError)throw Error(storageError);
    if(!confirm('Upload this account’s saved records and revision history to its private Supabase snapshots? Unfinished forms are excluded. No existing records will be overwritten.'))return;
    const payload={...exportData(),drafts:{}};await cloudAuthorizedRequest('/rest/v1/main_app_snapshots',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id:uid(),user_id:cloudSession.user.id,payload})});message('Snapshot uploaded. No existing cloud properties were changed.');
  }
  async function cloudList() {
    if(!cloudSession?.user?.id)throw Error('Sign in using Cloud Properties first.');
    const rows=await cloudAuthorizedRequest('/rest/v1/main_app_snapshots?select=id,created_at&order=created_at.desc&limit=30');
    const el=document.getElementById('main-cloud-list');if(el)el.innerHTML=rows.map(r=>`<p>${safe(r.created_at)} <button data-main-cloud-download="${safe(r.id)}">Download snapshot JSON</button></p>`).join('')||'No snapshots.';
  }
  function stopSpeech(){if(speech){speech.onresult=null;speech.abort();speech=null}speechTarget=null}
  function dictate(name) {
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition)throw Error('Dictation is unavailable in this browser. Use the keyboard microphone or type the notes.');
    const form=document.querySelector('form[data-main-form]');if(!form)return;
    if(!confirm('Start browser dictation? Your browser may send audio to its speech provider. Review the transcript before saving.'))return;
    stopSpeech();speechTarget=form.elements.namedItem(name);speech=new Recognition();speech.lang='en-GB';speech.interimResults=false;
    speech.onresult=e=>{if(!speechTarget?.isConnected)return;const text=Array.from(e.results).map(r=>r[0].transcript).join(' ');speechTarget.value+=(speechTarget.value?'\n':'')+text;const reviewed=form.elements.namedItem('reviewed');if(reviewed)reviewed.checked=false;remember();document.getElementById('dictation-status').textContent='Draft transcript added. Engineer review is required.'};
    speech.onerror=()=>{const el=document.getElementById('dictation-status');if(el)el.textContent='Dictation stopped or unavailable. Type or use your keyboard microphone.'};speech.start();document.getElementById('dictation-status').textContent='Listening… select Stop dictation when finished.';
  }
  document.addEventListener('input',e=>{const form=e.target.closest('form[data-main-form]');if(!form)return;if(form.dataset.mainScope!==scope()){message('Account changed. Reload before editing.');return}load();if(e.target.name!=='reviewed')form.elements.namedItem('reviewed').checked=false;remember();updatePreview(form)});
  document.addEventListener('submit',e=>{const form=e.target.closest('form[data-main-form]');if(!form)return;e.preventDefault();stopSpeech();if(form.dataset.mainScope!==scope()){message('Account changed. Reload this form before saving.');return}load();try{const r=saveRecord(form.dataset.mainForm,fields(form));form.removeAttribute('data-main-form');render();message('Draft saved on this device. Review / PDF preview is available below. Reference: '+r.id)}catch(error){message('Not saved: '+error.message)}});
  document.addEventListener('change',async e=>{
    if(e.target.id==='main-history-property')showHistory(e.target.value);
    if(e.target.id==='main-import'&&e.target.files?.[0])try{if(e.target.files[0].size>10000000)throw Error('Backup exceeds 10 MB.');const data=JSON.parse(await e.target.files[0].text());if(!confirm('Merge this backup into the current workspace? Existing records and forms will not be overwritten.'))return;merge(data);render();message('Backup merged. Existing drafts were retained.')}catch(error){message('Import rejected: '+error.message)}
  });
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-main-edit],[data-main-print],[data-main-clear],[data-main-convert],[data-main-job-quote],[data-main-export],[data-main-raw],[data-main-upload],[data-main-cloud-list],[data-main-cloud-download],[data-main-dictate],[data-main-stop]');if(!b)return;
    load();try{
      if(b.dataset.mainEdit){const r=record(b.dataset.mainEdit);if(!r)return;remember();const existing=state.drafts[r.kind];if(existing&&Object.values(existing.values).some(Boolean)&&!confirm('Replace the unfinished form with this saved record?'))return;commit(s=>s.drafts[r.kind]={values:r.values,editing:{id:r.id,revision:r.revision},updated:now()});document.querySelector('form[data-main-form]')?.removeAttribute('data-main-form');tab=Object.keys(pages).find(k=>pages[k]===r.kind);render();document.querySelector('form[data-main-form]')?.scrollIntoView({block:'start'});}
      else if(b.dataset.mainPrint)preview(b.dataset.mainPrint);
      else if(b.dataset.mainClear){if(!confirm('Clear this unfinished form? Saved records are kept.'))return;commit(s=>delete s.drafts[b.dataset.mainClear]);document.querySelector('form[data-main-form]')?.removeAttribute('data-main-form');render()}
      else if(b.dataset.mainConvert){const r=record(b.dataset.mainConvert);if(!r)return;remember();if(state.drafts.invoice&&!confirm('Replace the unfinished invoice form? Saved invoices are kept.'))return;commit(s=>s.drafts.invoice={values:{...r.values,number:'',source:r.values.number,date:today(),due:'',reviewed:''},editing:null,updated:now()});document.querySelector('form[data-main-form]')?.removeAttribute('data-main-form');tab='Invoices';render()}
      else if(b.dataset.mainJobQuote){
        const r=record(b.dataset.mainJobQuote);
        if(!r || !['service','callout','installation','extinguisher'].includes(r.kind))throw Error('Only saved engineering jobs can prepare quotations.');
        remember();
        if(state.drafts.quote && Object.values(state.drafts.quote.values||{}).some(Boolean) && !confirm('Replace the unfinished quotation form? Saved quotations are kept.'))return;
        const reference=r.values.number||r.values.asset||r.id;
        const summary=[r.values.issue,r.values.defects,r.values.actions].filter(Boolean).join(' / ').slice(0,1500);
        commit(s=>{s.drafts.quote={values:{property:r.values.property,date:today(),number:'',customer:'',address:'',due:'',lines:'',vat:'0',vatNumber:'',source:reference,terms:summary?'Job observations (verify before quoting): '+summary:'',reviewed:''},editing:null,updated:now()}});
        document.querySelector('form[data-main-form]')?.removeAttribute('data-main-form');
        tab='Quotes';render();
        message('Quotation draft prepared from saved job. Enter billing details, agreed scope, quantities and prices; nothing has been issued.');
        document.querySelector('form[data-main-form]')?.scrollIntoView({block:'start'});
      }
      else if(b.hasAttribute('data-main-export'))download('paramount-workspace-backup.json',JSON.stringify(exportData(),null,2));
      else if(b.hasAttribute('data-main-raw'))download('paramount-workspace-raw.txt',localStorage.getItem(storageKey())||'');
      else if(b.hasAttribute('data-main-upload'))await upload();
      else if(b.hasAttribute('data-main-cloud-list'))await cloudList();
      else if(b.dataset.mainCloudDownload){if(!/^[0-9a-f-]{36}$/i.test(b.dataset.mainCloudDownload))throw Error('Invalid snapshot reference.');const rows=await cloudAuthorizedRequest('/rest/v1/main_app_snapshots?select=payload&id=eq.'+encodeURIComponent(b.dataset.mainCloudDownload));if(rows[0])download('paramount-cloud-snapshot.json',JSON.stringify(rows[0].payload,null,2))}
      else if(b.dataset.mainDictate)dictate(b.dataset.mainDictate);
      else if(b.hasAttribute('data-main-stop'))stopSpeech();
    }catch(error){message(error.message+' No existing cloud records were changed.')}
  });
  addEventListener('beforeunload',()=>{remember();stopSpeech()});
  addEventListener('storage',e=>{if(e.key===storageKey())message('Workspace changed in another tab. Reload before editing saved records; stale revisions cannot overwrite newer records.')});
  // Read-only test interface: no credentials or automatic cloud calls.
  window.ParamountMainApp={totals,parseMoney,rectangles,validDate,overlaps,validate,version:VERSION};
  render();
})();
