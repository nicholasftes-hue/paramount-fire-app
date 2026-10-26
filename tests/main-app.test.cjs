const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function harness(storage=new Map()){
  const context={console,crypto:webcrypto,URL,Date,JSON,Number,Set,Map,Object,Array,String,Error,FormData,Blob,
    sections:[],tab:'test',db:{properties:[{id:'P1',name:'Fictional site'}]},cloudSession:null,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{querySelector:()=>null,getElementById:()=>null,addEventListener:()=>{}},window:{},
    render:()=>{},esc:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    addEventListener:()=>{},setTimeout:()=>{},confirm:()=>true};
  vm.createContext(context);
  let source=fs.readFileSync('main-app.js','utf8').replace('window.ParamountMainApp={totals,','window.ParamountMainApp={setEditing:v=>editing=v,saveRecord,merge,read,load,exportData,totals,');
  vm.runInContext(source,context);
  return {api:context.window.ParamountMainApp,context,storage};
}
const commercial={property:'P1',date:'2026-10-26',due:'2026-11-26',number:'Q1',customer:'Fictional customer',address:'Fictional address',lines:'Service | 3 | 0.10',vat:'20',vatNumber:'TEST ONLY',terms:'Draft only',reviewed:'yes'};
const visit={property:'P1',date:'2026-11-01',engineer:'Engineer A',time:'09:00',minutes:'60',serviceType:'Fire alarm',status:'Confirmed',notes:'Fictional visit',reviewed:'yes'};
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
