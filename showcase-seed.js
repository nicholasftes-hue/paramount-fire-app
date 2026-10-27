/* Fictional fixtures. These are demonstration observations, never approved certificates. */
(() => {
 const k='paramount-mark-full-20261027-workspace:mark-fictional-showcase';if(localStorage.getItem(k))return;
 const shared={property:'P001',date:'2026-10-27',reviewed:'yes'};
 const entries=[
 ['service',{engineer:'Alex Demo',system:'Fictional conventional panel',standard:'Demonstration scope only',tests:'Fictional zone 1 observation recorded; no physical tests performed',battery:'Not inspected',measurements:'No measurements — fictional demonstration',defects:'Fictional detector label requires review',actions:'Prepare draft quotation for review',recipient:'Taylor Example',declaration:'Demonstration record only',next:'2026-11-03'}],
 ['pat',{engineer:'Alex Demo',instrument:'DEMO-TESTER',calibration:'Fictional reference',asset:'DEMO-K01',appliance:'Kettle',location:'Fictional kitchen',equipmentClass:'Class I',visual:'Fictional observation only',tests:'No physical test performed; demo readings only',outcome:'Not tested / inaccessible',defects:'Demonstration only',next:'2027-10-27'}],
 ['lighting',{engineer:'Alex Demo',system:'DEMO-L01',location:'Fictional stairwell',testType:'Visual inspection',duration:'',tests:'Fictional visual record; no duration test performed',defects:'Fictional diffuser damage',actions:'Draft replacement proposal',next:'2026-11-10'}],
 ['extinguisher',{engineer:'Alex Demo',asset:'DEMO-E01',location:'Fictional entrance',model:'Fictional demonstration unit',capacity:'Demo water type, 6 L',visitType:'Inspection only',tests:'No physical inspection performed',outcome:'Not serviced / inaccessible',defects:'Fictional record only',next:'2027-10-27'}],
 ['installation',{engineer:'Alex Demo',stage:'Installation record',system:'Fictional training system',standard:'Demonstration specification',drawingRef:'DEMO-D01',devices:'Fictional detector and call point',tests:'No installation or tests performed',defects:'All physical acceptance outstanding',actions:'Example handover only',recipient:'Taylor Example',declaration:'Not commissioned; fictional draft'}],
 ['quote',{number:'DEMO-Q-001',customer:'Fictional Oak House Ltd',address:'1 Example Lane, Fictional Town',due:'2026-11-27',lines:'Demonstration service visit | 1 | 120.00\nDemonstration replacement fitting | 2 | 35.00',vat:'20',vatNumber:'DEMO — NOT A VAT NUMBER',source:'DEMO-J001',terms:'Demonstration only. No offer or payment requested.'}],
 ['invoice',{number:'DEMO-I-001',customer:'Fictional Riverside Ltd',address:'2 Sample Road, Fictional Town',due:'2026-11-27',lines:'Demonstration survey | 1 | 95.00',vat:'0',source:'DEMO-Q-000',terms:'Not issued. No payment requested.'}],
 ['visit',{engineer:'Alex Demo',time:'09:00',minutes:'60',serviceType:'Fire alarm',status:'Confirmed',notes:'Fictional visit; no real access arrangements'}],
 ['callout',{engineer:'Alex Demo',number:'DEMO-C001',priority:'Routine',status:'Open',issue:'Fictional fitting damage',defects:'Example recorded defect',actions:'Draft repair proposal',next:'2026-11-03'}],
 ['enquiry',{customer:'Jordan Example',contact:'demo@example.invalid',site:'Fictional Riverside Lodge',status:'Survey needed',owner:'Sam Demo',notes:'Example request for a service quotation',next:'2026-10-30'}],
 ['drawing',{title:'Fictional Oak House — revision 1',layout:'Entrance | 0 | 0 | 45 | 40\nHallway | 45 | 0 | 20 | 100\nOffice | 0 | 40 | 45 | 60\nKitchen | 65 | 0 | 35 | 100',markers:'Demo detector | 55 | 25\nDemo call point | 55 | 75',notes:'Fictional layout, not to scale; prototype coordinate editor'}],
 ['equipment',{manufacturer:'Fictional manufacturer',model:'DEMO-PANEL',title:'Placeholder reference only',url:'https://example.invalid/disabled',checked:'2026-10-27',notes:'Verified official manuals: Coming Soon. External access disabled.'}]
 ];
 const records=entries.map(([kind,v],i)=>({id:'demo-record-'+i,kind,values:{...shared,...v},revision:1,history:[],created:'2026-10-27T09:00:00.000Z',updated:'2026-10-27T09:00:00.000Z'}));
 localStorage.setItem(k,JSON.stringify({version:1,records,drafts:{}}));
})();
