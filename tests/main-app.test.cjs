const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function harness(storage=new Map()){
  const context={console,TextEncoder,Uint8Array,DataView,crypto:webcrypto,URL,Date,JSON,Number,Set,Map,Object,Array,String,Error,FormData,Blob,
    key:'paramount-demo-v1',sections:[],tab:'test',db:{properties:[{id:'P1',name:'Fictional site'}]},cloudSession:null,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{querySelector:()=>null,getElementById:()=>null,addEventListener:()=>{}},window:{},
    render:()=>{},esc:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    addEventListener:()=>{},setTimeout:()=>{},confirm:()=>true};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('pdf-font.js','utf8'),context);
  let source=fs.readFileSync('main-app.js','utf8').replace('window.ParamountMainApp={servicePdf,totals,','window.ParamountMainApp={setEditing:v=>editing=v,saveProperty,siteDetails,saveRecord,merge,read,load,exportData,servicePdf,totals,');
  vm.runInContext(source,context);
  return {api:context.window.ParamountMainApp,context,storage};
}
const commercial={property:'P1',date:'2026-10-26',due:'2026-11-26',number:'Q1',customer:'Fictional customer',address:'Fictional address',lines:'Service | 3 | 0.10',vat:'20',vatNumber:'TEST ONLY',terms:'Draft only',reviewed:'yes'};
const visit={property:'P1',date:'2026-11-01',engineer:'Engineer A',time:'09:00',minutes:'60',serviceType:'Fire alarm',status:'Confirmed',notes:'Fictional visit',reviewed:'yes'};
test('backup restores partial offline forms once without replacing current work',()=>{
 const a=harness();a.api.load();const backup=a.api.exportData();
 backup.drafts={lighting:{values:{property:'P1',results:'Partial offline reading',reviewed:''},editing:null,updated:'2026-10-30T10:00:00Z'}};
 const b=harness();b.api.merge(backup);assert.equal(b.api.read().drafts.lighting.values.results,'Partial offline reading');
 backup.drafts.lighting.values.results='Older backup';b.api.merge(backup);
 assert.equal(b.api.read().drafts.lighting.values.results,'Partial offline reading');
 const reloaded=harness(b.storage);reloaded.api.load();assert.equal(reloaded.api.exportData().drafts.lighting.values.reviewed,'');
});
test('draft recovery rejects malformed and stale editing sources atomically',()=>{
 const a=harness();a.api.saveRecord('quote',commercial);const backup=JSON.parse(JSON.stringify(a.api.exportData()));
 const d={values:{property:'P1',number:'Unfinished'},editing:{id:backup.records[0].id,revision:1},updated:'2026-10-30T10:00:00Z'};
 backup.drafts={quote:d};const b=harness();b.api.merge(backup);assert.equal(b.api.read().drafts.quote.editing.revision,1);
 for(const drafts of [[],{unknown:d},{quote:{...d,updated:'bad'}},{quote:{...d,values:[]}}, {quote:{...d,values:{reviewed:true}}},{quote:{...d,editing:{...d.editing,revision:2}}}]){
   const target=harness();assert.throws(()=>target.api.merge({...backup,drafts}),/unfinished form/);assert.equal(target.api.read().records.length,0);
 }
 const other=harness();other.context.cloudSession={user:{id:'other-account'}};assert.throws(()=>other.api.merge(backup),/signed-in account/);assert.equal(other.storage.size,0);
});
test('commercial arithmetic uses pence and document-level rounded VAT',()=>{
 const {api}=harness();const t=api.totals(commercial);assert.equal(t.subtotal,30);assert.equal(t.tax,6);assert.equal(t.total,36);
 assert.equal(api.totals({...commercial,lines:'A | 1 | 10.01\nB | 2 | 2.55',vat:'17.5'}).total,1775);
 for(const lines of ['A | -1 | 10','A | 0 | 10','A | 1.5 | 10','A | 1 | -2','A | 1 | 0.001','A | 1 | Infinity','A | 10001 | 1','A | 1 | 1 | extra'])assert.throws(()=>api.totals({...commercial,lines}));
 assert.throws(()=>api.totals({...commercial,vat:'101'}));assert.throws(()=>api.parseMoney('1e3'));
});
test('records require real dates, property, complete scope and human review',()=>{
 const {api}=harness();assert(api.validDate('2028-02-29'));assert(!api.validDate('2026-02-29'));
 for(const changed of [{reviewed:''},{property:'missing'},{date:'2026-02-30'},{due:'2026-01-01'},{vatNumber:''},{terms:' '}])assert.throws(()=>api.validate('quote',{...commercial,...changed}));
 assert.throws(()=>api.validate('service',{property:'P1',date:'2026-10-26',reviewed:'yes'}));
});
test('drawing coordinates validate bounds and reject malformed or missing values',()=>{
 const {api}=harness();assert.equal(api.rectangles('Room | 0 | 0 | 100 | 100').length,1);
 for(const layout of ['Room | 90 | 0 | 20 | 10','Room | | 0 | 10 | 10','Room | 0 | 0 | -1 | 5','Room | NaN | 0 | 1 | 1'])assert.throws(()=>api.rectangles(layout));
 assert.throws(()=>api.rectangles('Detector | 101 | 20',true));
});
test('append saves preserve concurrent records, unique numbers and revision history',()=>{
 const store=new Map(),a=harness(store),b=harness(store);
 a.api.saveRecord('quote',commercial);b.api.saveRecord('quote',{...commercial,number:'Q2'});
 assert.equal(a.api.read().records.length,2);
 assert.throws(()=>b.api.saveRecord('quote',commercial),/number already exists/);
 assert.equal(a.api.read().records.length,2);
});
test('planner rejects overlap for the same engineer, permits adjacent and cancelled visits',()=>{
 const {api}=harness();api.saveRecord('visit',visit);
 assert.throws(()=>api.saveRecord('visit',{...visit,time:'09:30',engineer:' engineer a '}),/overlapping/);
 api.saveRecord('visit',{...visit,time:'10:00'});api.saveRecord('visit',{...visit,time:'09:15',status:'Cancelled'});
 assert.equal(api.read().records.length,3);
});
test('workspace storage is account separated and malformed data is never overwritten',()=>{
 const {api,context,storage}=harness();api.saveRecord('quote',commercial);
 context.cloudSession={user:{id:'account-b'}};api.load();assert.equal(api.read().records.length,0);api.saveRecord('quote',commercial);
 assert(storage.has('paramount-main-app-v1:device-guest'));assert(storage.has('paramount-main-app-v1:account-b'));
 const broken=new Map([['paramount-main-app-v1:device-guest','{broken']]);const h=harness(broken);
 assert.throws(()=>h.api.saveRecord('quote',commercial));assert.equal(broken.get('paramount-main-app-v1:device-guest'),'{broken');
});
test('backup merging is additive, atomic on conflict, and rejects other-account snapshots',()=>{
 const a=harness();a.api.saveRecord('quote',commercial);const backup=a.api.exportData();const b=harness();b.api.merge(backup);b.api.merge(backup);assert.equal(b.api.read().records.length,1);
 const changed=JSON.parse(JSON.stringify(backup));changed.records[0].values.number='CHANGED';assert.throws(()=>b.api.merge(changed),/conflicts/);assert.equal(b.api.read().records[0].values.number,'Q1');
 assert.throws(()=>b.api.merge({...backup,scope:'another-user'}));
 assert.throws(()=>b.api.merge({...backup,records:[...backup.records,...backup.records]}));
});
test('auth remains unchanged and new schema restricts reads/inserts to the owner',()=>{
 const sql=fs.readFileSync('sql/main-app-snapshots.sql','utf8');assert.match(sql,/force row level security/);assert.match(sql,/revoke all.*anon, authenticated/);assert.match(sql,/grant select, insert/);assert.match(sql,/auth.uid\(\)\) = user_id/g);assert.doesNotMatch(sql,/alter table public.properties|create policy.*for all/i);
 const code=fs.readFileSync('main-app.js','utf8');new vm.Script(code);assert.doesNotMatch(code,/\/auth\/v1|\/rest\/v1\/properties|localStorage\.clear|skipWaiting/);
});

test('editing preserves prior revisions and rejects stale saves from another tab',()=>{
 const store=new Map(),a=harness(store),b=harness(store);const original=a.api.saveRecord('quote',commercial);
 a.api.setEditing({id:original.id,revision:1});b.api.setEditing({id:original.id,revision:1});
 const updated=b.api.saveRecord('quote',{...commercial,terms:'Reviewed revision two'});
 assert.equal(updated.revision,2);assert.equal(updated.history[0].values.terms,'Draft only');
 assert.throws(()=>a.api.saveRecord('quote',{...commercial,terms:'Stale update'}),/changed in another tab/);
 assert.equal(a.api.read().records[0].values.terms,'Reviewed revision two');
});

const service={property:'P1',date:'2026-10-27',engineer:'Fictional engineer',system:'Test panel',standard:'TEST scope',tests:'Test device: fictional only',battery:'Not inspected',measurements:'No measurement - fixture',defects:'Test limitation',actions:'Test advice',recipient:'Fictional recipient',declaration:'Test draft only',reviewed:'yes'};
test('property edits preserve unrelated data, reopen, validate and reject stale writes',()=>{
 const {api,storage}=harness();
 storage.set('paramount-demo-v1',JSON.stringify({properties:[{id:'P1',name:'Original',panel:'Test',last:'2026-10-01',months:'6',schedule:{fire:{due:'2027-04-01'}}}],services:[{notes:'preserve'}],settings:{vat:'20'}}));
 const original=JSON.parse(storage.get('paramount-demo-v1')).properties[0];
 const values={name:'Renamed',panel:'Test',last:'2026-10-02',months:'12',address:'Fictional address'};
 api.saveProperty(values,original);
 const reopened=JSON.parse(storage.get('paramount-demo-v1'));
 assert.equal(reopened.properties[0].id,'P1');assert.equal(reopened.properties[0].schedule.fire.due,'2027-04-01');assert.equal(reopened.services[0].notes,'preserve');assert.equal(reopened.settings.vat,'20');
 const before=storage.get('paramount-demo-v1');
 assert.throws(()=>api.saveProperty(values,original),/changed in another tab/);
 for(const v of [{last:'2026-02-30'},{months:'0'},{months:'1.5'}])assert.throws(()=>api.saveProperty({...values,...v},null));
 assert.equal(storage.get('paramount-demo-v1'),before);
 const created=api.saveProperty(values,null);assert.notEqual(created.id,'P1');assert.equal(JSON.parse(storage.get('paramount-demo-v1')).properties.length,2);
 storage.set('paramount-demo-v1','{broken');assert.throws(()=>api.saveProperty(values,null));assert.equal(storage.get('paramount-demo-v1'),'{broken');
});
test('service records reopen with frozen site details, battery values and immutable revisions',()=>{
 const {api,context,storage}=harness();
 context.db.properties[0].address='Original site address';
 const first=api.saveRecord('service',{...service,batteryVoltage:'24.125',batteryAh:'7'});
 context.db.properties[0].name='Changed property';context.db.properties[0].address='Changed address';
 const reopened=harness(storage).api.read().records[0];assert.equal(reopened.siteSnapshot.name,'Fictional site');assert.equal(reopened.siteSnapshot.address,'Original site address');
 api.setEditing({id:first.id,revision:1});const second=api.saveRecord('service',{...service,batteryVoltage:'25',batteryAh:'7'});
 assert.equal(second.history[0].values.batteryVoltage,'24.125');assert.equal(second.siteSnapshot.name,'Fictional site');
 for(const value of ['-1','NaN','1e2','1001','1.2345'])assert.throws(()=>api.validate('service',{...service,batteryVoltage:value}));
 api.validate('service',service);
});
test('downloadable service PDF paginates all results and has valid byte offsets',()=>{
 const {api}=harness();
 const saved=api.saveRecord('service',{...service,tests:Array.from({length:100},(_,i)=>'Device '+i+' (test) \\ fixture').join('\n'),defects:'FINAL-DEFECT-MARKER <script> £ Ω'});
 const pdf=api.servicePdf(saved);
 assert.match(pdf,/^%PDF-1.4/);assert.match(pdf,/FontFile2/);assert.match(pdf,/ToUnicode/);assert.match(pdf,/<03a9>/);
 const count=Number(pdf.match(/\/Type \/Pages \/Count (\d+)/)[1]);assert(count>=3);
 const xref=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(xref,xref+4),'xref');
 const offsets=pdf.slice(xref).split('\n').filter(l=>/^\d{10} 00000 n/.test(l));
 offsets.forEach((l,i)=>assert(pdf.slice(Number(l.slice(0,10))).startsWith((i+1)+' 0 obj')));
 assert.equal(Buffer.byteLength(pdf),pdf.length);
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/service-draft.pdf',pdf);
 const legacy={...saved};delete legacy.siteSnapshot;assert.match(api.servicePdf(legacy),/^%PDF-1.4/);
});


test('PAT and lighting drafts retain signatures, frozen sites and old records without signatures',()=>{
 const {api,context,storage}=harness();
 const pat={property:'P1',date:'2026-10-27',engineer:'Zoë — Ω',instrument:'TEST',calibration:'Fictional calibration',asset:'K001',appliance:'Kettle',location:'Kitchen',equipmentClass:'Class I',visual:'Fictional visual check',tests:'0.12 Ω; ≥2 MΩ; ✓',outcome:'Pass within recorded test scope',defects:'Fixture only',reviewed:'yes',engineerSignature:'Zoë',engineerSigned:'2026-10-27',customerName:'José',customerSignature:'José',customerSigned:'2026-10-27'};
 const saved=api.saveRecord('pat',pat);context.db.properties[0].name='Renamed';
 api.setEditing({id:saved.id,revision:1});const revised=api.saveRecord('pat',{...pat,tests:'Revised readings 0.14 Ω'});
 assert.equal(revised.siteSnapshot.name,'Fictional site');assert.equal(revised.history[0].values.engineerSignature,'Zoë');
 assert.equal(harness(storage).api.read().records[0].values.customerSignature,'José');
 assert.equal(api.nextAsset('K009'),'K010');assert.equal(api.nextAsset('Kettle'),'');
 const light={property:'P1',date:'2026-10-27',engineer:'Test engineer',system:'L1',location:'Hall',testType:'Duration test',duration:'180',tests:'Fictional duration readings',defects:'Fixture only',actions:'Test notification',reviewed:'yes'};
 api.saveRecord('lighting',light);
 for(const duration of ['', '-1','NaN','1441','0'])assert.throws(()=>api.saveRecord('lighting',{...light,duration}));
 for(const kind of ['pat','lighting']){
   const pdf=api.recordsPdf(api.read().records.filter(r=>r.kind===kind));fs.writeFileSync('test-results/'+kind+'-draft.pdf',pdf);assert.match(pdf,/ToUnicode/);
 }
 const legacy={...light,testType:'Routine functional test'};delete legacy.duration;api.saveRecord('lighting',legacy);
 assert.throws(()=>api.recordsPdf([{...saved,values:{...pat,reviewed:''}}]),/reviewed/);
 assert.throws(()=>api.recordsPdf([]),/No saved/);
});



test('Word packages retain actual readings, Unicode, draft status and escaped content',()=>{
 const {api}=harness();const r=api.saveRecord('service',{...service,batteryVoltage:'24.125',batteryAh:'7',tests:'Zoë & <test> Ω',engineerSignature:'Fictional engineer'});
 const doc=api.wordDocument(r);assert.equal(Buffer.from(doc).subarray(0,4).toString('hex'),'504b0304');
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/populated-service.docx',doc);
 const q=api.saveRecord('quote',{...commercial,lines:'Service & parts | 3 | 0.10'});fs.writeFileSync('test-results/populated-quote.docx',api.wordDocument(q));fs.writeFileSync('test-results/populated-quote.pdf',api.recordsPdf([q]));
 assert.throws(()=>api.wordDocument({...r,values:{...r.values,reviewed:''}}),/reviewed/);
});
test('reminders use calendar days at 30 and 7 day boundaries including overdue and leap days',()=>{
 const {api}=harness();const rows=['2026-10-27','2026-10-28','2026-11-04','2026-11-05','2026-11-27','2026-11-28'].map((next,i)=>({id:String(i),values:{next}}));
 assert.deepEqual(Array.from(api.reminderRows(rows,'2026-10-28'),r=>r.days),[-1,0,7,8,30]);
 assert.equal(api.reminderRows([{id:'leap',values:{next:'2028-03-01'}}],'2028-02-28')[0].days,2);
});
test('planner groups date and postcode district, excludes completed visits and totals only on-site time',()=>{
 const {api}=harness();const rows=[{id:'a',kind:'visit',values:{...visit,time:'10:00'}},{id:'b',kind:'visit',values:{...visit,time:'09:00'}},{id:'c',kind:'visit',values:{...visit,status:'Completed'}}];
 const groups=api.plannerGroups(rows,[{id:'P1',postcode:'ab1 2cd'}]);assert.equal(groups.length,1);assert.equal(groups[0].area,'AB1');assert.equal(groups[0].minutes,120);assert.equal(groups[0].visits[0].id,'b');
});
test('commercial site snapshots remain frozen after property renaming',()=>{
 const {api,context}=harness();const r=api.saveRecord('invoice',commercial);context.db.properties[0].name='Changed';assert.equal(r.siteSnapshot.name,'Fictional site');assert(api.documentLines(r).includes('name: Fictional site'));
});

test('equipment register keeps latest dated asset records without mixing properties or record types',()=>{
 const {api}=harness();const row=(id,kind,property,asset,date)=>({id,kind,updated:date,values:{property,asset,date}});
 const rows=[row('old','pat','P1','K1','2026-10-01'),row('new','pat','P1','k1','2026-10-02'),row('other','pat','P2','K1','2026-10-01'),row('ext','extinguisher','P1','K1','2026-10-01'),row('missing','equipment','P1','','2026-10-01')];
 const register=api.registerRows(rows);assert.equal(register.length,3);assert(!register.some(r=>r.id==='old'));assert(register.some(r=>r.id==='new'));
});


test('calendar reminder export escapes injection, folds UTF-8 and schedules both alarm windows',()=>{
 const {api}=harness();const r={id:'fictional-event',kind:'service',revision:4,values:{property:'P1',next:'2026-12-01'}};
 const calendar=api.calendarReminders([r],[{id:'P1',name:'Site, one;\nBEGIN:VEVENT — café'+('é'.repeat(80))+'\rEND:VEVENT',address:'Test address',postcode:'TEST'}]);
 assert(calendar.endsWith('\r\n'));for(const line of calendar.split('\r\n'))assert(Buffer.byteLength(line,'utf8')<=75);
 const unfolded=calendar.replace(/\r\n /g,'');assert.match(unfolded,/Site\\, one\\;\\nBEGIN:VEVENT/);assert.match(unfolded,/\\nEND:VEVENT/);
 assert.equal(unfolded.split('\r\n').filter(s=>s==='BEGIN:VEVENT').length,1);
 assert.match(unfolded,/DTSTART;VALUE=DATE:20261201/);assert.match(unfolded,/SEQUENCE:4/);
 for(const days of [30,7])assert.match(unfolded,new RegExp('TRIGGER:-P'+days+'D'));
 const skipped=api.calendarReminders([{...r,kind:'visit',values:{date:'2026-12-01',status:'Cancelled'}},{...r,values:{next:'2026-02-30'}}]);
 assert(!skipped.includes('BEGIN:VEVENT'));
});
test('map handoff uses appointment order, isolates engineer/day and encodes addresses',()=>{
 const {api}=harness(),r=(id,property,time,engineer='A',date='2026-12-01')=>({id,kind:'visit',values:{property,time,engineer,date,status:'Confirmed'}});
 const sites=[{id:'P1',address:'One & Two',postcode:'SW1A 1AA'},{id:'P2',address:'<Site>',postcode:'E1 1AA'},{id:'P3',postcode:'W1 1AA'}];
 const url=new URL(api.routeLink([r('b','P2','10:00'),r('a','P1','09:00'),r('c','P3','11:00')],sites));
 assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('origin'),'One & Two, SW1A 1AA');assert.equal(url.searchParams.get('waypoints'),'<Site>, E1 1AA');assert.equal(url.searchParams.get('destination'),'W1 1AA');
 for(const visits of [[r('a','P1','09:00')],[r('a','P1','09:00'),r('b','P2','10:00','B')],[r('a','P1','09:00'),r('b','P2','10:00','A','2026-12-02')],[r('a','missing','09:00'),r('b','P2','10:00')]])assert.throws(()=>api.routeLink(visits,sites));
 assert.throws(()=>api.routeLink(Array.from({length:11},(_,i)=>r(String(i),'P1','09:00')),sites));
});
test('exact driving optimisation uses asymmetric edges, retains all stops, reports appointment conflicts and rejects incomplete/unreachable matrices',()=>{
 const {api}=harness();const rows=['a','b','c','d'].map((id,i)=>({id,kind:'visit',values:{...visit,time:['09:00','10:00','11:00','12:00'][i],minutes:'30'}}));
 const m={ids:['a','b','c','d'],seconds:[[0,1000,10,50],[20,0,1000,10],[20,10,0,1000],[20,20,20,0]]};
 const r=api.optimiseRoute(rows,m,'a','d');assert.equal(r.visits.map(v=>v.id).join(','),'a,c,b,d');assert.equal(r.seconds,30);assert(r.conflicts.includes('b'));
 assert.equal(rows[1].values.time,'10:00');assert.throws(()=>api.optimiseRoute(rows,{...m,ids:['a','b','c','c']},'a','d'));
 assert.throws(()=>api.optimiseRoute(rows,{...m,seconds:m.seconds.map(()=>[null,null,null,null])},'a','d'));
 assert.throws(()=>api.optimiseRoute(rows,{...m,seconds:[[0,-1],[]]},'a','d'));
 assert.throws(()=>api.optimiseRoute([{...rows[0],values:{...visit,date:'2026-11-02'}},...rows.slice(1)],m,'a','d'));
});

test('same-day visits remain separate, repeat creates fresh identity and job packs use exact visit',()=>{
 const {api}=harness();
 const first=api.saveRecord('quote',{...commercial,number:'VQ1',visitId:'VISIT-ONE',branding:'absolute'});
 const second=api.saveRecord('quote',{...commercial,number:'VQ2',visitId:'VISIT-TWO'});
 assert.notEqual(first.values.visitId,second.values.visitId);
 const pack=api.jobPack({kind:'visit',values:{...visit,visitId:'VISIT-ONE'}});
 assert.match(pack,/VQ1/);assert.doesNotMatch(pack,/VQ2/);
 assert.throws(()=>api.saveRecord('quote',{...commercial,property:'P1',number:'bad',visitId:'../bad'}),/visit ID/);
 const source={id:'completed',kind:'pat',values:{property:'P1',date:'2026-10-26',serviceStatus:'Completed',asset:'A',appliance:'Drill',branding:'absolute',templateRef:'immutable-v1',visitId:'OLD',outcome:'Pass',engineerSignature:'OLD'}};
 const repeated=api.repeatValues(source);assert.equal(repeated.branding,'absolute');assert.equal(repeated.templateRef,'immutable-v1');assert.notEqual(repeated.visitId,'OLD');assert.equal(repeated.outcome,undefined);assert.equal(repeated.engineerSignature,undefined);
});
test('same-day single-asset repeat never aggregates a different explicit visit or ambiguous legacy records',()=>{
 const {api}=harness();const row=(id,visitId,updated)=>({id,kind:'pat',updated,values:{property:'P1',date:'2026-10-26',serviceStatus:'Completed',asset:id,appliance:'Drill',...(visitId?{visitId}:{})}});
 const rows=[row('old','MORNING','2026-10-26T09:00:00Z'),row('latest','AFTERNOON','2026-10-26T15:00:00Z'),row('legacy','','2026-10-26T08:00:00Z')];
 assert.deepEqual(JSON.parse(api.repeatServiceValues(rows,'pat','P1').equipment).map(r=>r.id),['latest']);
});
test('both brands export true contractor and issuer with revision-safe original branding',()=>{
 const {api}=harness();const first=api.saveRecord('quote',{...commercial,branding:'absolute'});
 const text=api.documentLines(first).join('\n');assert.match(text,/Absolute Property Surveys/);assert.match(text,/Service provider \/ contractor: Paramount Fire Protection/);assert.match(text,/Certificate issuer: Paramount Fire Protection/);
 api.setEditing({id:first.id,revision:1});const second=api.saveRecord('quote',{...first.values,branding:'paramount'});
 assert.equal(second.history[0].values.branding,'absolute');assert.equal(first.values.branding,'absolute');
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/absolute-brand-draft.docx',api.wordDocument(first));fs.writeFileSync('test-results/absolute-brand-draft.pdf',api.recordsPdf([first]));fs.writeFileSync('test-results/paramount-brand-draft.pdf',api.recordsPdf([second]));
 assert.match(new TextDecoder().decode(api.wordDocument(first)),/ABSOLUTE PROPERTY SURVEYS/);
 assert.throws(()=>api.validate('quote',{...commercial,branding:'invented'}),/branding/);
});
