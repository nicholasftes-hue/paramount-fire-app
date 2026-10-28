const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {Engine,Transport,SyncError,config}=require('../team-sync.js');
const workspace=randomUUID(),property=randomUUID();
const settings={mode:'isolated-test',url:'http://127.0.0.1:54321',workspace,publicKey:'sb_publishable_fixture'};
const site=(name='Fictional site')=>({id:property,kind:'property',property_id:null,payload:{id:property,name,panel:'TEST',last:'2026-10-27',months:'6'}});
function storage(){const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}}
function server(){
  const rows=new Map(),ops=new Map();let online=true,allowed=true,lose=false,calls=0;
  return {rows,ops,set online(v){online=v},set allowed(v){allowed=v},set lose(v){lose=v},get calls(){return calls},
    async list(){if(!online)throw new SyncError('network');if(!allowed)throw new SyncError('forbidden');return structuredClone([...rows.values()])},
    async put(p){calls++;if(!online)throw new SyncError('network');if(!allowed)throw new SyncError('forbidden');
      if(ops.has(p.p_operation)){assert.deepEqual(ops.get(p.p_operation).p,p);return structuredClone(ops.get(p.p_operation).r)}
      const old=rows.get(p.p_id);if((old?.version||0)!==p.p_expected)throw new SyncError('conflict');
      if(p.p_kind!=='property')assert(rows.has(p.p_property),'parent must be uploaded first');
      const r={id:p.p_id,kind:p.p_kind,property_id:p.p_property,payload:structuredClone(p.p_payload),version:p.p_expected+1};
      rows.set(r.id,r);ops.set(p.p_operation,{p:structuredClone(p),r:structuredClone(r)});if(lose){lose=false;throw new SyncError('network')}return r;
    }};
}
const engine=(transport,store=storage(),key='test-user-a')=>new Engine({storage:store,key,transport});
function record(kind){const id=randomUUID();return {id,kind,property_id:property,payload:{id,kind,revision:1,history:[],values:{property,reviewed:'yes',date:'2026-10-27',tests:'Fictional result'},siteSnapshot:{id:property,name:'Frozen fictional site'}}}}
test('configuration has no defaults; rejects unsafe URL, secret JWT and service keys',()=>{
  assert.equal(config(settings).url,'http://127.0.0.1:54321');
  for(const c of [null,{...settings,mode:'production'},{...settings,url:'https://example.com'}, {...settings,url:'http://remote.supabase.co'}, {...settings,url:'https://wrong.supabase.co',testProjectRef:'expected'}, {...settings,url:'http://x:y@localhost'}, {...settings,publicKey:'sb_secret_no'}, {...settings,publicKey:'x.'+Buffer.from('{"role":"service_role"}').toString('base64url')+'.x'}])assert.throws(()=>config(c));
});
test('offline saves are durable across reload, account/config separated, and never send drafts',async()=>{
  const s=server(),store=storage(),a=engine(s,store);s.online=false;a.stage(site());const r=record('pat');a.writeWorkspace({records:[r.payload],drafts:{pat:{values:{secretDraft:'unfinished'}}}});
  await assert.rejects(a.sync(),{code:'network'});assert.equal(engine(s,store).workspace().records.length,1);assert.equal(engine(s,store,'other-user').properties().length,0);
  s.online=true;await engine(s,store).sync();assert.equal(s.rows.size,2);assert(!JSON.stringify([...s.rows.values()]).includes('secretDraft'));assert.equal(a.workspace().drafts.pat.values.secretDraft,'unfinished');
});
test('three staff replicas converge for properties, fire service, PAT, lighting and frozen site details',async()=>{
  const s=server(),a=engine(s),b=engine(s),c=engine(s);a.stage(site());for(const kind of ['service','pat','lighting'])a.stage(record(kind));await a.sync();await b.sync();await c.sync();
  assert.deepEqual(b.workspace().records,c.workspace().records);assert.equal(b.workspace().records.length,3);b.stage(site('Renamed site'));await b.sync();await a.sync();assert.equal(a.properties()[0].name,'Renamed site');assert.equal(a.workspace().records[0].siteSnapshot.name,'Frozen fictional site');
});
test('concurrent edits retain both copies and require an explicit conflict decision',async()=>{
  const s=server(),a=engine(s),b=engine(s);a.stage(site());await a.sync();await b.sync();a.stage(site('A'));b.stage(site('B'));await a.sync();await b.sync();
  assert.equal(b.read().docs[property].local.payload.name,'B');assert.equal(b.read().docs[property].remote.payload.name,'A');assert.equal(s.rows.get(property).payload.name,'A');
  assert.throws(()=>b.stage(site('silent overwrite')),{code:'conflict'});b.resolve(property,'local');await b.sync();assert.equal(s.rows.get(property).payload.name,'B');await a.sync();assert.equal(a.properties()[0].name,'B');
});
test('choosing cloud version keeps latest data and clears the queue',async()=>{
  const s=server(),a=engine(s),b=engine(s);a.stage(site());await a.sync();await b.sync();a.stage(site('Cloud'));b.stage(site('Local'));await a.sync();await b.sync();b.resolve(property,'cloud');assert.equal(b.properties()[0].name,'Cloud');assert.equal(b.read().docs[property].dirty,false);
});
test('lost response retries the identical operation after reload without another revision',async()=>{
  const s=server(),store=storage(),a=engine(s,store);a.stage(site());s.lose=true;await assert.rejects(a.sync(),{code:'network'});const op=a.read().docs[property].pending;
  const b=engine(s,store);await b.sync();assert.equal(s.rows.get(property).version,1);assert.equal(s.ops.size,1);assert.equal(s.calls,2);assert(!b.read().docs[property].pending);assert(s.ops.has(op.p_operation));
});
test('edits made while an upload is in flight remain queued after acknowledgement',async()=>{
  const s=server(),put=s.put.bind(s);let resume,entered;const waiting=new Promise(r=>entered=r);s.put=async p=>{entered();await new Promise(r=>resume=r);return put(p)};
  const a=engine(s);a.stage(site('First'));const syncing=a.sync();await waiting;a.stage(site('Second'));resume();await syncing;assert.equal(a.read().docs[property].dirty,true);assert.equal(a.properties()[0].name,'Second');s.put=put;await a.sync();assert.equal(s.rows.get(property).version,2);assert.equal(s.rows.get(property).payload.name,'Second');
});
test('network, denied access and expired auth never clear unsent records',async()=>{
  const s=server(),a=engine(s);a.stage(site());s.allowed=false;await assert.rejects(a.sync(),{code:'forbidden'});assert(a.read().docs[property].dirty);s.allowed=true;await a.sync();
  for(const status of [401,403,500]){const t=new Transport(settings,async()=>({ok:false,status}));t.session={access_token:'fixture'};await assert.rejects(t.list(),{code:status===401?'auth':status===403?'forbidden':'network'});if(status===401)assert.equal(t.session,null)}
});
test('malformed storage, malformed remote rows and storage quota errors cannot replace good data',async()=>{
  const s=server(),store=storage();store.setItem('test-user-a','{broken');assert.throws(()=>engine(s,store),{code:'storage'});assert.equal(store.getItem('test-user-a'),'{broken');
  const a=engine(s);a.stage(site());const before=JSON.stringify(a.read());s.list=async()=>[{...site(),version:0}];await assert.rejects(a.sync(),{code:'invalid'});assert.equal(JSON.stringify(a.read()),before);
  const full={getItem:()=>null,setItem:()=>{throw Error('quota')}};assert.throws(()=>engine(server(),full).stage(site()),/quota/);
});
test('child uploads wait for conflicting or unsynced properties and invalid identities are rejected',async()=>{
  const s=server(),a=engine(s);const r=record('lighting');a.stage(r);await a.sync();assert.equal(s.rows.size,0);a.stage(site());await a.sync();assert.equal(s.rows.size,2);
  assert.throws(()=>a.stage({...r,property_id:randomUUID()}),{code:'invalid'});assert.throws(()=>a.stage({...r,kind:'unknown'}),{code:'invalid'});
});
test('transport never persists auth; uses only configured endpoint and redacts server errors',async()=>{
  const requests=[];const id=randomUUID();const t=new Transport(settings,async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url.includes('/token?')?{user:{id},access_token:'token-fixture'}:[]}});
  assert.equal(await t.login('fictional@example.invalid','fictional'),id);assert(requests.every(r=>r.url.startsWith(settings.url)));assert.equal(requests[1].options.headers.Authorization,'Bearer token-fixture');assert.equal(requests[1].options.credentials,'omit');t.logout();assert.equal(t.session,null);
});
test('JSONB key reordering does not break acknowledgement or create phantom local edits',async()=>{
  const s=server(),put=s.put.bind(s);s.put=async p=>{const r=await put(p);r.payload=Object.fromEntries(Object.entries(r.payload).reverse());return r};
  const a=engine(s);a.stage(site());await a.sync();assert.equal(a.read().docs[property].dirty,false);assert.equal(s.rows.get(property).version,1);
});
test('keeping a conflicted engineering record rebases onto cloud history without losing local results',async()=>{
  const s=server(),a=engine(s),b=engine(s);a.stage(site());const r=record('service');a.stage(r);await a.sync();await b.sync();
  const revision=(label)=>({...r,payload:{...r.payload,revision:2,values:{...r.payload.values,tests:label},history:[{revision:1,values:r.payload.values,updated:'fixture',siteSnapshot:r.payload.siteSnapshot}]}});
  a.stage(revision('Cloud results'));b.stage(revision('Local results'));await a.sync();await b.sync();b.resolve(r.id,'local');
  const rebased=b.workspace().records[0];assert.equal(rebased.values.tests,'Local results');assert.equal(rebased.revision,3);assert.equal(rebased.history.at(-1).values.tests,'Cloud results');await b.sync();assert.equal(s.rows.get(r.id).payload.values.tests,'Local results');
});
test('permission-filtered sync hides inaccessible records while retaining offline recovery data; regrant restores visibility',async()=>{
 const s=server(),a=engine(s);a.stage(site());const r=record('pat');a.stage(r);await a.sync();
 const all=s.list.bind(s);s.list=async()=>[];await a.sync();assert.equal(a.properties().length,0);assert.equal(a.workspace().records.length,0);assert(a.read().docs[r.id].local);assert.throws(()=>a.stage(r),{code:'forbidden'});
 s.list=all;await a.sync();assert.equal(a.properties().length,1);assert.equal(a.workspace().records.length,1);
});
