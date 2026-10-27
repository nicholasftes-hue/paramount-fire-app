const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const context={console,crypto:require('node:crypto').webcrypto,URL,Date,JSON,Number,Set,Map,Object,Array,String,Error,FormData,Blob,sections:[],tab:'test',db:{properties:[{id:'P1',name:'Fictional property',postcode:'BL1 1AA'},{id:'P2',name:'Fictional second property',postcode:'BL1 2AA'}]},cloudSession:null,localStorage:{getItem:()=>null,setItem:()=>{}},document:{querySelector:()=>null,getElementById:()=>null,addEventListener:()=>{}},window:{},render:()=>{},esc:String,addEventListener:()=>{},setTimeout:()=>{},confirm:()=>true};
 vm.createContext(context);vm.runInContext(fs.readFileSync('main-app.js','utf8'),context);return context.window.ParamountMainApp;
}
const service={property:'P1',date:'2026-10-27',engineer:'Fictional engineer',system:'Fictional panel',standard:'Agreed scope',tests:'Fictional test',battery:'Satisfactory',measurements:'Fictional readings',defects:'Fictional limitation',actions:'Fictional advice',recipient:'Fictional recipient',declaration:'Training draft',reviewed:'yes'};
test('battery fields preserve older records and validate explicitly entered readings',()=>{
 const api=harness();api.validate('service',service);api.validate('service',{...service,batteryVoltage:'24.125',batteryAh:'7'});
 for(const v of ['-1','NaN','Infinity','1e2','10001','1.0001'])assert.throws(()=>api.validate('service',{...service,batteryVoltage:v}));
 assert.throws(()=>api.validate('service',{...service,battery:'Not inspected',batteryVoltage:'24'}));
 api.validate('service',{...service,batteryVoltage:'0',batteryAh:''});
});
test('PAT next appliance keeps setup but never copies results, asset identity or review',()=>{
 const api=harness(),v={property:'P1',date:'2026-10-27',engineer:'Test',instrument:'I1',calibration:'C1',appliance:'Kettle',location:'Kitchen',equipmentClass:'Class I',next:'2027-10-27',asset:'A1',visual:'Old result',tests:'0.1 ohm',outcome:'Pass within recorded test scope',defects:'None observed',reviewed:'yes'};
 const next=api.nextPatDraft(v);assert.equal(next.instrument,'I1');assert.equal(next.location,'Kitchen');
 for(const key of ['asset','visual','tests','outcome','defects','reviewed'])assert(!Object.hasOwn(next,key));assert.throws(()=>api.validate('pat',next));
});
test('planner groups by date and postcode district and totals on-site time without implying travel time',()=>{
 const api=harness(),visit=(property,date,minutes)=>({values:{property,date,minutes}}),groups=api.groupVisits([visit('P1','2026-10-27','60'),visit('P2','2026-10-27','30'),visit('P1','2026-10-28','20'),visit('missing','2026-10-27','15')]);
 const shared=groups.find(g=>g.area==='BL1'&&g.date==='2026-10-27');assert.equal(shared.minutes,90);assert.equal(shared.sites.size,2);assert.equal(groups.length,3);assert(groups.some(g=>g.area==='UNASSIGNED'));
});
