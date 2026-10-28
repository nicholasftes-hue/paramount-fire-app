/* Additive main-app workflows. The original inline app and Supabase auth remain intact. */
(() => {
  'use strict';
  const VERSION = 1;
  const kinds = ['service','pat','lighting','extinguisher','installation','quote','invoice','visit','callout','enquiry','drawing','equipment'];
  const names = {service:'Fire alarm service',pat:'PAT test record',lighting:'Emergency lighting test',extinguisher:'Extinguisher register / service',installation:'Installation / commissioning',quote:'Quotation',invoice:'Invoice',visit:'Scheduled visit',callout:'Call-out / defect / repair',enquiry:'Customer enquiry',drawing:'Site layout',equipment:'Equipment reference'};
  const pages = {'Service Records':'service','PAT Testing':'pat','Emergency Lighting':'lighting','Extinguishers':'extinguisher','Installation Forms':'installation','Quotes':'quote','Invoices':'invoice','Planner':'visit','Call-outs':'callout','Office':'enquiry','Drawing Studio':'drawing','Equipment Library':'equipment'};
  const extra = ['PAT Testing','Emergency Lighting','Extinguishers','Installation Forms','Invoices','Call-outs','Office','Property History','Drawing Studio','Equipment Library','Record Backup','Equipment Registers'];
  if(!window.ParamountTeamSync)extra.forEach(s=>{if(!sections.includes(s))sections.push(s)});
  let activeScope = '', state, editing = null, speech = null, speechTarget = null;
  let draft = {}, storageError = '', propertyEditing = null;
  const team = () => window.ParamountTeamSync;
  const scope = () => team()?.scope() || cloudSession?.user?.id || 'device-guest';
  const properties = () => team() ? team().properties() : db.properties;
  const storageKey = () => 'paramount-main-app-v1:' + scope();
  const empty = () => ({version:VERSION,records:[],drafts:{}});
  const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const safe = value => esc(value);
  function read() {
    const raw = team() ? JSON.stringify(team().read()) : localStorage.getItem(storageKey());
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
    if(team())team().write(fresh);else localStorage.setItem(storageKey(),JSON.stringify(fresh));state=fresh;
  }
  function message(text) {const el=document.getElementById('main-status');if(el)el.textContent=text}
  const record = id => state.records.find(r=>r.id===id);
  const property = id => properties().find(p=>p.id===id);
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
  function prop() {return `<label>Property<select name="property" required><option value="">Select property…</option>${properties().map(p=>`<option value="${safe(p.id)}">${safe(p.name)}</option>`).join('')}</select></label>`}
  function review() {return `<label class="main-check main-wide"><input type="checkbox" name="reviewed" value="yes" required><span>I have reviewed the entered results, scope, defects and any dictated text. This saves a draft record; it does not certify compliance or operate an alarm.</span></label>`}
  function signatures() {
    return '<fieldset class="main-wide"><legend>Draft signature acknowledgements</legend><p>Optional typed signatures record acknowledgement of this draft only. Competent review and controlled issue remain outstanding.</p><div class="main-grid">'+input('Engineer signature (typed)','engineerSignature','text',false)+input('Engineer signature date','engineerSigned','date',false)+input('Customer / responsible person name','customerName','text',false)+input('Customer signature (typed)','customerSignature','text',false)+input('Customer signature date','customerSigned','date',false)+'</div></fieldset>';
  }
  function nextAsset(asset) {return String(asset).replace(/(\d+)$/,n=>String(Number(n)+1).padStart(n.length,'0'))===asset?'':String(asset).replace(/(\d+)$/,n=>String(Number(n)+1).padStart(n.length,'0'))}
  function quickEntry() {return '<div class="main-wide"><h3>Appliance quick-entry</h3><p>Choose an appliance, enter its unique asset ID and actual test results, then save and continue. Test outcomes are never copied.</p><div class="main-actions">'+['Kettle','Toaster','Router','Washing machine','Fridge / freezer','Other'].map(a=>`<button type="button" data-main-appliance="${a}">${a}</button>`).join('')+'</div></div>'}
  function buildFields(kind) {
    const site = kind==='enquiry' ? input('Customer name','customer')+input('Email / phone','contact') : prop();
    const common=site+input(kind==='visit'?'Visit date':'Record date','date','date',true,today());
    switch(kind) {
      case 'service': return common+input('Engineer','engineer')+input('System / panel make, model and category','system')+input('Service scope / agreed standard and edition','standard')+area('Devices / zones tested and actual results (one per line)','tests',true)+select('Battery inspection','battery',['Satisfactory','Unsatisfactory','Not inspected','Not applicable'])+input('Battery voltage measured (V, optional)','batteryVoltage','number',false)+input('Battery rated capacity (Ah, optional)','batteryAh','number',false)+area('Measured values, instruments and calibration reference','measurements',true)+area('Defects / limitations / inaccessible areas','defects',true)+area('Actions and advice to responsible person','actions',true)+input('Next agreed service date','next','date',false)+input('Responsible person / handover recipient','recipient')+area('Engineer declaration / work completed within stated scope','declaration',true)+signatures()+review();
      case 'pat': return quickEntry()+common+input('Engineer / tester','engineer')+input('Test instrument / serial number','instrument')+input('Calibration reference / due date','calibration')+input('Appliance ID / asset number','asset')+select('Appliance type','appliance',['Kettle','Toaster','Router','Oven','Hob','Cooker hood','Washing machine','Tumble dryer','Dishwasher','Fridge / freezer','Other'])+input('Room / location','location')+select('Equipment class','equipmentClass',['Class I','Class II','Class III','Not determined'])+area('Visual inspection observations','visual',true)+area('Electrical tests performed, actual readings, limits and method','tests',true)+select('Recorded outcome','outcome',['Pass within recorded test scope','Fail / unsafe — action required','Not tested / inaccessible'])+area('Defects, labels, isolation and actions / advice','defects',true)+input('Next agreed test date','next','date',false)+signatures()+review();
      case 'lighting': return common+input('Engineer / tester','engineer')+input('System / fitting reference','system')+input('Location / circuit / asset IDs','location')+select('Test scope','testType',['Routine functional test','Duration test','Visual inspection','Other agreed scope'])+input('Duration observed (minutes)','duration','number',false)+area('Fittings tested, method and actual results','tests',true)+area('Defects, inaccessible fittings and limitations','defects',true)+area('Remedial action / responsible person notified','actions',true)+select('Recorded outcome','outcome',['Satisfactory within recorded scope','Defective / action required','Not tested / inaccessible'],false)+input('Supply restored / charging indicator observations','restoration','text',false)+input('Responsible person notified','recipient','text',false)+input('Next agreed test date','next','date',false)+signatures()+review();
      case 'extinguisher': return common+input('Engineer','engineer')+input('Asset / serial number','asset')+input('Location','location')+input('Manufacturer / model','model')+input('Type and capacity','capacity')+input('Manufacture date / year','manufactured','text',false)+input('Last extended service / test date','lastTest','date',false)+select('Visit type','visitType',['Basic service','Extended service','Replacement','Inspection only'])+area('Checks performed and measured results','tests',true)+select('Recorded outcome','outcome',['Satisfactory within recorded scope','Defective / action required','Not serviced / inaccessible'])+area('Defects, limitations and action taken','defects',true)+input('Next agreed service date','next','date',false)+review();
      case 'installation': return common+input('Engineer','engineer')+select('Form stage','stage',['Installation record','Commissioning record'])+input('System make / model / category','system')+input('Design / specification reference and standard edition','standard')+input('Drawing revision / cause-and-effect reference','drawingRef')+area('Installed devices, addresses / zones and locations','devices',true)+area('Inspection and test results, actual measurements','tests',true)+area('Variations, defects, exclusions and limitations','defects',true)+area('Handover documents, training and outstanding actions','actions',true)+input('Responsible person / recipient','recipient')+area('Engineer declaration limited to recorded scope','declaration',true)+review();
      case 'quote': case 'invoice': return common+input(kind==='quote'?'Quotation number':'Invoice number','number')+input('Customer / billing name','customer')+area('Billing address','address',true)+input(kind==='quote'?'Valid until':'Payment due','due','date')+area('Line items: description | quantity | unit price (£), one per line','lines',true)+input('VAT rate (%) — confirm applicability','vat','number',true,'0')+input('VAT registration (if applicable)','vatNumber','text',false)+input('Related quote / job reference','source','text',false)+area('Terms, exclusions and payment instructions (verified details only)','terms',true)+`<p class="main-wide main-total" id="main-total">Enter line items to calculate totals.</p>`+review();
      case 'visit': return common+input('Engineer / team','engineer')+input('Start time (local)','time','time')+input('Duration (minutes)','minutes','number',true,'60')+select('Service type','serviceType',['Fire alarm','Extinguisher','PAT','Emergency lighting','Call-out','Installation / commissioning'])+select('Visit status','status',['Planned','Confirmed','Completed','Cancelled'])+area('Access arrangements / scope / reminder notes','notes',true)+review();
      case 'callout': return common+input('Engineer','engineer')+input('Job reference','number')+select('Priority','priority',['Routine','Urgent','Immediate responsible-person attention'])+select('Status','status',['Open','Investigating','Repair proposed','Repaired — awaiting verification','Closed after verification'])+area('Reported issue and affected equipment / locations','issue',true)+area('Observed defects, risks and advice to responsible person','defects',true)+area('Actions taken / parts / verification results','actions',true)+input('Follow-up date','next','date',false)+review();
      case 'enquiry': return common+input('Site / address enquiry relates to','site')+select('Status','status',['New','Contacted','Survey needed','Quote prepared','Closed'])+input('Office owner','owner')+input('Follow-up date','next','date',false)+area('Request and next action','notes',true)+review();
      case 'drawing': return common+input('Layout title / revision','title')+area('Editable layout: label | x | y | width | height (0–100), one rectangle per line','layout',true)+area('Equipment markers: label | x | y (0–100), one per line','markers')+area('Legend, scale / not to scale, survey limitations','notes',true)+`<p class="main-wide">Coordinates use a 100 × 100 grid. Edit the values to move or resize elements. Layouts are survey drafts and must be checked on site.</p><div class="main-wide" id="drawing-preview"></div>`+review();
      case 'equipment': return common+input('Asset / serial number (optional)','asset','text',false)+input('Installed location (optional)','location','text',false)+input('Next inspection / review date (optional)','next','date',false)+input('Manufacturer (e.g. SmartCell)','manufacturer')+input('Exact model / part number','model')+input('Manual title / revision','title')+input('Official manufacturer HTTPS guide URL','url','url')+input('Guide checked date','checked','date')+area('Equipment notes / approved guide references','notes',true)+review();
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
    for(const field of ['next','due','checked','engineerSigned','customerSigned'])if(v[field]&&!validDate(v[field]))throw Error('Enter a valid '+field+' date.');
    if(v.reviewed!=='yes')throw Error('Engineer / office review is required.');
    const required={pat:['engineer','instrument','calibration','asset','appliance','location','equipmentClass','visual','tests','outcome','defects'],lighting:['engineer','system','location','testType','tests','defects','actions'],service:['engineer','system','standard','tests','battery','measurements','defects','actions','recipient','declaration'],extinguisher:['engineer','asset','location','model','capacity','visitType','tests','outcome','defects'],installation:['engineer','stage','system','standard','drawingRef','devices','tests','defects','actions','recipient','declaration'],quote:['number','customer','address','due','lines','terms'],invoice:['number','customer','address','due','lines','terms'],visit:['engineer','time','minutes','serviceType','status','notes'],callout:['engineer','number','priority','status','issue','defects','actions'],enquiry:['customer','contact','site','status','owner','notes'],drawing:['title','layout','notes'],equipment:['manufacturer','model','title','url','checked','notes']};
    for(const field of required[kind])if(typeof v[field]!=='string'||!v[field].trim())throw Error('Complete '+field+' before saving.');
    for(const value of Object.values(v))if(typeof value!=='string'||value.length>100000)throw Error('Record fields must be text, at most 100,000 characters each.');
    if(['quote','invoice'].includes(kind)) {
      totals(v);if(v.due<v.date)throw Error('Due / validity date cannot precede the document date.');
      if(Number(v.vat)>0&&!v.vatNumber?.trim())throw Error('Enter the verified VAT registration before preparing a VAT draft.');
    }
    if(kind==='service')for(const field of ['batteryVoltage','batteryAh'])if(v[field] && (!/^\d+(?:\.\d{1,3})?$/.test(v[field])||Number(v[field])>1000))throw Error('Battery readings must be between 0 and 1000, with at most three decimal places.');
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
    if(kind==='lighting' && values.duration && (!/^\d+(?:\.\d{1,2})?$/.test(values.duration)||Number(values.duration)>1440))throw Error('Lighting duration must be between 0 and 1440 minutes.');
    if(kind==='lighting'&&values.testType==='Duration test'&&(!values.duration||Number(values.duration)<=0))throw Error('Record the actual observed duration for a duration test.');
    let saved;
    commit(s=>{
      const old=editing?s.records.find(r=>r.id===editing.id):null;
      if(editing&&(!old||old.revision!==editing.revision))throw Error('This record changed in another tab. Reload and review the latest record before editing.');
      const candidate={id:old?.id||uid(),kind,values:{...values},revision:(old?.revision||0)+1,created:old?.created||now(),updated:now()};
      if(['service','pat','lighting','quote','invoice'].includes(kind))candidate.siteSnapshot=(old?.values.property===values.property?old.siteSnapshot:null)||siteDetails(property(values.property));
      if(['quote','invoice'].includes(kind)&&s.records.some(r=>r.id!==candidate.id&&r.kind===kind&&r.values.number?.trim().toLowerCase()===values.number?.trim().toLowerCase()))throw Error('That document number already exists in this workspace.');
      if(s.records.some(r=>overlaps(candidate,r)))throw Error('This engineer already has an overlapping active visit. Adjust the time or engineer.');
      candidate.history=old?[...(old.history||[]),{revision:old.revision,values:old.values,updated:old.updated,...(old.siteSnapshot?{siteSnapshot:old.siteSnapshot}:{})}]:[];
      s.records=s.records.filter(r=>r.id!==candidate.id);s.records.push(candidate);delete s.drafts[kind];saved=candidate;
    });
    editing=null;draft={};return saved;
  }
  function recordCard(r) {
    const v=r.values;
    return `<article class="main-record"><h3>${safe(names[r.kind])} · ${safe(v.number||v.asset||v.title||v.status||'Draft')}</h3><p>${safe(v.date)} · ${safe(propertyName(v.property)||v.site)}<br>${safe(v.engineer||v.customer||v.manufacturer||'')} · revision ${r.revision}</p>${v.next?`<p>Follow-up: ${safe(v.next)}</p>`:''}${['quote','invoice'].includes(r.kind)?`<p>${pounds(totals(v).total)} · DRAFT — not issued</p>`:''}<div class="main-actions"><button type="button" data-main-edit="${safe(r.id)}">Review / edit</button><button type="button" data-main-print="${safe(r.id)}">Preview / PDF draft</button><button type="button" data-main-pdf="${safe(r.id)}">Download PDF draft</button><button type="button" data-main-word="${safe(r.id)}">Download editable Word draft</button>${r.kind==='visit'?`<button type="button" data-main-pack="${safe(r.id)}">Engineer job pack</button>`:''}${r.kind==='quote'?`<button type="button" data-main-convert="${safe(r.id)}">Prepare invoice</button>`:''}${['service','pat','lighting','callout','installation','extinguisher'].includes(r.kind)?`<button type="button" data-main-job-quote="${safe(r.id)}">Prepare quotation</button><button type="button" data-main-job-invoice="${safe(r.id)}">Prepare invoice from job</button>`:''}</div><details><summary>Record details and revision history</summary>${detail(r)}${(r.history||[]).map(h=>`<details><summary>Revision ${h.revision} · ${safe(h.updated)}</summary>${detail({...r,values:h.values,siteSnapshot:h.siteSnapshot,history:[]})}</details>`).join('')}</details></article>`;
  }
  function detail(r) {
    let result=(r.siteSnapshot?'<h3>Site details recorded at first save</h3>'+Object.entries(r.siteSnapshot).map(([k,v])=>`<p><b>${safe(k)}:</b> ${safe(v)}</p>`).join(''):'')+Object.entries(r.values).map(([key,value])=>`<p><b>${safe(key)}:</b> ${safe(value)}</p>`).join('');
    if(['quote','invoice'].includes(r.kind)){const t=totals(r.values);result+=`<p>Subtotal ${pounds(t.subtotal)} · VAT ${pounds(t.tax)} · Total ${pounds(t.total)}</p>`}
    if(r.kind==='drawing')result+=drawing(r.values);
    if(r.kind==='equipment'&&new URL(r.values.url).protocol==='https:')result+=`<p><a href="${safe(r.values.url)}" target="_blank" rel="noopener noreferrer">Open recorded manufacturer guide</a></p>`;
    return result;
  }
  function preview(id) {
    const r=record(id);if(!r)return;
    if(r.values.reviewed!=='yes')throw Error('Review the record before previewing.');
    let body=['service','pat','lighting'].includes(r.kind)?certificateHtml(r):detail(r);
    if(['quote','invoice'].includes(r.kind)){
      const v=r.values,t=totals(v);
      body=`<p><b>${safe(names[r.kind])} number:</b> ${safe(v.number)}<br><b>Date:</b> ${safe(v.date)}<br><b><button type="button" data-main-word="${safe(r.id)}">Download editable Word draft</button>${r.kind==='visit'?`<button type="button" data-main-pack="${safe(r.id)}">Engineer job pack</button>`:''}${r.kind==='quote'?'Valid until':'Payment due'}:</b> ${safe(v.due)}</p><h3>Customer / billing address</h3><p>${safe(v.customer)}<br>${safe(v.address).replace(/\n/g,'<br>')}</p><p><b>Site:</b> ${safe(propertyName(v.property))}<br><b>Related job / quote:</b> ${safe(v.source||'—')}</p><table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${t.lines.map(l=>`<tr><td>${safe(l.description)}</td><td>${l.quantity}</td><td>${pounds(l.unit)}</td><td>${pounds(l.amount)}</td></tr>`).join('')}</tbody></table><p>Subtotal: ${pounds(t.subtotal)}<br>VAT (${safe(v.vat)}%): ${pounds(t.tax)}<br><b>Total: ${pounds(t.total)}</b><br>VAT registration: ${safe(v.vatNumber||'Not supplied / confirm applicability')}</p><h3>Terms / exclusions</h3><p>${safe(v.terms).replace(/\n/g,'<br>')}</p><p>Company address, registration and payment details must be verified before issue.</p>`;
    }
    printDocument(names[r.kind]+' — DRAFT',`<p><b>DRAFT — NOT ISSUED. NOT A COMPLIANCE CERTIFICATE.</b></p><p>Reference ${safe(r.id)} · revision ${r.revision} · ${safe(r.siteSnapshot?.name||propertyName(r.values.property))}</p>${body}<p>Prepared / reviewed by: ${safe(r.values.engineer||r.values.owner||'Office review recorded')}<br>No digital signature or statutory certification is conferred. Verify company details, scope, results and required approved certification before issue.</p>`);
  }
  function list(kind) {return state.records.filter(r=>!kind||r.kind===kind).sort((a,b)=>b.updated.localeCompare(a.updated))}
  function banner() {if(team())return team().banner();return `<div class="main-banner"><strong>Main-app development workspace</strong><p>Records and unfinished forms are saved on this device, separated by signed-in account. ${scope()==='device-guest'?'Guest workspace — shared on this device.':''} Existing prototype records remain in their original storage. Cloud records require the separately reviewed setup.</p><p>Drafts require review. This app does not control, silence, reset or isolate a fire alarm.</p><div class="main-actions"><button type="button" data-tab="Property History">Property history</button><button type="button" data-tab="Record Backup">Backup / cloud snapshots</button><a href="#academy">Training Academy</a></div><p id="main-status" class="main-status" role="status" aria-live="polite">${safe(storageError)}</p></div>`}
  function workspace(kind) {
    const stored=state.drafts[kind];if(stored){draft=stored.values;editing=stored.editing}else {draft={};editing=null}
    return `${kind==='service'?'<p>Paramount fire alarm certificates remain DRAFT pending competent review. Optional engineer and customer signature acknowledgements do not issue a certificate.</p>':''}${kind==='equipment'?'<p>SmartCell: add the exact model and verified official manual below. No manufacturer procedures have been invented or bundled. Links open only after your choice.</p>':''}<section class="panel"><h2>${editing?'Edit':'New'} ${safe(names[kind])} — draft</h2><form data-main-form="${kind}" data-main-scope="${safe(scope())}"><div class="main-grid">${buildFields(kind)}</div><div class="main-actions"><button type="submit">Review and save draft</button><button type="button" data-main-clear="${kind}">Start new / clear draft</button>${kind==='pat'?'<button type="submit" name="continueAppliance" value="yes">Save draft &amp; next appliance</button>':''}${['pat','lighting'].includes(kind)?`<button type="button" data-main-report="${kind}">Download selected site ${kind==='pat'?'PAT register':'lighting records'} PDF draft</button>`:''}</div><p>Unfinished forms save locally as you type. Dictation uses your browser’s speech service and may send audio to its provider; review every word before saving.</p><p id="dictation-status" role="status"></p><button type="button" data-main-stop>Stop dictation</button></form></section><section class="panel"><h2>Saved ${safe(names[kind])} records (${list(kind).length})</h2>${list(kind).map(recordCard).join('')||'<p>No new records yet.</p>'}</section>`;
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
  function registerRows(records) {
    const latest=new Map();
    for(const r of records){
      if(!['pat','lighting','extinguisher','equipment'].includes(r.kind))continue;
      const asset=r.kind==='lighting'?r.values.system:r.values.asset;
      if(!asset?.trim())continue;
      const key=JSON.stringify([r.values.property,r.kind,asset.trim().toLowerCase()]);
      const old=latest.get(key);
      if(!old||(r.values.date+r.updated).localeCompare(old.values.date+old.updated)>0)latest.set(key,r);
    }
    return [...latest.values()].sort((a,b)=>a.values.property.localeCompare(b.values.property)||a.kind.localeCompare(b.kind)||(a.values.asset||a.values.system).localeCompare(b.values.asset||b.values.system));
  }
  function equipmentRegister() {
    const rows=registerRows(list());
    return `<section class="panel"><h2>Property equipment registers</h2><p>Latest dated saved record per property, record type and asset reference. Lighting references may describe a circuit or group; confirm individual fittings in the saved results. Missing assets are not inferred.</p><div class="main-actions"><button data-tab="PAT Testing">Add PAT appliance</button><button data-tab="Emergency Lighting">Add lighting record</button><button data-tab="Extinguishers">Add extinguisher</button><button data-tab="Equipment Library">Add equipment reference</button></div>${rows.map(r=>`<article class="main-record"><h3>${safe(r.values.asset||r.values.system)} · ${safe(propertyName(r.values.property))}</h3><p>${safe(names[r.kind])} · ${safe(r.values.location||'Location not recorded')}<br>${safe(r.values.date)} · ${safe(r.values.outcome||'See saved scope and results')}<br>Next: ${safe(r.values.next||'Not recorded')}</p><button data-main-edit="${safe(r.id)}">Review asset record</button><button data-main-word="${safe(r.id)}">Editable Word draft</button></article>`).join('')||'<p>No saved asset references. Add an appliance, fitting, extinguisher or equipment reference.</p>'}</section>`;
  }
  function historyPage() {
    return `<section class="panel"><h2>Property history</h2><label>Property<select id="main-history-property"><option value="">Select property…</option>${properties().map(p=>`<option value="${safe(p.id)}">${safe(p.name)}</option>`).join('')}</select></label><div id="main-history"></div></section>`;
  }
  function showHistory(id) {
    const target=document.getElementById('main-history');if(!target)return;
    let html=list().filter(r=>r.values.property===id).map(recordCard).join('');
    const legacy=['services','pat','lighting','quotes','jobs'].flatMap(kind=>(db[kind]||[]).filter(r=>r.property===id).map(r=>({kind,values:r})));
    html+=`<h3>Existing prototype records (${legacy.length})</h3><p>Original device records are preserved and have no new approval or certification status.</p>`+legacy.map(r=>`<article class="main-record"><b>${safe(r.kind)}</b>${Object.entries(r.values).map(([k,v])=>`<p>${safe(k)}: ${safe(typeof v==='object'?JSON.stringify(v):v)}</p>`).join('')}</article>`).join('');
    target.innerHTML=html||'<p>No history recorded.</p>';
  }
  function scheduleSummary() {
    const t=today();
    const dateAt=day=>new Date(day+'T12:00:00Z');
    const daysUntil=day=>Math.round((dateAt(day)-dateAt(t))/86400000);
    const visits=list('visit').filter(r=>!['Completed','Cancelled'].includes(r.values.status)).sort((a,b)=>(a.values.date+a.values.time).localeCompare(b.values.date+b.values.time));
    const follow=list().filter(r=>r.values.next&&daysUntil(r.values.next)<=30).sort((a,b)=>a.values.next.localeCompare(b.values.next));
    const followLabel=day=>{const n=daysUntil(day);return n<0?'Overdue by '+(-n)+' day(s)':n===0?'Due today':n<=7?'Due within 7 days':'Due within 30 days'};
    return `<section class="panel"><h2>Service reminders</h2><p>On-screen 30-day and 7-day reminders only. No unattended email, SMS or background delivery is configured.</p>${visits.map(r=>`<p><b>${r.values.date<t?'Overdue':'Upcoming'}</b> ${safe(r.values.date)} ${safe(r.values.time)} · ${safe(propertyName(r.values.property))} · ${safe(r.values.engineer)}</p>`).join('')||'<p>No active visits.</p>'}${follow.map(r=>`<p><b>${safe(followLabel(r.values.next))}</b> · ${safe(r.values.next)} · ${safe(names[r.kind])} · ${safe(propertyName(r.values.property))}</p>`).join('')||'<p>No follow-ups due within 30 days.</p>'}</section>`;
  }
  function reminderRows(records, reference=today()) {
    if(!validDate(reference))throw Error('Invalid reminder date.');
    const day=value=>Date.parse(value+'T12:00:00Z')/86400000;
    return records.filter(r=>validDate(r.values.next||'')).map(r=>({record:r,days:day(r.values.next)-day(reference)})).filter(r=>r.days<=30).sort((a,b)=>a.days-b.days||a.record.id.localeCompare(b.record.id));
  }
  function plannerGroups(records, sites=properties()) {
    const groups=new Map();
    for(const r of records.filter(r=>r.kind==='visit'&&!['Completed','Cancelled'].includes(r.values.status))){
      const site=sites.find(p=>p.id===r.values.property),area=String(site?.postcode||'').trim().toUpperCase().split(/\s+/)[0]||'Unassigned';
      const key=r.values.date+'|'+area;
      if(!groups.has(key))groups.set(key,{date:r.values.date,area,minutes:0,visits:[]});
      const g=groups.get(key);g.minutes+=Number(r.values.minutes);g.visits.push(r);
    }
    return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.area.localeCompare(b.area)).map(g=>({...g,visits:g.visits.sort((a,b)=>a.values.time.localeCompare(b.values.time)||a.values.engineer.localeCompare(b.values.engineer))}));
  }
  function plannerBoard() {
    return '<section class="panel"><h2>Visits by date and postcode district</h2><p>Grouped for planning; allow travel time separately. This view does not calculate routes or travel times.</p>'+plannerGroups(list('visit')).map(g=>`<article class="main-plan-group"><h3>${safe(g.date)} · ${safe(g.area)}</h3><p>${g.visits.length} visits · ${g.minutes} minutes on site</p>${g.visits.map(r=>`<p>${safe(r.values.time)} · ${safe(propertyName(r.values.property))} · ${safe(r.values.engineer)} · ${safe(r.values.serviceType)}</p><button type="button" data-main-pack="${safe(r.id)}">Engineer job pack</button>`).join('')}</article>`).join('')+'</section>';
  }
  function dashboard() {
    const visits=list('visit').filter(r=>r.values.date===today()&&!['Cancelled','Completed'].includes(r.values.status)).sort((a,b)=>a.values.time.localeCompare(b.values.time));
    const reminders=reminderRows(list()),urgent=reminders.filter(r=>r.days<=7).length;
    const cards=[['Properties',properties().length,'Properties'],["Today's visits",visits.length,'Planner'],['Due in 7 days / overdue',urgent,'Planner'],['Draft invoices',list('invoice').length,'Invoices']];
    return `<div class="main-app main-dashboard"><section class="main-hero home-hero"><p>PARAMOUNT FIRE PROTECTION</p><h2>Your working day</h2><p>${safe(today())} · Properties, testing and office work in one place</p><div class="main-actions"><button data-tab="Service Records">Start fire alarm service</button><button data-tab="PAT Testing">Quick PAT entry</button></div></section><div class="main-stats">${cards.map(([label,n,target])=>`<button data-tab="${target}"><strong>${n}</strong><span>${label}</span></button>`).join('')}</div><section class="panel"><h2>Today's engineer visits</h2>${visits.map(r=>`<article class="main-record"><h3>${safe(r.values.time)} · ${safe(propertyName(r.values.property))}</h3><p>${safe(r.values.engineer)} · ${safe(r.values.serviceType)} · ${safe(r.values.minutes)} minutes</p><button data-main-pack="${safe(r.id)}">Open job pack</button></article>`).join('')||'<p>No active visits today. Add a visit in the planner.</p>'}</section><section class="panel home-management"><h2>Workspaces</h2><div class="main-actions">${['Properties','Service Records','PAT Testing','Emergency Lighting','Extinguishers','Quotes','Invoices','Planner','Property History','Equipment Registers','Equipment Library'].map(t=>`<button data-tab="${t}">${t}</button>`).join('')}<a href="#academy">Paramount Academy</a></div></section>${officeSummary()}${banner()}</div>`;
  }
  function jobPack(r) {
    const p=property(r.values.property),rows=list().filter(x=>x.values.property===r.values.property&&x.kind!=='visit');
    return `<p><b>DRAFT ENGINEER JOB PACK</b> · Generated ${safe(now())}</p><h3>${safe(p?.name||'Property unavailable')}</h3><p>${safe(p?.address||'')} ${safe(p?.postcode||'')}</p><p>Contact: ${safe(p?.contact||'Not recorded')} · ${safe(p?.phone||'')}</p><h3>Visit arrangements</h3>${detail(r)}<h3>Saved site records</h3><p>Current saved revisions only. Confirm scope and conditions on site. No test results are inferred.</p>${rows.map(x=>`<section><h3>${safe(names[x.kind])} · ${safe(x.values.date)} · revision ${x.revision}</h3>${detail(x)}</section>`).join('')||'<p>No saved site records.</p>'}`;
  }
  function officeSummary() {
    return `<section class="panel"><h2>Office dashboard</h2><p>${list('enquiry').filter(r=>r.values.status!=='Closed').length} open enquiries · ${list('callout').filter(r=>r.values.status!=='Closed after verification').length} open call-outs / defects · ${list('quote').length} draft quotes · ${list('invoice').length} draft invoices</p><p>Follow-ups and engineer visits appear below. Public enquiry submission and automatic messages are not configured.</p><div class="main-actions"><button data-tab="Call-outs">Call-outs</button><button data-tab="Quotes">Quotes</button><button data-tab="Invoices">Invoices</button><button data-tab="Planner">Planner</button></div></section>`+scheduleSummary();
  }
  function backupPage(){return `<section class="panel"><h2>Record backup and cloud snapshots</h2><p>Export includes this account’s new records, revisions and unfinished forms. Existing device records have a separate backup. Neither export includes authentication tokens.</p><div class="main-actions"><button data-main-export>Download workspace JSON</button><button data-backup>Download existing device records</button><button data-main-raw>Download raw workspace (recovery)</button></div><label>Restore workspace JSON (merge only; conflicting records are rejected)<input type="file" id="main-import" accept="application/json,.json"></label><h3>Supabase snapshots — optional, manual</h3><p>Requires an owner-reviewed main_app_snapshots table and RLS policies. No setup runs automatically. Upload saves an immutable snapshot; it never replaces cloud properties or other snapshots. Automatic syncing and team sharing are not enabled.</p><div class="main-actions"><button data-main-upload>Upload reviewed workspace snapshot</button><button data-main-cloud-list>List my cloud snapshots</button></div><div id="main-cloud-list"></div></section>`}
  // Local property directory uses the existing device database; no cloud writes.
  const siteDetails = p => Object.fromEntries(['id','name','address','postcode','panel','contact','phone','email'].map(k=>[k,String(p?.[k]||'')]));
  function propertyDirectory() {
    propertyEditing=null;
    return `<section class="panel"><h2>${team()?'Property database — isolated team workspace':'Property database — this device'}</h2><p>${team()?'Test staff workspace. New properties receive shared UUIDs; original local properties are never uploaded automatically.':'Shared on this device, including across sign-ins. Existing service records are retained. Cloud Properties remains a separate test area.'}</p><label>Search name, address, postcode or panel<input id="main-property-search" type="search"></label><div id="main-properties"></div></section><section class="panel"><h2 id="main-property-heading">Add property</h2><form id="main-property-form" data-scope="${safe(scope())}"><div class="main-grid">${input('Property name','name')}${input('Address','address','text',false)}${input('Postcode','postcode','text',false)}${input('Panel make / model','panel')}${input('Contact name','contact','text',false)}${input('Phone','phone','tel',false)}${input('Email','email','email',false)}${input('Last service date','last','date')}${input('Service interval (months, 1–60)','months','number',true,'6')}</div><div class="main-actions"><button type="submit">Save property</button><button type="reset">Start new property</button><button type="button" data-tab="Property History">Open property history</button></div></form></section>`;
  }
  function showProperties(query) {
    const target=document.getElementById('main-properties');if(!target)return;
    const q=query.trim().toLowerCase();
    const rows=properties().filter(p=>['name','address','postcode','panel','contact'].some(k=>String(p[k]||'').toLowerCase().includes(q)));
    target.innerHTML=`<p>${rows.length} of ${properties().length} properties</p>`+rows.map(p=>`<article class="main-record"><h3>${safe(p.name)}</h3><p>${safe(p.address||'')} ${safe(p.postcode||'')}<br>${safe(p.panel)}<br>Last service: ${safe(p.last)} · interval ${safe(p.months)} months</p><button type="button" data-main-property-edit="${safe(p.id)}">Edit property</button></article>`).join('');
  }
  function saveProperty(values,expected) {
    for(const k of ['name','panel','last','months'])if(!String(values[k]||'').trim())throw Error('Complete '+k+' before saving the property.');
    if(!validDate(values.last)||!/^\d+$/.test(values.months)||Number(values.months)<1||Number(values.months)>60)throw Error('Enter a real last service date and interval from 1 to 60 months.');
    for(const v of Object.values(values))if(typeof v!=='string'||v.length>2000)throw Error('Property fields must be text of at most 2000 characters.');
    if(team())return team().saveProperty(values,expected);
    const raw=localStorage.getItem(key);
    const fresh=raw?JSON.parse(raw):JSON.parse(JSON.stringify(db));
    if(!Array.isArray(fresh.properties))throw Error('Device database is unreadable; it has not been replaced.');
    const old=expected?fresh.properties.find(p=>p.id===expected.id):null;
    if(expected&&(!old||JSON.stringify(old)!==JSON.stringify(expected)))throw Error('Property changed in another tab. Reopen it before saving.');
    const saved={...old,...values,id:old?.id||'P-'+uid()};
    if(old)fresh.properties[fresh.properties.indexOf(old)]=saved;else fresh.properties.push(saved);
    localStorage.setItem(key,JSON.stringify(fresh));db=fresh;return saved;
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-main-property-edit]');if(!b)return;
    try{
      const fresh=team()?null:localStorage.getItem(key);if(fresh)db=JSON.parse(fresh);
      const p=property(b.dataset.mainPropertyEdit);if(!p)throw Error('Property no longer exists.');
      propertyEditing=JSON.parse(JSON.stringify(p));
      const form=document.getElementById('main-property-form');
      for(const el of form.elements)if(el.name)el.value=p[el.name]??'';
      document.getElementById('main-property-heading').textContent='Edit property: '+p.name;
      form.scrollIntoView({block:'start'});
    }catch(error){message(error.message)}
  });
  document.addEventListener('reset',e=>{if(e.target.id==='main-property-form'){propertyEditing=null;document.getElementById('main-property-heading').textContent='Add property'}});
  document.addEventListener('submit',e=>{
    if(e.target.id!=='main-property-form')return;e.preventDefault();
    try{if(e.target.dataset.scope!==scope())throw Error('Account changed. Reopen Properties before saving.');const p=saveProperty(fields(e.target),propertyEditing);render();message('Property saved on this device: '+p.name)}catch(error){message('Property not saved: '+error.message)}
  });
  const fieldLabels={date:'Record date',engineer:'Engineer / tester',system:'System / fitting reference',standard:'Agreed scope / standard edition',tests:'Tests performed and actual results',battery:'Battery inspection',batteryVoltage:'Battery voltage (V)',batteryAh:'Battery capacity (Ah)',measurements:'Measurements / instrument / calibration',defects:'Defects / limitations / inaccessible areas',actions:'Actions / advice / handover',next:'Next agreed test / service date',recipient:'Responsible person / handover recipient',declaration:'Engineer declaration within recorded scope',asset:'Appliance / asset ID',appliance:'Appliance type',location:'Location / circuit / asset IDs',equipmentClass:'Equipment class',instrument:'Test instrument / serial',calibration:'Calibration reference / due date',visual:'Visual inspection',outcome:'Recorded outcome',testType:'Test scope',duration:'Actual observed duration (minutes)',restoration:'Supply restored / charging observations'};
  const signatureFields=['engineerSignature','engineerSigned','customerName','customerSignature','customerSigned'];
  function certificateLines(r) {
    if(!['service','pat','lighting'].includes(r.kind)||r.values.reviewed!=='yes')throw Error('Select a reviewed engineering draft.');
    const v=r.values,site=r.siteSnapshot||siteDetails(property(v.property));
    return [r.kind==='service'?'Fire alarm service certificate — DRAFT':names[r.kind]+' — DRAFT','Reference: '+r.id,'Revision: '+r.revision,'Saved: '+r.updated,'','SITE / CUSTOMER',...(!r.siteSnapshot?['Legacy record: current site details; no original site snapshot.']:['Site details recorded at first save:']),...Object.entries(site).filter(([k])=>k!=='id').map(([k,v])=>k+': '+v),'','SCOPE / OBSERVATIONS / RESULTS',...Object.entries(v).filter(([k])=>!['reviewed','property',...signatureFields].includes(k)).map(([k,v])=>(fieldLabels[k]||k)+': '+v),'','DRAFT SIGNATURE ACKNOWLEDGEMENTS','Engineer signature (typed): '+(v.engineerSignature||'________________________'),'Engineer signature date: '+(v.engineerSigned||'________________'),'Customer / responsible person: '+(v.customerName||v.recipient||'________________________'),'Customer signature (typed): '+(v.customerSignature||'________________________'),'Customer signature date: '+(v.customerSigned||'________________'),'Acknowledgement of this draft only; no approval or controlled issue.','Competent review of scope, results and approved certification is pending.'];
  }
  function documentLines(r) {
    if(!r||r.values.reviewed!=='yes')throw Error('Select a reviewed saved draft.');
    if(['service','pat','lighting'].includes(r.kind))return certificateLines(r);
    const lines=[names[r.kind]+' — DRAFT','Reference: '+r.id,'Revision: '+r.revision,'Saved: '+r.updated,'DRAFT — NOT ISSUED — NOT A COMPLIANCE CERTIFICATE'];
    const site=r.siteSnapshot||siteDetails(property(r.values.property));
    lines.push('',r.siteSnapshot?'Saved site details':'Current site details',...Object.entries(site).map(([k,v])=>k+': '+v));
    lines.push('',...Object.entries(r.values).filter(([k])=>!['property','reviewed'].includes(k)).map(([k,v])=>(fieldLabels[k]||k)+': '+v));
    if(['quote','invoice'].includes(r.kind)){const t=totals(r.values);lines.push('Subtotal: '+pounds(t.subtotal),'VAT: '+pounds(t.tax),'Total: '+pounds(t.total),'Verify company, VAT, payment and billing details before issue.')}
    return lines;
  }
  function wordDocument(r) {
    // Minimal OpenXML package with UTF-8 text. Stored ZIP entries need no external library.
    const xml=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const paragraph=(line,bold=false)=>'<w:p><w:r>'+(bold?'<w:rPr><w:b/><w:color w:val="12304B"/></w:rPr>':'')+'<w:t xml:space="preserve">'+xml(line)+'</w:t></w:r></w:p>';
    const files={
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/_rels/document.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="footer" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
      'word/footer1.xml':'<?xml version="1.0"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+paragraph('DRAFT — NOT ISSUED — NOT A COMPLIANCE CERTIFICATE',true)+'</w:ftr>',
      'word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'+paragraph('PARAMOUNT FIRE PROTECTION',true)+documentLines(r).flatMap(line=>String(line).split(/\r?\n/)).map((line,i)=>paragraph(line,i===0)).join('')+'<w:sectPr><w:footerReference w:type="default" r:id="footer"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="1100" w:left="900" w:footer="500"/></w:sectPr></w:body></w:document>'
    };
    const encoder=new TextEncoder(),parts=[],central=[];let offset=0;
    const header=(size)=>{const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)}};
    const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0};
    for(const [name,value] of Object.entries(files)){
      const n=encoder.encode(name),data=encoder.encode(value),sum=crc(data),h=header(30),v=h.view;
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);
      parts.push(h.bytes,n,data);
      const c=header(46),cv=c.view;cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,sum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);central.push(c.bytes,n);offset+=30+n.length+data.length;
    }
    const end=header(22),v=end.view,size=central.reduce((n,b)=>n+b.length,0),count=Object.keys(files).length;
    v.setUint32(0,0x06054b50,true);v.setUint16(8,count,true);v.setUint16(10,count,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
    const out=new Uint8Array(offset+size+22);let i=0;for(const b of [...parts,...central,end.bytes]){out.set(b,i);i+=b.length}return out;
  }
  function certificateHtml(r) {
    return '<section class="certificate"><h2>PARAMOUNT FIRE PROTECTION</h2>'+certificateLines(r).map((line,i)=>i===0?'<h3>'+safe(line)+'</h3>':'<p>'+safe(line).replace(/\n/g,'<br>')+'</p>').join('')+'</section>';
  }
  function servicePdf(r) {if(r.kind!=='service')throw Error('Select a reviewed service record.');return recordsPdf([r])}
  // Embedded TrueType font, explicit CID-to-glyph mapping and Unicode extraction map.
  // Every byte in the output is ASCII, so Blob UTF-8 encoding preserves xref offsets.
  function recordsPdf(records) {
    if(!records.length)throw Error('No saved records for this report.');
    const font=window.ParamountPdfFont;if(!font)throw Error('PDF font unavailable. Reload the app and retry.');
    const normal=text=>Array.from(String(text).replace(/\r\n?/g,'\n')).map(c=>c==='\n'||font.cmap[c.codePointAt(0)]?c:'[U+'+c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')+']').join('');
    const wrap=line=>normal(line).split('\n').flatMap(part=>{let chars=Array.from(part),out=[];while(chars.length>86){let n=chars.slice(0,86).lastIndexOf(' ');if(n<1)n=86;out.push(chars.slice(0,n).join(''));chars=chars.slice(n);if(chars[0]===' ')chars.shift()}return [...out,chars.join('')]});
    const pages=[];
    for(const r of records){const lines=documentLines(r).flatMap(wrap);for(let i=0;i<lines.length;i+=43)pages.push({r,lines:lines.slice(i,i+43)})}
    const glyphs=new Map();
    const hex4=n=>n.toString(16).padStart(4,'0');
    const unicode=c=>Array.from(c).map(ch=>{const n=ch.codePointAt(0);return n<=65535?hex4(n):hex4(0xd800+((n-65536)>>10))+hex4(0xdc00+((n-65536)&1023))}).join('');
    const encode=text=>'<'+Array.from(normal(text)).map(c=>{if(!glyphs.has(c))glyphs.set(c,glyphs.size+1);return hex4(glyphs.get(c))}).join('')+'>';
    const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type0 /BaseFont /DejaVuSansMono /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 8 0 R >>','<< /Type /Font /Subtype /CIDFontType2 /BaseFont /DejaVuSansMono /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 5 0 R /DW 602 /CIDToGIDMap 7 0 R >>','<< /Type /FontDescriptor /FontName /DejaVuSansMono /Flags 33 /FontBBox [-559 -375 718 1028] /ItalicAngle 0 /Ascent 928 /Descent -236 /CapHeight 729 /StemV 80 /FontFile2 6 0 R >>','','',''];
    const stream=s=>'<< /Length '+s.length+' >>\nstream\n'+s+'\nendstream';
    const kids=[];
    pages.forEach(({r,lines},i)=>{
      const pageId=objects.length,streamId=pageId+1;kids.push(pageId+' 0 R');
      const text=(s,size,x,y)=>`BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm ${encode(s)} Tj ET\n`;
      let content='0.06 0.17 0.28 rg 0 752 595 90 re f\n0.07 0.59 0.82 rg 0 748 595 4 re f\n1 1 1 rg\n'+text('PARAMOUNT FIRE PROTECTION',17,36,805)+text('FIELD SERVICE  /  '+(r.kind==='service'?'FIRE ALARM':r.kind==='pat'?'PAT TESTING':r.kind==='lighting'?'EMERGENCY LIGHTING':names[r.kind].toUpperCase()),10,36,780)+'0.06 0.17 0.28 rg\n';
      lines.forEach((l,j)=>{content+=text(l,10,36,724-j*13)});
      content+='0.07 0.59 0.82 RG 36 100 m 559 100 l S\n0.55 0.1 0.12 rg\n'+text('DRAFT - NOT ISSUED - NOT A COMPLIANCE CERTIFICATE',9,36,81)+text('Pending competent review. Signatures acknowledge this draft only.',8,36,65)+'0.06 0.17 0.28 rg\n'+text('Page '+(i+1)+' of '+pages.length+' | Revision: '+r.revision,8,36,45);
      objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>',stream(content));
    });
    const fontStream=font.hex+'>';objects[6]='<< /Length '+fontStream.length+' /Length1 '+font.hex.length/2+' /Filter /ASCIIHexDecode >>\nstream\n'+fontStream+'\nendstream';
    const gid='0000'+Array.from(glyphs.keys()).map(c=>hex4(font.cmap[c.codePointAt(0)])).join('')+'>';
    objects[7]='<< /Length '+gid.length+' /Filter /ASCIIHexDecode >>\nstream\n'+gid+'\nendstream';
    const entries=Array.from(glyphs,([c,id])=>'<'+hex4(id)+'> <'+unicode(c)+'>');
    let cmap='/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /ParamountUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
    for(let i=0;i<entries.length;i+=100){const chunk=entries.slice(i,i+100);cmap+=chunk.length+' beginbfchar\n'+chunk.join('\n')+'\nendbfchar\n'}
    cmap+='endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';objects[8]=stream(cmap);
    objects[2]='<< /Type /Pages /Count '+pages.length+' /Kids ['+kids.join(' ')+'] >>';
    let pdf='%PDF-1.4\n',offsets=[0];
    for(let i=1;i<objects.length;i++){offsets.push(pdf.length);pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n'}
    const start=pdf.length;pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';return pdf;
  }
  const originalRender=render;
  render=function(){
    remember();load();stopSpeech();originalRender();
    const kind=pages[tab],view=document.getElementById('view');
    if(tab==='Dashboard'){
      view.innerHTML=dashboard();return;
    }
    if(kind){const legacy=['Service Records','Quotes','Planner'].includes(tab)?`<details class="panel"><summary>Preserved prototype ${safe(tab)} — existing records</summary><div id="main-legacy"></div></details>`:'';const old=view.innerHTML;view.innerHTML=`<div class="main-app">${banner()}${tab==='Office'?officeSummary():''}${tab==='Planner'?plannerBoard()+scheduleSummary():''}${workspace(kind)}${legacy}</div>`;const el=document.getElementById('main-legacy');if(el){el.innerHTML=old;el.querySelectorAll('form').forEach(f=>f.remove());if(tab==='Planner'){el.querySelectorAll('[data-plan-filter]').forEach(b=>b.remove())}}restore();}
    else if(tab==='Equipment Registers')view.innerHTML=`<div class="main-app">${banner()}${equipmentRegister()}</div>`;
    else if(tab==='Property History'||tab==='Record Backup')view.innerHTML=`<div class="main-app">${banner()}${tab==='Property History'?historyPage():backupPage()}</div>`;
    else if(tab==='Properties'){view.innerHTML=`<div class="main-app">${banner()}${propertyDirectory()}</div>`;showProperties('');}
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
  document.addEventListener('input',e=>{if(e.target.id==='main-property-search')showProperties(e.target.value);const form=e.target.closest('form[data-main-form]');if(!form)return;if(form.dataset.mainScope!==scope()){message('Account changed. Reload before editing.');return}load();if(e.target.name!=='reviewed')form.elements.namedItem('reviewed').checked=false;remember();updatePreview(form)});
  document.addEventListener('submit',e=>{const form=e.target.closest('form[data-main-form]');if(!form)return;e.preventDefault();stopSpeech();if(form.dataset.mainScope!==scope()){message('Account changed. Reload this form before saving.');return}load();try{const r=saveRecord(form.dataset.mainForm,fields(form));const continuing=e.submitter?.name==='continueAppliance'&&r.revision===1;
      if(continuing){const v=r.values;commit(s=>s.drafts.pat={values:Object.fromEntries(['property','date','engineer','instrument','calibration','location','next'].map(k=>[k,v[k]||'']).concat([['asset',nextAsset(v.asset)],['reviewed','']])),editing:null,updated:now()})}
      form.removeAttribute('data-main-form');render();message('Draft saved on this device. Review / PDF preview is available below. Reference: '+r.id)}catch(error){message('Not saved: '+error.message)}});
  document.addEventListener('change',async e=>{
    if(e.target.id==='main-history-property')showHistory(e.target.value);
    if(e.target.id==='main-import'&&e.target.files?.[0])try{if(e.target.files[0].size>10000000)throw Error('Backup exceeds 10 MB.');const data=JSON.parse(await e.target.files[0].text());if(!confirm('Merge this backup into the current workspace? Existing records and forms will not be overwritten.'))return;merge(data);render();message('Backup merged. Existing drafts were retained.')}catch(error){message('Import rejected: '+error.message)}
  });
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-main-appliance],[data-main-report],[data-main-edit],[data-main-pdf],[data-main-print],[data-main-clear],[data-main-convert],[data-main-job-quote],[data-main-job-invoice],[data-main-word],[data-main-pack],[data-main-export],[data-main-raw],[data-main-upload],[data-main-cloud-list],[data-main-cloud-download],[data-main-dictate],[data-main-stop]');if(!b)return;
    load();try{
      if(b.dataset.mainAppliance){const form=document.querySelector('form[data-main-form="pat"]');if(!form||form.dataset.mainScope!==scope())throw Error('Reload this form before editing.');form.elements.appliance.value=b.dataset.mainAppliance;form.elements.appliance.dispatchEvent(new Event('input',{bubbles:true}));form.elements.asset.focus();}
      else if(b.dataset.mainReport){const form=document.querySelector('form[data-main-form]');const site=form?.elements.property.value;if(!site)throw Error('Select a property for the site report.');const rows=list(b.dataset.mainReport).filter(r=>r.values.property===site);if(!rows.length)throw Error('No saved records for this property.');download('paramount-'+b.dataset.mainReport+'-register-DRAFT.pdf',recordsPdf(rows),'application/pdf')}
      else if(b.dataset.mainEdit){const r=record(b.dataset.mainEdit);if(!r)return;remember();const existing=state.drafts[r.kind];if(existing&&Object.values(existing.values).some(Boolean)&&!confirm('Replace the unfinished form with this saved record?'))return;commit(s=>s.drafts[r.kind]={values:{...r.values,reviewed:''},editing:{id:r.id,revision:r.revision},updated:now()});document.querySelector('form[data-main-form]')?.removeAttribute('data-main-form');tab=Object.keys(pages).find(k=>pages[k]===r.kind);render();document.querySelector('form[data-main-form]')?.scrollIntoView({block:'start'});}
      else if(b.dataset.mainPdf){const r=record(b.dataset.mainPdf);if(!r)throw Error('Select a saved record.');download('paramount-'+r.kind+'-'+r.id+'-r'+r.revision+'-DRAFT.pdf',recordsPdf([r]),'application/pdf')}
      else if(b.dataset.mainPrint)preview(b.dataset.mainPrint);
      else if(b.dataset.mainClear){if(!confirm('Clear this unfinished form? Saved records are kept.'))return;commit(s=>delete s.drafts[b.dataset.mainClear]);document.querySelector('form[data-main-form]')?.removeAttribute('data-main-form');render()}
      else if(b.dataset.mainConvert){const r=record(b.dataset.mainConvert);if(!r)return;remember();if(state.drafts.invoice&&!confirm('Replace the unfinished invoice form? Saved invoices are kept.'))return;commit(s=>s.drafts.invoice={values:{...r.values,number:'',source:r.values.number,date:today(),due:'',reviewed:''},editing:null,updated:now()});document.querySelector('form[data-main-form]')?.removeAttribute('data-main-form');tab='Invoices';render()}
      else if(b.dataset.mainWord){const r=record(b.dataset.mainWord);if(!r)throw Error('Record unavailable.');download('paramount-'+r.kind+'-'+r.id+'-r'+r.revision+'-DRAFT.docx',wordDocument(r),'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
      else if(b.dataset.mainPack){const r=record(b.dataset.mainPack);if(!r||r.kind!=='visit')throw Error('Select a saved visit.');printDocument('Engineer job pack — DRAFT',jobPack(r))}
      else if(b.dataset.mainJobQuote||b.dataset.mainJobInvoice){
        const r=record(b.dataset.mainJobQuote||b.dataset.mainJobInvoice),target=b.dataset.mainJobInvoice?'invoice':'quote';
        if(!r || !['service','pat','lighting','callout','installation','extinguisher'].includes(r.kind))throw Error('Only saved engineering jobs can prepare quotations.');
        remember();
        if(state.drafts[target] && Object.values(state.drafts[target].values||{}).some(Boolean) && !confirm('Replace the unfinished '+names[target]+' form? Saved documents are kept.'))return;
        const reference=r.values.number||r.values.asset||r.id;
        const summary=[r.values.issue,r.values.defects,r.values.actions].filter(Boolean).join(' / ').slice(0,1500);
        commit(s=>{s.drafts[target]={values:{property:r.values.property,date:today(),number:'',customer:'',address:'',due:'',lines:'',vat:'0',vatNumber:'',source:reference,terms:summary?'Job observations (verify before quoting): '+summary:'',reviewed:''},editing:null,updated:now()}});
        document.querySelector('form[data-main-form]')?.removeAttribute('data-main-form');
        tab=target==='invoice'?'Invoices':'Quotes';render();
        message(names[target]+' draft prepared from saved job. Enter billing details, agreed scope, quantities and prices; nothing has been issued.');
        document.querySelector('form[data-main-form]')?.scrollIntoView({block:'start'});
      }
      else if(b.hasAttribute('data-main-export'))download('paramount-workspace-backup.json',JSON.stringify(exportData(),null,2));
      else if(b.hasAttribute('data-main-raw'))download('paramount-workspace-raw.txt',team()?team().raw():localStorage.getItem(storageKey())||'');
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
  window.ParamountMainApp={servicePdf,totals,wordDocument,registerRows,reminderRows,plannerGroups,jobPack,documentLines,refresh:()=>{if(team())state=read()},reload:()=>{state=null;render()},recordsPdf,nextAsset,parseMoney,rectangles,validDate,overlaps,validate,version:VERSION};
  render();
})();




