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
  let source=fs.readFileSync('main-app.js','utf8').replace('window.ParamountMainApp={servicePdf,totals,','window.ParamountMainApp={setEditing:v=>editing=v,saveProperty,siteDetails,saveRecord,merge,read,load,exportData,prepareRepeat,servicePdf,totals,');
  vm.runInContext(source,context);
  return {api:context.window.ParamountMainApp,context,storage};
}

const item={id:'K-001',description:'Kettle',location:'Kitchen',specification:'Class I',result:'Pass',readings:'0.12 ohm',duration:'180',defects:'Previous defect',actions:'Previous repair'};
const completed={id:'old',kind:'pat',revision:1,history:[],updated:'2026-10-27T12:00:00Z',values:{property:'P1',date:'2026-10-27',engineer:'Previous engineer',instrument:'Previous tester',calibration:'Old calibration',asset:'BATCH',appliance:'Register',location:'All rooms',equipmentClass:'See rows',visual:'Old visual',tests:'Old readings',outcome:'Pass',defects:'Old defects',reviewed:'yes',serviceStatus:'Completed',engineerSignature:'Old signature',customerSignature:'Old customer',engineerSigned:'2026-10-27',next:'2027-01-01',declaration:'Old declaration',equipment:JSON.stringify([item])}};
test('repeating each engineering type copies only stable fields and resets every evidence field',()=>{
 const {api}=harness();
 for(const kind of ['service','pat','lighting','extinguisher','installation','callout']){
  const source=JSON.parse(JSON.stringify(completed));source.kind=kind;Object.assign(source.values,{system:'Panel',panelSerial:'S1',zones:'Z1 / Hall',batteryAh:'7',batteryVoltage:'24.3',batteryModel:'Battery',batteryCount:'2',model:'Model',capacity:'6L',manufactured:'2020',lastTest:'2026-01-01',devices:'D1 / Hall',duration:'180'});
  const before=JSON.stringify(source),v=api.repeatValues(source);
  assert.equal(JSON.stringify(source),before);assert.equal(v.property,'P1');assert.equal(v.serviceStatus,'In progress');assert.equal(v.testState,'Not Tested');assert.equal(v.reviewed,'');
  for(const key of ['tests','engineerSignature','customerSignature','engineerSigned','customerSigned','batteryVoltage','duration','next','lastTest','declaration','defects','actions','instrument','calibration'])assert.equal(v[key],undefined,key);
  const row=JSON.parse(v.equipment)[0];assert.equal(row.id,item.id);assert.equal(row.location,item.location);assert.equal(row.result,'Not Tested');
  for(const key of ['readings','duration','defects','actions'])assert.equal(row[key],'');
 }
 assert.throws(()=>api.repeatValues({...completed,values:{...completed.values,serviceStatus:''}}),/completed/);
});
test('latest completed selection respects property, kind and date; old reviewed drafts are excluded',()=>{
 const {api}=harness();const newer={...completed,id:'new',values:{...completed.values,date:'2026-10-28'}};
 const draft={...completed,id:'draft',values:{...completed.values,date:'2026-10-29',serviceStatus:'In progress'}};
 assert.equal(api.latestCompleted([completed,draft,newer],'pat','P1').id,'new');
 assert.equal(api.latestCompleted([completed],'lighting','P1'),undefined);
 assert.equal(api.latestCompleted([completed],'pat','P2'),undefined);
});
test('batch repeat saves as a new record; old record and history remain byte-identical; offline reopen retains new draft',()=>{
 const {api,storage}=harness();api.merge({application:'paramount-main-app',version:1,scope:'device-guest',records:[completed]});
 const before=JSON.stringify(api.read().records[0]),v=api.repeatValues(completed);
 Object.assign(v,{engineer:'New engineer',instrument:'Current instrument',calibration:'Current calibration',reviewed:'yes'});
 const saved=api.saveRecord('pat',v);assert.notEqual(saved.id,'old');assert.equal(saved.revision,1);assert.equal(saved.history.length,0);
 assert.match(saved.values.tests,/Not Tested/);assert.doesNotMatch(saved.values.tests,/0.12 ohm/);
 assert.equal(JSON.stringify(api.read().records.find(r=>r.id==='old')),before);
 assert.equal(harness(storage).api.read().records.length,2);
 const key='paramount-main-app-v1:device-guest',data=JSON.parse(storage.get(key));data.drafts.pat={values:v,editing:null,updated:'2026-10-29'};storage.set(key,JSON.stringify(data));
 assert.equal(harness(storage).api.read().drafts.pat.values.equipment,v.equipment);
});
test('batch validation rejects duplicate IDs, unknown outcomes, failures without defects and incomplete annual tests',()=>{
 const {api}=harness();assert.throws(()=>api.equipmentRows(JSON.stringify([item,{...item,id:' k-001 '}])) ,/unique/);
 assert.throws(()=>api.equipmentRows(JSON.stringify([{...item,result:'Copied pass'}])),/Choose/);
 assert.throws(()=>api.validate('pat',{...completed.values,equipment:JSON.stringify([{...item,result:'Fail',defects:''}])}),/defect/);
 assert.throws(()=>api.validate('pat',{...completed.values,equipment:JSON.stringify([{...item,result:'Not Tested'}])}),/Not Tested/);
 assert.throws(()=>api.validate('lighting',{...completed.values,system:'L1',testType:'Annual full-duration test',actions:'Notify',equipment:JSON.stringify([{...item,duration:''}])}),/duration/);
});
test('consolidated batch Word and PDF include unique assets, new readings and professional draft headers',()=>{
 const {api}=harness();const r={...completed,values:{...completed.values,equipment:JSON.stringify([item,{...item,id:'K-002',readings:'0.21 ohm'}])}};
 const lines=api.documentLines(r).join('\n');assert.match(lines,/K-001/);assert.match(lines,/K-002/);assert.match(lines,/0.21 ohm/);
 const word=api.wordDocument(r),pdf=api.recordsPdf([r]);assert.ok(word.length>1000);assert.match(pdf,/^%PDF-1.4/);
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/batch-pat.docx',word);fs.writeFileSync('test-results/batch-pat.pdf',pdf,'binary');
});

test('repeat entire visit prepares independent new drafts atomically without changing saved records',()=>{
 const {api,context}=harness();
 const fire={...completed,id:'fire',kind:'service',values:{...completed.values,system:'Panel',standard:'Agreed scope',battery:'Not inspected',measurements:'Current observations',actions:'Notify',recipient:'Owner',declaration:'Recorded scope'}};
 api.merge({application:'paramount-main-app',version:1,scope:'device-guest',records:[completed,fire]});
 const before=JSON.stringify(api.read().records);api.load();api.prepareRepeat('pat','P1',true);
 const data=api.read();assert.equal(JSON.stringify(data.records),before);
 for(const kind of ['pat','service']){assert.equal(data.drafts[kind].editing,null);assert.equal(data.drafts[kind].values.serviceStatus,'In progress');assert.equal(data.drafts[kind].values.engineerSignature,undefined)}
 context.confirm=()=>false;const prior=JSON.stringify(api.read());api.prepareRepeat('pat','P1',true);assert.equal(JSON.stringify(api.read()),prior);
});

test('batch extinguishers save frozen sites, per-asset history and reset only stable details',()=>{
 const {api}=harness();
 const rows=[{id:'EX-1',serial:'SER-1',model:'Fictional model',capacity:'6L foam',manufactured:'2020',location:'Hall',lastTest:'2025-01-01',next:'2027-01-01',result:'Pass',readings:'Gauge in recorded range',defects:'',actions:''},{id:'EX-2',model:'Fictional CO2',capacity:'2kg CO2',location:'Office',result:'Fail',readings:'Weight recorded',defects:'Damaged hose',actions:'Replacement advised'}];
 const v={property:'P1',date:'2026-10-29',engineer:'Fictional engineer',visitType:'Basic service',reviewed:'yes',serviceStatus:'Completed',testState:'Tested within recorded scope',equipment:JSON.stringify(rows)};
 const r=api.saveRecord('extinguisher',v);assert.equal(r.siteSnapshot.name,'Fictional site');assert.equal(api.registerRows([r]).length,2);
 const repeated=JSON.parse(api.repeatValues(r).equipment);assert.equal(repeated[0].serial,'SER-1');assert.equal(repeated[0].lastTest,undefined);assert.equal(repeated[0].next,undefined);assert.equal(repeated[1].result,'Not Tested');assert.equal(repeated[1].defects,'');
 assert.throws(()=>api.saveRecord('extinguisher',{...v,equipment:JSON.stringify([{...rows[0],model:''}])}),/model/);
 fs.writeFileSync('test-results/batch-extinguisher.docx',api.wordDocument(r));fs.writeFileSync('test-results/batch-extinguisher.pdf',api.recordsPdf([r]),'binary');
});
test('structured fire devices retain zone/address/type, reject incomplete identity and export every result',()=>{
 const {api}=harness();const row={id:'DEV-1',zone:'Z1',address:'L1:001',deviceType:'Smoke detector',location:'Hall',specification:'Fictional model',result:'Pass',readings:'Fictional current functional test',defects:'',actions:''};
 const v={property:'P1',date:'2026-10-29',engineer:'Fictional engineer',system:'Fictional panel',standard:'Recorded scope only',battery:'Not inspected',measurements:'Fictional instrument',defects:'None in stated scope',actions:'Fictional handover',recipient:'Fictional person',declaration:'Recorded scope only',reviewed:'yes',equipment:JSON.stringify([row])};
 const r=api.saveRecord('service',v);const lines=api.documentLines(r).join('\n');assert.match(lines,/SYSTEM \/ PANEL \/ BATTERIES/);assert.match(lines,/L1:001/);assert.match(lines,/Smoke detector/);
 assert.throws(()=>api.saveRecord('service',{...v,equipment:JSON.stringify([{...row,zone:''}])}),/zone/);
 const before=JSON.stringify(r);const repeat=api.repeatValues({...r,values:{...r.values,serviceStatus:'Completed'}});assert.equal(JSON.parse(repeat.equipment)[0].zone,'Z1');assert.equal(JSON.parse(repeat.equipment)[0].readings,'');assert.equal(JSON.stringify(r),before);
 const html=api.certificateHtml({...r,values:{...r.values,defects:'<script>evil</script>'}});assert.doesNotMatch(html,/<script>evil/);assert.match(html,/&lt;script&gt;/);
 fs.writeFileSync('test-results/structured-fire.docx',api.wordDocument(r));fs.writeFileSync('test-results/structured-fire.pdf',api.recordsPdf([r]),'binary');
});
test('legacy sources remain unmodified and unavailable across account/team boundaries',()=>{
 const {api,context}=harness();const original={id:'old',property:'P1',date:'2024-01-01',engineer:'Old signer',notes:'Old evidence',battery:'Satisfactory'};context.db.services=[original];
 const before=JSON.stringify(context.db);assert.equal(api.legacyHistory('P1').length,1);const draft=api.legacyDraft('services',0,'P1');assert.equal(draft.kind,'service');assert.equal(draft.values.testState,'Not Tested');assert.equal(draft.values.engineer,undefined);assert.equal(draft.values.tests,undefined);assert.equal(draft.values.serviceStatus,'In progress');assert.match(draft.values.legacySource,/Old evidence/);assert.equal(JSON.stringify(context.db),before);
 context.cloudSession={user:{id:'other'}};assert.equal(api.legacyHistory('P1').length,0);assert.throws(()=>api.legacyDraft('services',0,'P1'),/unavailable/);
 context.cloudSession=null;context.window.ParamountTeamSync={scope:()=> 'team'};assert.equal(api.legacyHistory('P1').length,0);
});
