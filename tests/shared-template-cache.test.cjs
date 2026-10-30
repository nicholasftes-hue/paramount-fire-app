const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {create,TTL}=require('../shared-template-cache.js'),{create:adapter}=require('../shared-templates.js'),pdf=require('../imported-pdf.js');
const id='00000000-0000-4000-8000-000000000001',family='00000000-0000-4000-8000-000000000002';
const bytes=fs.readFileSync('templates/Paramount_Invoice_Fillable.pdf');
const template={id,family,version:1,name:'Shared invoice',company:'absolute',property:'',kind:'invoice',filename:'blank.pdf',format:'pdf',hash:crypto.createHash('sha256').update(bytes).digest('hex'),content:bytes.toString('base64'),active:true,mappings:[{name:'Engineer',fields:{prepared_by:'engineer'}}]};
function setup(){let scope='workspace-a:user-a',online=true,now=100000,rows=[structuredClone(template)],getError=null,listCalls=0;const saved=new Map();
 const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
 const library=adapter({scope:()=>scope,inspect:async(n,b)=>pdf.inspect(b),mappingSources:['engineer'],rpc:async(n,a)=>{if(n.endsWith('_list')){listCalls++;return rows.map(({content,...t})=>t);}if(getError)throw Error(getError);return rows.find(t=>t.id===a.p_id);}});
 const options={library,storage,scope:()=>scope,online:()=>online,clock:()=>now};
 return {cache:create(options),options,saved,storage,library,setScope:x=>scope=x,setOnline:x=>online=x,setTime:x=>now=x,setRows:x=>rows=x,setError:x=>getError=x,listCalls:()=>listCalls};
}
test('shared offline snapshot survives reload, verifies bytes, pins immutable mappings and expires',async()=>{
 const x=setup();await x.cache.refresh();assert.equal(x.listCalls(),2);x.setOnline(false);const reloaded=create(x.options);await reloaded.load();const t=await reloaded.get(id);assert.equal(t.hash,template.hash);assert.deepEqual(t.mappings,template.mappings);t.mappings[0].fields.prepared_by='bad';assert.equal(reloaded.rows()[0].mappings[0].fields.prepared_by,'engineer');x.setTime(100001+TTL);assert.equal(reloaded.rows().length,0);await assert.rejects(()=>reloaded.get(id),/unavailable/);await assert.rejects(()=>create(x.options).load(),/expired/);
});
test('refresh replaces authorisation snapshot, preserves historical versions and removes revoked entries',async()=>{
 const x=setup();await x.cache.refresh();x.setRows([{...template,active:false}]);await x.cache.refresh();assert.equal(x.cache.rows()[0].active,false);assert.equal((await x.cache.get(id)).hash,template.hash);x.setRows([]);await x.cache.refresh();assert.deepEqual(x.cache.rows(),[]);await assert.rejects(()=>x.cache.get(id),/unavailable/);
});
test('online denial and partial refresh persist a blocked cache without presenting stale bytes',async()=>{
 for(const action of ['get','refresh']){const x=setup();await x.cache.refresh();x.setError('Access denied');await assert.rejects(()=>x.cache[action](id),/Access denied/);assert.deepEqual(x.cache.rows(),[]);await assert.rejects(()=>create(x.options).load(),/invalid/);}
});
test('tampering, cross-account snapshots, malformed metadata and quota failure fail closed',async()=>{
 const x=setup();await x.cache.refresh();const key=[...x.saved.keys()][0],good=x.saved.get(key),data=JSON.parse(good);data.templates[0].content=btoa('tampered');x.saved.set(key,JSON.stringify(data));await assert.rejects(()=>create(x.options).load(),/hash/);
 x.saved.set(key,good);x.setScope('workspace-a:user-b');assert.deepEqual(x.cache.rows(),[]);assert.deepEqual(await create(x.options).load(),[]);
 x.setScope('workspace-a:user-a');x.storage.setItem=()=>{throw Error('Quota')};await assert.rejects(()=>x.cache.refresh(),/Quota/);assert.deepEqual(x.cache.rows(),[]);
 await assert.rejects(()=>x.library.verify({...template,active:'true'}),/Invalid/);
});
test('account switches during inspection and racing refreshes never commit into another workspace',async()=>{
 const x=setup();const original=x.library.get;x.library.get=async id=>{const t=await original(id);x.setScope('workspace-b:user-a');return t;};await assert.rejects(()=>x.cache.refresh(),/changed/);assert.deepEqual(x.cache.rows(),[]);
 const y=setup();let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r),get=y.library.get;let count=0;y.library.get=async id=>{if(count++===0){entered();await gate;}return get(id)};const first=assert.rejects(y.cache.refresh(),/changed/);await started;await y.cache.refresh();release();await first;assert.equal(y.cache.rows().length,1);
});
test('double-list refresh detects publication/deactivation races and duplicate IDs',async()=>{
 const x=setup(),list=x.library.list;let count=0;x.library.list=async()=>{const rows=await list();return ++count===2?rows.map(t=>({...t,active:false})):rows;};await assert.rejects(()=>x.cache.refresh(),/changed/);assert.deepEqual(x.cache.rows(),[]);
 const y=setup();y.setRows([template,template]);await assert.rejects(()=>y.cache.refresh(),/Duplicate/);
});
test('engineer and office controls use only scoped shared templates and exact PDF mapping revisions',async()=>{
 const x=setup();await x.cache.refresh();const team={scope:()=>x.options.scope()},t=x.cache.rows()[0],m={...t.mappings[0],id:t.id+':0',templateId:t.id,templateHash:t.hash};
 const context={TextEncoder,TextDecoder,Uint8Array,DataView,Blob,DecompressionStream,crypto:crypto.webcrypto,btoa,atob,URL,console,setTimeout,window:{ParamountTeamSync:team,ParamountTeamTemplates:{rows:x.cache.rows,getMapping:id=>id===m.id?m:null,mappings:()=>[m]}},document:{addEventListener(){},querySelector(){return null}},localStorage:{getItem(){throw Error('Personal library must not be read');}}};vm.createContext(context);for(const f of ['imported-pdf.js','document-templates.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context);const api=context.window.ParamountTemplates;
 assert(api.controls('service',team.scope()));assert.equal(api.get(id,team.scope()).hash,template.hash);assert.equal(api.getMapping(m.id,team.scope()).templateHash,t.hash);
 const form={dataset:{mainForm:'invoice',savedTemplate:id,savedTemplateMapping:m.id},elements:{templateRef:{value:''},templateMappingRef:{value:''},property:{value:''},branding:{value:'absolute'}}};api.restore(form,team.scope());assert.equal(form.elements.templateRef.value,id);assert.match(form.elements.templateMappingRef.innerHTML,/Engineer/);assert.equal(form.elements.templateMappingRef.value,m.id);
 const output=await api.populatePDF(t,m,{engineer:'Fictional Engineer',reference:'TEST',revision:'1',branding:'Absolute Property Surveys',contractor:'Paramount Fire Protection'});assert.equal(output.type,'application/pdf');
 x.setScope('different');assert.equal(api.get(id,team.scope()),undefined);
});
