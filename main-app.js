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
  // Explicit allowlist: evidence is never a reusable template.
  const reusable = {
    service:['property','system','standard','batteryAh','panelSerial','zones','batteryModel','batteryCount','equipment'],
    pat:['property','asset','appliance','location','equipmentClass','equipment'],
    lighting:['property','system','location','equipment','ratedDuration'],
    extinguisher:['property','asset','location','model','capacity','manufactured','equipment'],
    installation:['property','stage','system','standard','drawingRef','devices','equipment'],
    callout:['property','equipment']
  };
  function equipmentRows(value) {
    if(!value)return [];
    const rows=JSON.parse(value);
    if(!Array.isArray(rows)||rows.length>1000)throw Error('Use at most 1000 equipment rows.');
    const ids=new Set();
    for(const row of rows){
      if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid equipment row.');
      for(const date of ['lastTest','next'])if(row[date]&&!validDate(row[date]))throw Error('Enter a valid asset '+date+' date.');
      for(const [k,v] of Object.entries(row))if(!['id','description','location','specification','result','readings','defects','actions','duration','zone','address','deviceType','serial','model','capacity','manufactured','lastTest','next'].includes(k)||typeof v!=='string'||v.length>2000)throw Error('Invalid equipment field.');
      if(!row.id?.trim()||ids.has(row.id.trim().toLowerCase()))throw Error('Every appliance / fitting needs a unique identifier.');
      ids.add(row.id.trim().toLowerCase());
      if(!['Pass','Fail','Not Tested'].includes(row.result))throw Error('Choose Pass, Fail or Not Tested for every row.');
      if(row.duration&&(!/^\d+(?:\.\d{1,2})?$/.test(row.duration)||Number(row.duration)>1440))throw Error('Actual duration must be 0–1440 minutes.');
    }
    return rows;
  }
  function repeatValues(source) {
    if(!reusable[source.kind]||source.values.serviceStatus!=='Completed')throw Error('No completed service of this type. Review the previous record and explicitly mark completed first.');
    const values=Object.fromEntries(reusable[source.kind].filter(k=>k!=='equipment'&&source.values[k]!==undefined).map(k=>[k,source.values[k]]));
    const register=equipmentRows(source.values.equipment);
    if(!register.length&&['pat','lighting','extinguisher'].includes(source.kind)){const v=source.values,id=source.kind==='lighting'?v.system:v.asset;if(id)register.push({id,description:source.kind==='pat'?v.appliance:source.kind==='extinguisher'?v.model:v.system,location:v.location||'',specification:v.equipmentClass||'',model:v.model||'',capacity:v.capacity||'',manufactured:v.manufactured||''})}
    const rows=register.map(r=>({...Object.fromEntries(['id','description','location','specification','zone','address','deviceType','serial','model','capacity','manufactured'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]||''])),result:'Not Tested',readings:'',defects:'',actions:'',duration:''}));
    if(rows.length)values.equipment=JSON.stringify(rows);
    return {...values,date:today(),serviceStatus:'In progress',testState:'Not Tested',reviewed:'',repeatSource:source.id};
  }
  function latestCompleted(records,kind,site) {
    return records.filter(r=>r.kind===kind&&r.values.property===site&&r.values.serviceStatus==='Completed').sort((a,b)=>b.values.date.localeCompare(a.values.date)||b.updated.localeCompare(a.updated)||b.id.localeCompare(a.id))[0];
  }
  function repeatServiceValues(records,kind,site) {
    const source=latestCompleted(records,kind,site);
    if(!source)throw Error('No completed service of this type for this property.');
    const values=repeatValues(source);
    // A batch is an explicit inventory snapshot: never resurrect its removed assets.
    if(!['pat','lighting','extinguisher'].includes(kind)||equipmentRows(source.values.equipment).length)return values;
    const sources=records.filter(r=>r.kind===kind&&r.values.property===site&&r.values.serviceStatus==='Completed'&&r.values.date===source.values.date)
      .sort((a,b)=>b.updated.localeCompare(a.updated)||b.id.localeCompare(a.id));
    const rows=new Map(),used=[];
    for(const r of sources){
      let added=false;
      for(const row of equipmentRows(repeatValues(r).equipment)){
        const key=row.id.trim().toLowerCase();
        if(!rows.has(key)){rows.set(key,row);added=true}
      }
      if(added)used.push(r.id);
      if(equipmentRows(r.values.equipment).length)break;
    }
    if(rows.size){values.equipment=JSON.stringify([...rows.values()]);values.repeatSource=used.join(', ')}
    equipmentRows(values.equipment); // Validate the combined size before writing any draft.
    return values;
  }
  function preparedServices(site) {
    const rows=Object.entries(state.drafts).filter(([kind,d])=>reusable[kind]&&d.values.property===site);
    return rows.length?'<section class="panel"><h3>Prepared services — '+safe(propertyName(site))+'</h3><p>Saved unfinished forms. Open each service to enter current results and review.</p><div class="main-actions">'+rows.map(([kind,d])=>'<button type="button" data-tab="'+safe(Object.keys(pages).find(p=>pages[p]===kind))+'">Resume '+safe(names[kind])+' · '+(d.values.equipment?JSON.parse(d.values.equipment).length:0)+' assets</button>').join('')+'</div></section>':'';
  }
  function prepareRepeat(kind,site,entire=false) {
    if(!property(site))throw Error('Select a property first.');
    const targets=(entire?Object.keys(reusable):[kind]).map(k=>latestCompleted(state.records,k,site)).filter(Boolean);
    if(!targets.length)throw Error('No completed service found. Existing reviewed drafts are not assumed completed.');
    const prepared=targets.map(source=>({kind:source.kind,values:repeatServiceValues(state.records,source.kind,site)}));
    remember();
    if(targets.some(r=>state.drafts[r.kind])&&!confirm('Replace unfinished forms for the selected service types? Saved records and certificates are retained.'))return;
    commit(s=>{for(const source of prepared)s.drafts[source.kind]={values:source.values,editing:null,updated:now()}});
    document.querySelector('form[data-main-form]')?.removeAttribute('data-main-form');render();
    message('Prepared '+targets.map(r=>names[r.kind]).join(', ')+'. New results are Not Tested. Open each section to complete and save.');
  }
  const rowColumns=['id','description','location','specification','result','readings','duration','defects','actions','zone','address','deviceType','serial','model','capacity','manufactured','lastTest','next'];
  const editorColumns=kind=>kind==='service'?['id','zone','address','deviceType','location','specification','result','readings','defects','actions']:kind==='extinguisher'?['id','serial','location','model','capacity','manufactured','lastTest','result','readings','defects','actions','next']:['id','description','location','specification','result','readings',...(kind==='lighting'?['duration']:[]),'defects','actions'];
  function equipmentEditor(kind) {
    if(!['pat','lighting','extinguisher','service'].includes(kind))return '';
    return `<fieldset class="main-wide"><legend>${({pat:'Batch appliance checklist',lighting:'Fitting register',extinguisher:'Batch extinguisher servicing',service:'Structured fire alarm device list'})[kind]}</legend><p>One row per unique asset. Repeat uses the last completed register. All copied results start Not Tested. Enter actual readings, defects and actions for this visit.</p><input type="hidden" name="equipment"><div data-equipment-rows></div><button type="button" data-equipment-add>Add ${({pat:'appliance',lighting:'fitting',extinguisher:'extinguisher',service:'device'})[kind]}</button><button type="button" data-equipment-identical>Add identical item with a new ID</button>${['pat','extinguisher'].includes(kind)?'<button type="button" data-equipment-single>Use single-asset entry</button>':''}</fieldset>`;
  }
  function paintEquipment(form) {
    const target=form.querySelector('[data-equipment-rows]');if(!target)return;
    let rows;try{rows=JSON.parse(form.elements.equipment.value||'[]')}catch{rows=[]}
    target.innerHTML=rows.map((r,i)=>`<fieldset data-equipment-index="${i}"><legend>Asset ${i+1}</legend><div class="main-grid">${editorColumns(form.dataset.mainForm).map(k=>`<label>${safe(({id:'Unique ID',description:'Appliance / fitting',specification:'Class / stable specifications',duration:'Actual duration (minutes)',deviceType:'Device type',address:'Loop / address',zone:'Zone',serial:'Serial number',model:'Manufacturer / model',capacity:'Type / capacity',manufactured:'Manufacture date / year',lastTest:'Last extended service / test date',next:'Next agreed service date'})[k]||k)}${k==='result'?`<select data-equipment-field="${k}">${['Not Tested','Pass','Fail'].map(v=>`<option ${r[k]===v?'selected':''}>${v}</option>`).join('')}</select>`:`<input data-equipment-field="${k}" value="${safe(r[k]||'')}" ${k==='id'?'required':''}>`}</label>`).join('')}</div><div class="main-actions" role="group" aria-label="Result for asset ${i+1}">${['Not Tested','Pass','Fail'].map(result=>`<button type="button" data-equipment-result="${result}" aria-pressed="${r.result===result}">${result}</button>`).join('')}</div><button type="button" data-equipment-remove="${i}">Remove asset</button></fieldset>`).join('');
    // Batch records replace the single-asset inputs while retaining old record editing.
    if(['lighting','service'].includes(form.dataset.mainForm))form.elements.tests.required=!rows.length;
    if(['pat','extinguisher'].includes(form.dataset.mainForm))for(const k of (form.dataset.mainForm==='pat'?['asset','appliance','location','equipmentClass','visual','tests','outcome','defects']:['asset','location','model','capacity','manufactured','lastTest','tests','outcome','defects'])){const el=form.elements.namedItem(k);if(el){el.required=!rows.length&&!['manufactured','lastTest'].includes(k);el.closest('label').hidden=!!rows.length}}
  }
  function equipmentSummary(rows) {
    return rows.map(r=>rowColumns.filter(k=>r[k]!==undefined).map(k=>k+': '+(r[k]||'—')).join(' | ')).join('\n');
  }
  function nextAsset(asset) {return String(asset).replace(/(\d+)$/,n=>String(Number(n)+1).padStart(n.length,'0'))===asset?'':String(asset).replace(/(\d+)$/,n=>String(Number(n)+1).padStart(n.length,'0'))}
  function quickEntry() {return '<div class="main-wide"><h3>Appliance quick-entry</h3><p>Choose an appliance, enter its unique asset ID and actual test results, then save and continue. Test outcomes are never copied.</p><div class="main-actions">'+['Kettle','Toaster','Router','Washing machine','Fridge / freezer','Other'].map(a=>`<button type="button" data-main-appliance="${a}">${a}</button>`).join('')+'</div></div>'}
  function buildFields(kind) {
    const site = kind==='enquiry' ? (team()?prop():'')+input('Customer name','customer')+input('Email / phone','contact') : prop();
    const common=site+input(kind==='visit'?'Visit date':'Record date','date','date',true,today());
    switch(kind) {
      case 'service': return common+input('Engineer','engineer')+input('System / panel make, model and category','system')+input('Service scope / agreed standard and edition','standard')+input('Battery make / model','batteryModel','text',false)+input('Battery quantity','batteryCount','number',false)+input('Panel serial number','panelSerial','text',false)+area('Zone / device register: IDs, locations and stable specifications','zones')+area('Devices / zones tested and actual results (one per line)','tests',true)+select('Battery inspection','battery',['Satisfactory','Unsatisfactory','Not inspected','Not applicable'])+input('Battery voltage measured (V, optional)','batteryVoltage','number',false)+input('Battery rated capacity (Ah, optional)','batteryAh','number',false)+area('Measured values, instruments and calibration reference','measurements',true)+area('Defects / limitations / inaccessible areas','defects',true)+area('Actions and advice to responsible person','actions',true)+input('Next agreed service date','next','date',false)+input('Responsible person / handover recipient','recipient')+area('Engineer declaration / work completed within stated scope','declaration',true)+signatures()+review();
      case 'pat': return quickEntry()+common+input('Engineer / tester','engineer')+input('Test instrument / serial number','instrument')+input('Calibration reference / due date','calibration')+input('Appliance ID / asset number','asset')+select('Appliance type','appliance',['Kettle','Toaster','Router','Oven','Hob','Cooker hood','Washing machine','Tumble dryer','Dishwasher','Fridge / freezer','Other'])+input('Room / location','location')+select('Equipment class','equipmentClass',['Class I','Class II','Class III','Not determined'])+area('Visual inspection observations','visual',true)+area('Electrical tests performed, actual readings, limits and method','tests',true)+select('Recorded outcome','outcome',['Pass within recorded test scope','Fail / unsafe — action required','Not tested / inaccessible'])+area('Defects, labels, isolation and actions / advice','defects',true)+input('Next agreed test date','next','date',false)+signatures()+review();
      case 'lighting': return common+input('Engineer / tester','engineer')+input('System / fitting reference','system')+input('Location / circuit / asset IDs','location')+select('Test scope','testType',['Monthly functional test','Annual full-duration test','Routine functional test','Duration test','Visual inspection','Other agreed scope'])+input('Rated full duration (minutes)','ratedDuration','number',false)+input('Duration observed (minutes)','duration','number',false)+area('Fittings tested, method and actual results','tests',true)+area('Defects, inaccessible fittings and limitations','defects',true)+area('Remedial action / responsible person notified','actions',true)+select('Recorded outcome','outcome',['Satisfactory within recorded scope','Defective / action required','Not tested / inaccessible'],false)+input('Supply restored / charging indicator observations','restoration','text',false)+input('Responsible person notified','recipient','text',false)+input('Next agreed test date','next','date',false)+signatures()+review();
      case 'extinguisher': return common+input('Engineer','engineer')+input('Asset / serial number','asset')+input('Location','location')+input('Manufacturer / model','model')+input('Type and capacity','capacity')+input('Manufacture date / year','manufactured','text',false)+input('Last extended service / test date','lastTest','date',false)+select('Visit type','visitType',['Basic service','Extended service','Replacement','Inspection only'])+area('Checks performed and measured results','tests',true)+select('Recorded outcome','outcome',['Satisfactory within recorded scope','Defective / action required','Not serviced / inaccessible'])+area('Defects, limitations and action taken','defects',true)+input('Next agreed service date','next','date',false)+signatures()+review();
      case 'installation': return common+input('Engineer','engineer')+select('Form stage','stage',['Installation record','Commissioning record'])+input('System make / model / category','system')+input('Design / specification reference and standard edition','standard')+input('Drawing revision / cause-and-effect reference','drawingRef')+area('Installed devices, addresses / zones and locations','devices',true)+area('Inspection and test results, actual measurements','tests',true)+area('Variations, defects, exclusions and limitations','defects',true)+area('Handover documents, training and outstanding actions','actions',true)+input('Responsible person / recipient','recipient')+area('Engineer declaration limited to recorded scope','declaration',true)+signatures()+review();
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
    const equipment=equipmentRows(v.equipment);
    if(v.serviceStatus&&!['In progress','Completed'].includes(v.serviceStatus))throw Error('Invalid service progress.');
    if(v.serviceStatus==='Completed'&&['pat','lighting','extinguisher','service'].includes(kind)&&v.equipment&&!equipment.length)throw Error('Add equipment before completing this register.');
    if(kind==='lighting'&&['Annual full-duration test','Duration test'].includes(v.testType)&&equipment.some(r=>r.result!=='Not Tested'&&(!r.duration||Number(r.duration)<=0)))throw Error('Enter actual duration for each tested fitting.');
    if(equipment.some(r=>r.result==='Fail'&&!r.defects?.trim()))throw Error('Record a defect for every failed asset.');
    if(v.serviceStatus==='Completed'&&v.testState==='Not Tested')throw Error('Confirm current test progress before marking completed.');
    if(v.serviceStatus==='Completed'&&equipment.some(r=>r.result==='Not Tested'))throw Error('Resolve all Not Tested assets before marking completed.');
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
    const rows=equipmentRows(values.equipment);
    if(kind==='service'&&rows.some(r=>!r.zone?.trim()||!r.deviceType?.trim()||!r.location?.trim()))throw Error('Every fire device needs a zone, type and location.');
    if(kind==='service'){const addresses=rows.map(r=>r.address?.trim().toLowerCase()).filter(Boolean);if(new Set(addresses).size!==addresses.length)throw Error('Every addressed device needs a unique loop / address reference.');}
    if(kind==='extinguisher'&&rows.some(r=>!r.model?.trim()||!r.capacity?.trim()||!r.location?.trim()))throw Error('Every extinguisher needs a model, type / capacity and location.');

    if(kind==='pat'&&rows.length)values={...values,asset:'BATCH',appliance:'Appliance register',location:'See asset locations',equipmentClass:'See asset specifications',visual:'See asset observations',tests:equipmentSummary(rows),outcome:rows.some(r=>r.result==='Fail')?'Fail / unsafe — action required':rows.every(r=>r.result==='Pass')?'Pass within recorded test scope':'Not tested / inaccessible',defects:rows.map(r=>r.id+': '+(r.defects||'No defect entered')).join('\n')};
    if(kind==='lighting'&&rows.length)values={...values,tests:equipmentSummary(rows)};
    if(kind==='service'&&rows.length)values={...values,tests:equipmentSummary(rows)};
    if(kind==='extinguisher'&&rows.length)values={...values,asset:'BATCH',location:'See asset locations',model:'See asset models',capacity:'See asset types / capacities',tests:equipmentSummary(rows),outcome:rows.some(r=>r.result==='Fail')?'Defective / action required':rows.every(r=>r.result==='Pass')?'Satisfactory within recorded scope':'Not serviced / inaccessible',defects:rows.map(r=>r.id+': '+(r.defects||'No defect entered')).join('\n')};
    validate(kind,values);
    if(kind==='lighting' && values.duration && (!/^\d+(?:\.\d{1,2})?$/.test(values.duration)||Number(values.duration)>1440))throw Error('Lighting duration must be between 0 and 1440 minutes.');
    if(kind==='lighting'&&!rows.length&&['Duration test','Annual full-duration test'].includes(values.testType)&&(!values.duration||Number(values.duration)<=0))throw Error('Record the actual observed duration for a duration test.');
    let saved;
    commit(s=>{
      const old=editing?s.records.find(r=>r.id===editing.id):null;
      if(editing&&(!old||old.revision!==editing.revision))throw Error('This record changed in another tab. Reload and review the latest record before editing.');
      const candidate={id:old?.id||uid(),kind,values:{...values},revision:(old?.revision||0)+1,created:old?.created||now(),updated:now()};
      if(['service','pat','lighting','extinguisher','quote','invoice'].includes(kind))candidate.siteSnapshot=(old?.values.property===values.property?old.siteSnapshot:null)||siteDetails(property(values.property));
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
    let body=['service','pat','lighting','extinguisher','installation'].includes(r.kind)?certificateHtml(r):detail(r);
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
    return `${kind==='service'?'<p>Paramount fire alarm certificates remain DRAFT pending competent review. Optional engineer and customer signature acknowledgements do not issue a certificate.</p>':''}${kind==='equipment'?'<p>SmartCell: add the exact model and verified official manual below. No manufacturer procedures have been invented or bundled. Links open only after your choice.</p>':''}<section class="panel"><h2>${editing?'Edit':'New'} ${safe(names[kind])} — draft</h2><form data-main-form="${kind}" data-main-scope="${safe(scope())}"><div class="main-grid">${reusable[kind]?`<div class="main-actions main-wide"><button type="button" data-main-repeat="${kind}">Repeat Last Service</button><button type="button" data-main-repeat-visit="${kind}">Repeat Entire Property Visit</button></div>`:''}${buildFields(kind)}${equipmentEditor(kind)}${reusable[kind]?'<input type="hidden" name="repeatSource"><input type="hidden" name="legacySource">'+select('Test progress','testState',['Not Tested','Tested within recorded scope'],false):''}${reusable[kind]?select('Service progress','serviceStatus',['In progress','Completed'],false):''}</div><div class="main-actions"><button type="submit">Review and save draft</button><button type="button" data-main-clear="${kind}">Start new / clear draft</button>${kind==='pat'?'<button type="submit" name="continueAppliance" value="yes">Save draft &amp; next appliance</button>':''}${['pat','lighting','extinguisher'].includes(kind)?`<button type="button" data-main-report="${kind}">Download selected site ${kind==='pat'?'PAT register':kind==='extinguisher'?'extinguisher register':'lighting records'} PDF draft</button>`:''}</div><p>Unfinished forms save locally as you type. Dictation uses your browser’s speech service and may send audio to its provider; review every word before saving.</p><p id="dictation-status" role="status"></p><button type="button" data-main-stop>Stop dictation</button></form></section><section class="panel"><h2>Saved ${safe(names[kind])} records (${list(kind).length})</h2>${list(kind).map(recordCard).join('')||'<p>No new records yet.</p>'}</section>`;
  }
  function restore() {
    const form=document.querySelector('form[data-main-form]');if(!form)return;
    for(const [name,value]of Object.entries(draft)){const el=form.elements.namedItem(name);if(el){if(el.type==='checkbox')el.checked=value==='yes';else el.value=value}}
    if(['pat','extinguisher'].includes(form.dataset.mainForm)&&!editing&&!form.elements.equipment.value&&!draft.asset)form.elements.equipment.value=JSON.stringify([{id:'ASSET-'+uid().slice(0,8),description:'',location:'',specification:'',result:'Not Tested'}]);
    form.dataset.equipmentProperty=JSON.stringify(form.elements.property?.value||'');
    paintEquipment(form);
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
    for(const parent of records){
      if(!['pat','lighting','extinguisher','equipment'].includes(parent.kind))continue;
      const equipment=equipmentRows(parent.values.equipment);
      for(const r of (equipment.length?equipment.map(row=>({...parent,values:{...parent.values,asset:row.id,system:row.id,location:row.location,outcome:row.result,next:row.next||parent.values.next}})):[parent])){
      const asset=r.kind==='lighting'?r.values.system:r.values.asset;
      if(!asset?.trim())continue;
      const key=JSON.stringify([r.values.property,r.kind,asset.trim().toLowerCase()]);
      const old=latest.get(key);
      if(!old||(r.values.date+r.updated).localeCompare(old.values.date+old.updated)>0)latest.set(key,r);
      }
    }
    return [...latest.values()].sort((a,b)=>a.values.property.localeCompare(b.values.property)||a.kind.localeCompare(b.kind)||(a.values.asset||a.values.system).localeCompare(b.values.asset||b.values.system));
  }
  function equipmentRegister(site='') {
    const rows=registerRows(list().filter(r=>!site||r.values.property===site));
    return `<section class="panel"><h2>Property equipment registers</h2><p>Latest dated saved record per property, record type and asset reference. Lighting references may describe a circuit or group; confirm individual fittings in the saved results. Missing assets are not inferred.</p><div class="main-actions"><button data-tab="PAT Testing">Add PAT appliance</button><button data-tab="Emergency Lighting">Add lighting record</button><button data-tab="Extinguishers">Add extinguisher</button><button data-tab="Equipment Library">Add equipment reference</button></div>${rows.map(r=>`<article class="main-record"><h3>${safe(r.values.asset||r.values.system)} · ${safe(propertyName(r.values.property))}</h3><p>${safe(names[r.kind])} · ${safe(r.values.location||'Location not recorded')}<br>${safe(r.values.date)} · ${safe(r.values.outcome||'See saved scope and results')}<br>Next: ${safe(r.values.next||'Not recorded')}</p><button data-main-edit="${safe(r.id)}">Review asset record</button><button data-main-word="${safe(r.id)}">Editable Word draft</button></article>`).join('')||'<p>No saved asset references. Add an appliance, fitting, extinguisher or equipment reference.</p>'}</section>`;
  }
  function legacyHistory(id) {
    // Prototype storage is shared on this device. Never expose it inside account/team workspaces.
    if(team()||scope()!=='device-guest')return [];
    return ['services','pat','lighting','quotes','jobs'].flatMap(kind=>(db[kind]||[]).map((values,index)=>({kind,values,index})).filter(r=>r.values.property===id));
  }
  function legacyDraft(kind,index,site) {
    const source=legacyHistory(site).find(r=>r.kind===kind&&r.index===index);
    if(!source||!['services','pat','lighting'].includes(kind)||!property(site))throw Error('Legacy source unavailable in this workspace.');
    const v=source.values,target=kind==='services'?'service':kind;
    const values={property:site,date:today(),serviceStatus:'In progress',testState:'Not Tested',reviewed:'',legacySource:JSON.stringify({storage:'device prototype',kind,index,original:v})};
    if(target==='service')values.system=property(site).panel||'';
    if(target==='pat'){values.asset=v.asset||'';values.appliance=v.item||'';values.equipmentClass=['I','II','III'].includes(v.class)?'Class '+v.class:'';values.location=v.location||'';}
    if(target==='lighting'){values.system=v.system||'';values.location=v.location||'';}
    return {kind:target,values};
  }
  function historyPage() {
    return `<section class="panel"><h2>Property history</h2><label>Property<select id="main-history-property"><option value="">Select property…</option>${properties().map(p=>`<option value="${safe(p.id)}">${safe(p.name)}</option>`).join('')}</select></label><div id="main-history"></div></section>`;
  }
  function showHistory(id) {
    const target=document.getElementById('main-history');if(!target)return;
    let html=propertyOverview(id)+preparedServices(id)+list().filter(r=>r.values.property===id).map(recordCard).join('');
    const legacy=legacyHistory(id);
    html+=`<h3>Existing prototype records (${legacy.length}) — this device</h3><p>Original device records are preserved and have no new approval or certification status.</p>`+legacy.map(r=>`<article class="main-record"><b>${safe(r.kind)}</b>${['services','pat','lighting'].includes(r.kind)?`<button data-main-legacy="${safe(r.kind)}:${r.index}" data-legacy-property="${safe(id)}">Prepare new draft from stable details</button>`:''}${Object.entries(r.values).map(([k,v])=>`<p>${safe(k)}: ${safe(typeof v==='object'?JSON.stringify(v):v)}</p>`).join('')}</article>`).join('');
    target.innerHTML=html||'<p>No history recorded.</p>';
  }
  function scheduleSummary() {
    const t=today();
    const dateAt=day=>new Date(day+'T12:00:00Z');
    const daysUntil=day=>Math.round((dateAt(day)-dateAt(t))/86400000);
    const visits=list('visit').filter(r=>!['Completed','Cancelled'].includes(r.values.status)).sort((a,b)=>(a.values.date+a.values.time).localeCompare(b.values.date+b.values.time));
    const follow=list().filter(r=>r.values.next&&daysUntil(r.values.next)<=30).sort((a,b)=>a.values.next.localeCompare(b.values.next));
    const followLabel=day=>{const n=daysUntil(day);return n<0?'Overdue by '+(-n)+' day(s)':n===0?'Due today':n<=7?'Due within 7 days':'Due within 30 days'};
    return `<section class="panel"><h2>Service reminders</h2><p>Import the calendar file to schedule 30-day and 7-day alarms in your calendar. Re-import after changes; delivery depends on your calendar settings. Email and SMS are not configured.</p><button type="button" data-main-calendar>Download calendar reminders</button><p></p>${visits.map(r=>`<p><b>${r.values.date<t?'Overdue':'Upcoming'}</b> ${safe(r.values.date)} ${safe(r.values.time)} · ${safe(propertyName(r.values.property))} · ${safe(r.values.engineer)}</p>`).join('')||'<p>No active visits.</p>'}${follow.map(r=>`<p><b>${safe(followLabel(r.values.next))}</b> · ${safe(r.values.next)} · ${safe(names[r.kind])} · ${safe(propertyName(r.values.property))}</p>`).join('')||'<p>No follow-ups due within 30 days.</p>'}</section>`;
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
  // Calendar alarms run in the user's calendar after import, including when this app is closed.
  function calendarReminders(records, sites=properties()) {
    const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
    const date=value=>value.replace(/-/g,'');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Paramount Fire//Service reminders//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    for(const r of records){
      if(r.kind==='visit'&&['Cancelled','Completed'].includes(r.values.status))continue;
      const due=r.kind==='visit'?r.values.date:r.values.next;
      if(!validDate(due||''))continue;
      const site=sites.find(p=>p.id===r.values.property),title=(names[r.kind]||r.kind)+' · '+(site?.name||r.values.site||'Follow-up');
      lines.push('BEGIN:VEVENT','UID:'+escape(r.id)+'-followup@paramount.local','DTSTAMP:'+stamp,'SEQUENCE:'+r.revision,
        'DTSTART;VALUE=DATE:'+date(due),'SUMMARY:'+escape(title),'LOCATION:'+escape([site?.address,site?.postcode].filter(Boolean).join(', ')),
        'DESCRIPTION:'+escape('Record '+r.id+' revision '+r.revision+'. Confirm appointment and scope in the app. Calendar reminders depend on your calendar settings.'));
      for(const days of [30,7])lines.push('BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-P'+days+'D','DESCRIPTION:'+escape(title+' due in '+days+' days'),'END:VALARM');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    // RFC 5545: fold at 75 octets without splitting UTF-8 characters.
    return lines.flatMap(line=>{const rows=[];let row='',bytes=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(bytes+n>75){rows.push(row);row=' ';bytes=1}row+=char;bytes+=n}rows.push(row);return rows}).join('\r\n')+'\r\n';
  }
  function routeLink(visits, sites=properties()) {
    const active=visits.filter(r=>r.kind==='visit'&&!['Cancelled','Completed'].includes(r.values.status))
      .slice().sort((a,b)=>a.values.time.localeCompare(b.values.time)||a.id.localeCompare(b.id));
    if(active.length<2||active.length>10)throw Error('Choose 2–10 active visits in a single date and engineer group.');
    if(new Set(active.map(r=>r.values.date+'|'+r.values.engineer.trim().toLowerCase())).size!==1)throw Error('Route visits must share a date and engineer.');
    const stops=active.map(r=>{const p=sites.find(s=>s.id===r.values.property);if(!p?.postcode?.trim())throw Error('Add a postcode for every route stop.');return [p.address,p.postcode].filter(Boolean).join(', ')});
    const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('travelmode','driving');
    url.searchParams.set('origin',stops[0]);url.searchParams.set('destination',stops.at(-1));
    if(stops.length>2)url.searchParams.set('waypoints',stops.slice(1,-1).join('|'));
    return url.href;
  }
  // Exact shortest open route over a supplied directed road-duration matrix.
  // Times are seconds; null means unreachable. Stops are never silently dropped.
  function optimiseRoute(visits, matrix, startId, endId) {
    const rows=visits.filter(r=>r.kind==='visit'&&!['Cancelled','Completed'].includes(r.values.status));
    if(rows.length<2||rows.length>10||new Set(rows.map(r=>r.id)).size!==rows.length||new Set(rows.map(r=>r.values.date+'|'+r.values.engineer.trim().toLowerCase())).size!==1)throw Error('Choose 2–10 distinct active visits for one engineer and date.');
    if(!matrix||!Array.isArray(matrix.ids)||matrix.ids.length!==rows.length||new Set(matrix.ids).size!==rows.length||!rows.every(r=>matrix.ids.includes(r.id))||!Array.isArray(matrix.seconds)||matrix.seconds.length!==rows.length)throw Error('Matrix must identify every selected visit exactly once.');
    const n=rows.length;
    for(const row of matrix.seconds)if(!Array.isArray(row)||row.length!==n||row.some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>604800)))throw Error('Invalid directed travel durations.');
    const start=matrix.ids.indexOf(startId),end=matrix.ids.indexOf(endId);
    if(start<0||end<0||start===end)throw Error('Choose distinct fixed start and end visits.');
    const memo=new Map();
    function solve(mask,last){
      if(mask===(1<<n)-1)return last===end?{seconds:0,path:[]}:null;
      const key=mask+':'+last;if(memo.has(key))return memo.get(key);
      let best=null;
      for(let j=0;j<n;j++){
        if(mask&(1<<j)||j===end&&mask!==(((1<<n)-1)^(1<<end)))continue;
        const travel=matrix.seconds[last][j];if(travel===null)continue;
        const tail=solve(mask|(1<<j),j);if(!tail)continue;
        const seconds=travel+tail.seconds;
        if(!best||seconds<best.seconds)best={seconds,path:[j,...tail.path]};
      }
      memo.set(key,best);return best;
    }
    const result=solve(1<<start,start);if(!result)throw Error('No reachable route includes every stop.');
    const ordered=[start,...result.path].map(i=>rows.find(r=>r.id===matrix.ids[i]));
    // Existing appointment times remain untouched: show feasibility of this proposal.
    const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
    let clock=minutes(ordered[0].values.time)+Number(ordered[0].values.minutes);const conflicts=[];
    for(let i=1;i<ordered.length;i++){
      const a=matrix.ids.indexOf(ordered[i-1].id),b=matrix.ids.indexOf(ordered[i].id);
      clock+=matrix.seconds[a][b]/60;
      if(clock>minutes(ordered[i].values.time))conflicts.push(ordered[i].id);
      clock=Math.max(clock,minutes(ordered[i].values.time))+Number(ordered[i].values.minutes);
    }
    return {visits:ordered,seconds:result.seconds,conflicts,source:String(matrix.source||'User-supplied matrix'),generatedAt:String(matrix.generatedAt||'Unspecified')};
  }
  document.addEventListener('submit',e=>{
    if(e.target.id!=='main-route-optimise')return;e.preventDefault();
    const out=document.getElementById('main-route-result');
    try{const f=e.target.elements,m=JSON.parse(f.matrix.value),selected=list('visit').filter(r=>m.ids?.includes(r.id)),r=optimiseRoute(selected,m,f.start.value,f.end.value);
      out.textContent=r.visits.map((v,i)=>(i+1)+'. '+propertyName(v.values.property)+' ('+v.values.time+')').join(' → ')+' · '+Math.round(r.seconds/60)+' estimated driving minutes · '+r.conflicts.length+' appointment conflicts. Source: '+r.source+' / '+r.generatedAt+'. Proposal only; review appointments before rescheduling.';
    }catch(error){out.textContent=error.message}
  });
  function routeBoard(records) {
    const groups=new Map();
    for(const r of records.filter(r=>r.kind==='visit'&&!['Cancelled','Completed'].includes(r.values.status))){const key=r.values.date+'|'+r.values.engineer.trim().toLowerCase();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
    return '<section class="panel"><h2>Driving routes by engineer and date</h2><p>Routes follow appointment times. Opening Maps shares site addresses with Google. Check traffic, access and travel time before confirming appointments.</p>'+[...groups.values()].map(visits=>{
      let route;try{route=`<a href="${safe(routeLink(visits))}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open scheduled driving route in Maps</a>`}catch(error){route=`<p>${safe(error.message)}</p>`}
      return `<article><h3>${safe(visits[0].values.date)} · ${safe(visits[0].values.engineer)}</h3>${route}</article>`;
    }).join('')+'<details><summary>Optimise a driving route</summary><p>Supply a directed road-duration matrix from your approved routing provider. No addresses are sent automatically. Fix the first and last stops; all other stops are optimised. Existing appointments are preserved and conflicts are reported. Matrix JSON: {ids: [visit IDs], seconds: [[0,300],[360,0]], source: provider, generatedAt: ISO date}.</p><form id="main-route-optimise"><label>Matrix JSON<textarea name="matrix" required></textarea></label><label>First visit ID<input name="start" required></label><label>Last visit ID<input name="end" required></label><button>Calculate shortest driving proposal</button></form><p id="main-route-result" role="status"></p></details></section>';
  }
  function plannerBoard() {
    return routeBoard(list('visit'))+'<section class="panel"><h2>Visits by date and postcode district</h2><p>Grouped for planning; allow travel time separately. This view does not calculate routes or travel times.</p>'+plannerGroups(list('visit')).map(g=>`<article class="main-plan-group"><h3>${safe(g.date)} · ${safe(g.area)}</h3><p>${g.visits.length} visits · ${g.minutes} minutes on site</p>${g.visits.map(r=>`<p>${safe(r.values.time)} · ${safe(propertyName(r.values.property))} · ${safe(r.values.engineer)} · ${safe(r.values.serviceType)}</p><button type="button" data-main-pack="${safe(r.id)}">Engineer job pack</button>`).join('')}</article>`).join('')+'</section>';
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
  function propertyOverview(id) {
    if(!property(id))return '';
    const rows=list().filter(r=>r.values.property===id);
    const latest=Object.keys(reusable).map(k=>rows.filter(r=>r.kind===k).sort((a,b)=>b.values.date.localeCompare(a.values.date)||b.updated.localeCompare(a.updated))[0]).filter(Boolean);
    const open=rows.filter(r=>r.kind==='callout'&&r.values.status!=='Closed after verification');
    const failed=registerRows(rows).filter(r=>/Fail|Defective/i.test(r.values.outcome||''));
    return '<section class="main-record"><h3>Service overview</h3>'+latest.map(r=>'<p>'+safe(names[r.kind])+': '+safe(r.values.date)+' · '+safe(r.values.serviceStatus||'Draft')+'<br><strong>'+(!r.values.next?'Next date not recorded':r.values.next<today()?'Overdue: '+safe(r.values.next):'Next: '+safe(r.values.next))+'</strong></p>').join('')+'<p>'+open.length+' open call-outs · '+failed.length+' assets with a latest recorded failure / defect. Review saved scope and remedial records.</p><div class="main-actions"><button type="button" data-main-site-repeat="'+safe(id)+'">Prepare entire property visit</button><button type="button" data-main-site-register="'+safe(id)+'">Open this property’s equipment registers</button></div></section>';
  }
  function showProperties(query) {
    const target=document.getElementById('main-properties');if(!target)return;
    const q=query.trim().toLowerCase();
    const rows=properties().filter(p=>['name','address','postcode','panel','contact'].some(k=>String(p[k]||'').toLowerCase().includes(q)));
    target.innerHTML=`<p>${rows.length} of ${properties().length} properties</p>`+rows.map(p=>`<article class="main-record"><h3>${safe(p.name)}</h3><p>${safe(p.address||'')} ${safe(p.postcode||'')}<br>${safe(p.panel)}<br>Last service: ${safe(p.last)} · interval ${safe(p.months)} months</p><div class="main-actions"><button type="button" data-main-property-edit="${safe(p.id)}">Edit property</button><button type="button" data-main-site-history="${safe(p.id)}">Services / dates / defects</button></div></article>`).join('');
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
    const siteButton=e.target.closest('[data-main-site-history],[data-main-site-register],[data-main-site-repeat]');
    if(siteButton){try{
      load();
      const id=siteButton.dataset.mainSiteHistory||siteButton.dataset.mainSiteRegister||siteButton.dataset.mainSiteRepeat;
      if(!property(id))throw Error('Property unavailable.');
      if(siteButton.dataset.mainSiteRepeat){prepareRepeat('service',id,true);tab='Property History';render();document.getElementById('main-history-property').value=id;showHistory(id)}
      else if(siteButton.dataset.mainSiteRegister){tab='Equipment Registers';render();document.getElementById('view').innerHTML='<div class="main-app">'+banner()+equipmentRegister(id)+'</div>'}
      else {tab='Property History';render();document.getElementById('main-history-property').value=id;showHistory(id)}
    }catch(error){message(error.message)}return}
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
  const fieldLabels={date:'Record date',engineer:'Engineer / tester',system:'System / fitting reference',standard:'Agreed scope / standard edition',tests:'Tests performed and actual results',battery:'Battery inspection',batteryVoltage:'Battery voltage (V)',batteryAh:'Battery capacity (Ah)',measurements:'Measurements / instrument / calibration',defects:'Defects / limitations / inaccessible areas',actions:'Actions / advice / handover',next:'Next agreed test / service date',recipient:'Responsible person / handover recipient',declaration:'Engineer declaration within recorded scope',asset:'Appliance / asset ID',appliance:'Appliance type',location:'Location / circuit / asset IDs',equipmentClass:'Equipment class',instrument:'Test instrument / serial',calibration:'Calibration reference / due date',visual:'Visual inspection',outcome:'Recorded outcome',testType:'Test scope',duration:'Actual observed duration (minutes)',restoration:'Supply restored / charging observations',panelSerial:'Panel serial number',batteryModel:'Battery make / model',batteryCount:'Battery quantity',zones:'Legacy zone / device register',equipment:'Structured equipment register',legacySource:'Preserved legacy source provenance',repeatSource:'Previous completed record reference'};
  const signatureFields=['engineerSignature','engineerSigned','customerName','customerSignature','customerSigned'];
  function certificateLines(r) {
    if(!['service','pat','lighting','extinguisher','installation'].includes(r.kind)||r.values.reviewed!=='yes')throw Error('Select a reviewed engineering draft.');
    const v=r.values,site=r.siteSnapshot||siteDetails(property(v.property));
    const headings=['SITE / CUSTOMER','SYSTEM / PANEL / BATTERIES','SERVICE SCOPE','DEVICE REGISTER / ACTUAL RESULTS','DEFECTS / LIMITATIONS / ACTIONS','DRAFT SIGNATURE ACKNOWLEDGEMENTS'];
    const used=new Set(['property','reviewed',...signatureFields]);
    const field=k=>{used.add(k);if(k==='tests'&&v.equipment&&v.tests===equipmentSummary(equipmentRows(v.equipment)))return null;return v[k]!==undefined?(fieldLabels[k]||k)+': '+(k==='equipment'?equipmentRows(v[k]).map((row,i)=>'Asset '+(i+1)+' — '+row.id+'\n'+editorColumns(r.kind).filter(k=>k!=='id'&&row[k]).map(k=>(({zone:'Zone',address:'Loop / address',deviceType:'Device type',location:'Location',specification:'Specification',result:'Result',readings:'Actual readings',serial:'Serial',model:'Manufacturer / model',capacity:'Type / capacity',manufactured:'Manufactured',lastTest:'Previous extended service',next:'Next agreed service'})[k]||fieldLabels[k]||k)+': '+row[k]).join(' | ')).join('\n\n'):v[k]):null};
    const group=(title,keys)=>['',title,...keys.map(field).filter(x=>x!==null)];
    return [r.kind==='service'?'Fire alarm service certificate — DRAFT':names[r.kind]+' — DRAFT','Reference: '+r.id,'Revision: '+r.revision,'Saved: '+r.updated,
      '',headings[0],...(!r.siteSnapshot?['Legacy record: current site details; no original site snapshot.']:['Site details recorded at first save:']),...Object.entries(site).filter(([k])=>k!=='id').map(([k,v])=>k+': '+v),
      ...group(headings[1],['system','panelSerial','batteryModel','batteryCount','batteryAh','battery','batteryVoltage']),
      ...group(headings[2],['date','engineer','standard','stage','visitType','testType','serviceStatus','testState','measurements','instrument','calibration','ratedDuration','duration']),
      ...group(headings[3],['asset','appliance','location','equipmentClass','model','capacity','manufactured','lastTest','drawingRef','devices','zones','equipment','tests','visual','outcome']),
      ...group(headings[4],['defects','actions','restoration','next','recipient','declaration']),
      ...Object.keys(v).filter(k=>!used.has(k)).map(field),
      '',headings[5],'Engineer signature (typed): '+(v.engineerSignature||'________________________'),'Engineer signature date: '+(v.engineerSigned||'________________'),'Customer / responsible person: '+(v.customerName||v.recipient||'________________________'),'Customer signature (typed): '+(v.customerSignature||'________________________'),'Customer signature date: '+(v.customerSigned||'________________'),'Acknowledgement of this draft only; no approval or controlled issue.','Competent review of scope, results and approved certification is pending.'];
  }
  function documentLines(r) {
    if(!r||r.values.reviewed!=='yes')throw Error('Select a reviewed saved draft.');
    if(['service','pat','lighting','extinguisher','installation'].includes(r.kind))return certificateLines(r);
    const lines=[names[r.kind]+' — DRAFT','Reference: '+r.id,'Revision: '+r.revision,'Saved: '+r.updated,'DRAFT — NOT ISSUED — NOT A COMPLIANCE CERTIFICATE'];
    const site=r.siteSnapshot||siteDetails(property(r.values.property));
    lines.push('',r.siteSnapshot?'Saved site details':'Current site details',...Object.entries(site).map(([k,v])=>k+': '+v));
    lines.push('',...Object.entries(r.values).filter(([k])=>!['property','reviewed'].includes(k)).map(([k,v])=>(fieldLabels[k]||k)+': '+(k==='equipment'?equipmentSummary(equipmentRows(v)):v)));
    if(['quote','invoice'].includes(r.kind)){const t=totals(r.values);lines.push('Subtotal: '+pounds(t.subtotal),'VAT: '+pounds(t.tax),'Total: '+pounds(t.total),'Verify company, VAT, payment and billing details before issue.')}
    return lines;
  }
  function wordDocument(r) {
    // Minimal OpenXML package with UTF-8 text. Stored ZIP entries need no external library.
    const xml=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const paragraph=(line,bold=false)=>'<w:p><w:r>'+(bold?'<w:rPr><w:b/><w:color w:val="12304B"/></w:rPr>':'')+'<w:t xml:space="preserve">'+xml(line)+'</w:t></w:r></w:p>';
    const section=line=>/^[A-Z][A-Z /]+$/.test(line)&&line.length>5;
    const cell=(text,header=false)=>'<w:tc><w:tcPr><w:tcW w:w="'+(header?'2800':'7000')+'" w:type="dxa"/>'+(header?'<w:shd w:fill="EDF6FC"/>':'')+'</w:tcPr>'+paragraph(text,header)+'</w:tc>';
    const table=(label,value)=>'<w:tbl><w:tblPr><w:tblW w:w="9800" w:type="dxa"/><w:tblBorders><w:bottom w:val="single" w:sz="4" w:color="D7E5EF"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="2800"/><w:gridCol w:w="7000"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>'+cell(label+':',true)+cell(value)+'</w:tr></w:tbl>';
    const body=documentLines(r).flatMap(line=>String(line).split(/\r?\n/)).map((line,i)=>{
      if(section(line))return '<w:p><w:pPr><w:keepNext/><w:shd w:fill="12304B"/><w:spacing w:before="220" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="23"/></w:rPr><w:t>'+xml(line)+'</w:t></w:r></w:p>';
      const split=line.indexOf(': ');return split>0?table(line.slice(0,split),line.slice(split+2)):paragraph(line,i===0);
    }).join('');
    const files={
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/_rels/document.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="footer" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
      'word/footer1.xml':'<?xml version="1.0"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+paragraph('DRAFT — NOT ISSUED — NOT A COMPLIANCE CERTIFICATE',true)+paragraph('Reference: '+r.id+' · Revision: '+r.revision)+'<w:p><w:r><w:t>Page </w:t></w:r><w:fldSimple w:instr="PAGE"/><w:r><w:t> of </w:t></w:r><w:fldSimple w:instr="NUMPAGES"/></w:p></w:ftr>',
      'word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'+paragraph('PARAMOUNT FIRE PROTECTION',true)+body+'<w:sectPr><w:footerReference w:type="default" r:id="footer"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="1100" w:left="900" w:footer="500"/></w:sectPr></w:body></w:document>'
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
    const section=line=>/^[A-Z][A-Z /]+$/.test(line)&&line.length>5;
    return '<style>.certificate{font-family:Arial,sans-serif;color:#12304b;max-width:760px;margin:auto;line-height:1.5}.certificate h2{background:#12304b;color:white;padding:24px;border-bottom:5px solid #39a9dc}.certificate h3{font-size:24px}.certificate h4{background:#e8f4fc;border-left:5px solid #1595d5;padding:10px;break-after:avoid}.certificate p{white-space:pre-wrap;overflow-wrap:anywhere;border-bottom:1px solid #e1ebf2;padding:6px 10px;margin:0}.certificate .draft-stamp{color:#9b2431;font-weight:bold;border:2px solid #9b2431;padding:12px}@media print{.certificate h4{break-after:avoid}.certificate p{orphans:3;widows:3}}</style><section class="certificate"><h2>PARAMOUNT FIRE PROTECTION</h2><p class="draft-stamp">DRAFT — NOT ISSUED — NOT A COMPLIANCE CERTIFICATE</p>'+certificateLines(r).map((line,i)=>i===0?'<h3>'+safe(line)+'</h3>':section(line)?'<h4>'+safe(line)+'</h4>':'<p>'+safe(line).replace(/\n/g,'<br>')+'</p>').join('')+'</section>';
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
    for(const r of records){const lines=documentLines(r).flatMap(wrap);for(let i=0;i<lines.length;i+=47)pages.push({r,lines:lines.slice(i,i+47)})}
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
      lines.forEach((l,j)=>{const y=724-j*13,heading=/^[A-Z][A-Z /]+$/.test(l)&&l.length>5;
        if(heading)content+='0.88 0.94 0.98 rg 32 '+(y-3)+' 531 13 re f\n0.06 0.17 0.28 rg\n';
        else if(j%2===0&&l)content+='0.97 0.98 0.99 rg 32 '+(y-3)+' 531 13 re f\n0.06 0.17 0.28 rg\n';
        content+=text(l,heading?10.2:10,36,y)});
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
    if(kind){const legacy=['Service Records','Quotes','Planner'].includes(tab)?`<details class="panel"><summary>Preserved prototype ${safe(tab)} — existing records</summary><div id="main-legacy"></div></details>`:'';const old=view.innerHTML;view.innerHTML=`<div class="main-app">${banner()}${tab==='Office'?officeSummary():''}${tab==='Planner'?plannerBoard()+scheduleSummary():''}${workspace(kind)}${preparedServices(state.drafts[kind]?.values.property)}${legacy}</div>`;const el=document.getElementById('main-legacy');if(el){el.innerHTML=old;el.querySelectorAll('form').forEach(f=>f.remove());if(tab==='Planner'){el.querySelectorAll('[data-plan-filter]').forEach(b=>b.remove())}}restore();}
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
  document.addEventListener('input',e=>{if(e.target.dataset.equipmentField){const form=e.target.closest('form'),rows=JSON.parse(form.elements.equipment.value||'[]');rows[Number(e.target.closest('[data-equipment-index]').dataset.equipmentIndex)][e.target.dataset.equipmentField]=e.target.value;form.elements.equipment.value=JSON.stringify(rows);if(e.target.dataset.equipmentField==='result')e.target.closest('[data-equipment-index]').querySelectorAll('[data-equipment-result]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.equipmentResult===e.target.value)))}});
  document.addEventListener('input',e=>{if(e.target.id==='main-property-search')showProperties(e.target.value);const form=e.target.closest('form[data-main-form]');if(!form)return;if(form.dataset.mainScope!==scope()){message('Account changed. Reload before editing.');return}load();if(e.target.name!=='reviewed')form.elements.namedItem('reviewed').checked=false;remember();updatePreview(form)});
  document.addEventListener('submit',e=>{const form=e.target.closest('form[data-main-form]');if(!form)return;e.preventDefault();stopSpeech();if(form.dataset.mainScope!==scope()){message('Account changed. Reload this form before saving.');return}load();try{const r=saveRecord(form.dataset.mainForm,fields(form));const continuing=e.submitter?.name==='continueAppliance'&&r.revision===1&&!r.values.equipment;
      if(continuing){const v=r.values;commit(s=>s.drafts.pat={values:Object.fromEntries(['property','date','engineer','instrument','calibration','location','next'].map(k=>[k,v[k]||'']).concat([['asset',nextAsset(v.asset)],['reviewed','']])),editing:null,updated:now()})}
      form.removeAttribute('data-main-form');render();message('Draft saved on this device. Review / PDF preview is available below. Reference: '+r.id)}catch(error){message('Not saved: '+error.message)}});
  document.addEventListener('change',async e=>{
    if(e.target.name==='property'&&e.target.closest('form[data-main-form]')&&['pat','lighting','extinguisher','service'].includes(e.target.closest('form').dataset.mainForm)){
      const form=e.target.closest('form'),source=latestCompleted(state.records,form.dataset.mainForm,e.target.value);
      if(form.elements.equipment.value&&JSON.parse(form.elements.equipment.value).some(r=>r.description||r.location||r.readings||r.defects||r.result!=='Not Tested')&&!confirm('Changing property clears the current appliance checklist. Continue?')){e.target.value=JSON.parse(form.dataset.equipmentProperty||'""');return}
      if(JSON.parse(form.dataset.equipmentProperty||'""'))form.elements.equipment.value='';form.dataset.equipmentProperty=JSON.stringify(e.target.value);form.elements.reviewed.checked=false;if(form.elements.legacySource)form.elements.legacySource.value='';if(form.elements.repeatSource)form.elements.repeatSource.value='';paintEquipment(form);remember();
      if(source&&!form.elements.equipment.value){form.elements.equipment.value=repeatServiceValues(state.records,form.dataset.mainForm,e.target.value).equipment||'';paintEquipment(form);remember();message('Previous completed appliance register loaded with Not Tested results.');}
    }
    if(e.target.id==='main-history-property')showHistory(e.target.value);
    if(e.target.id==='main-import'&&e.target.files?.[0])try{if(e.target.files[0].size>10000000)throw Error('Backup exceeds 10 MB.');const data=JSON.parse(await e.target.files[0].text());if(!confirm('Merge this backup into the current workspace? Existing records and forms will not be overwritten.'))return;merge(data);render();message('Backup merged. Existing drafts were retained.')}catch(error){message('Import rejected: '+error.message)}
  });
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-main-legacy],[data-main-repeat],[data-main-repeat-visit],[data-equipment-result],[data-equipment-single],[data-equipment-add],[data-equipment-identical],[data-equipment-remove],[data-main-calendar],[data-main-appliance],[data-main-report],[data-main-edit],[data-main-pdf],[data-main-print],[data-main-clear],[data-main-convert],[data-main-job-quote],[data-main-job-invoice],[data-main-word],[data-main-pack],[data-main-export],[data-main-raw],[data-main-upload],[data-main-cloud-list],[data-main-cloud-download],[data-main-dictate],[data-main-stop]');if(!b)return;
    load();try{
      if(b.dataset.mainLegacy){const [kind,index]=b.dataset.mainLegacy.split(':');const prepared=legacyDraft(kind,Number(index),b.dataset.legacyProperty);remember();if(state.drafts[prepared.kind]&&!confirm('Replace this unfinished form with a new legacy-source draft? Original history is retained.'))return;commit(s=>s.drafts[prepared.kind]={values:prepared.values,editing:null,updated:now()});document.querySelector('form[data-main-form]')?.removeAttribute('data-main-form');tab=Object.keys(pages).find(k=>pages[k]===prepared.kind);render();message('New draft from legacy stable details. Enter current results and review; original history is unchanged.');}
      else if(b.dataset.mainRepeat||b.dataset.mainRepeatVisit){const form=document.querySelector('form[data-main-form]');if(form?.dataset.mainScope!==scope())throw Error('Reload this form.');prepareRepeat(b.dataset.mainRepeat||b.dataset.mainRepeatVisit,form.elements.property.value,!!b.dataset.mainRepeatVisit);}
      else if(b.hasAttribute('data-equipment-result')){
        const form=b.closest('form');if(form.dataset.mainScope!==scope())throw Error('Reload this form.');
        const row=b.closest('[data-equipment-index]'),control=row.querySelector('[data-equipment-field="result"]');
        control.value=b.dataset.equipmentResult;control.dispatchEvent(new Event('input',{bubbles:true}));
        row.querySelectorAll('[data-equipment-result]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.equipmentResult===control.value)));
        if(control.value==='Fail')row.querySelector('[data-equipment-field="defects"]').focus();
      }
      else if(b.hasAttribute('data-equipment-single')){const form=b.closest('form');if(form.dataset.mainScope!==scope())throw Error('Reload this form.');if(!confirm('Switch to single-asset entry and clear this unfinished checklist? Saved records remain.'))return;form.elements.equipment.value='';form.elements.reviewed.checked=false;paintEquipment(form);remember();}
      else if(b.hasAttribute('data-equipment-add')||b.hasAttribute('data-equipment-identical')||b.hasAttribute('data-equipment-remove')){
        const form=b.closest('form');if(form.dataset.mainScope!==scope())throw Error('Reload this form.');
        const rows=JSON.parse(form.elements.equipment.value||'[]');
        if(b.hasAttribute('data-equipment-remove'))rows.splice(Number(b.dataset.equipmentRemove),1);
        else {const last=b.hasAttribute('data-equipment-identical')?rows.at(-1):null;rows.push({id:'ASSET-'+uid().slice(0,8),description:last?.description||'',location:last?.location||'',specification:last?.specification||'',...Object.fromEntries(['zone','deviceType','model','capacity','manufactured'].filter(k=>last?.[k]!==undefined).map(k=>[k,last[k]])),result:'Not Tested',readings:'',duration:'',defects:'',actions:''})}
        form.elements.equipment.value=JSON.stringify(rows);form.elements.reviewed.checked=false;paintEquipment(form);remember();
      }
      else if(b.hasAttribute('data-main-calendar'))download('paramount-reminders.ics',calendarReminders(list()),'text/calendar;charset=utf-8');
      else if(b.dataset.mainAppliance){const form=document.querySelector('form[data-main-form="pat"]');if(!form||form.dataset.mainScope!==scope())throw Error('Reload this form before editing.');if(form.elements.equipment.value){const rows=JSON.parse(form.elements.equipment.value);if(rows.length){rows[rows.length-1].description=b.dataset.mainAppliance;form.elements.equipment.value=JSON.stringify(rows);paintEquipment(form);form.elements.reviewed.checked=false;remember()}}else{form.elements.appliance.value=b.dataset.mainAppliance;form.elements.appliance.dispatchEvent(new Event('input',{bubbles:true}));form.elements.asset.focus();}}
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
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){remember();stopSpeech()}});
  addEventListener('pagehide',()=>{remember();stopSpeech()});
  addEventListener('beforeunload',()=>{remember();stopSpeech()});
  addEventListener('storage',e=>{if(e.key===storageKey())message('Workspace changed in another tab. Reload before editing saved records; stale revisions cannot overwrite newer records.')});
  // Read-only test interface: no credentials or automatic cloud calls.
  window.ParamountMainApp={servicePdf,totals,repeatServiceValues,legacyHistory,legacyDraft,certificateHtml,repeatValues,latestCompleted,equipmentRows,equipmentSummary,optimiseRoute,calendarReminders,routeLink,wordDocument,registerRows,reminderRows,plannerGroups,jobPack,documentLines,refresh:()=>{if(team())state=read()},reload:()=>{state=null;render()},recordsPdf,nextAsset,parseMoney,rectangles,validDate,overlaps,validate,version:VERSION};
  render();
})();





