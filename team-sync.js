/* Isolated team-sync protocol. No default endpoint, credentials or network calls. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.ParamountSync=api})(globalThis,()=>{
  'use strict';
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const kinds=['property','service','pat','lighting','extinguisher','installation','quote','invoice','visit','callout','enquiry','drawing','equipment'];
  const copy=x=>JSON.parse(JSON.stringify(x));
  const canonical=x=>x&&typeof x==='object'?(Array.isArray(x)?x.map(canonical):Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]))):x;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  class SyncError extends Error{constructor(code){super({conflict:'Cloud record changed. Keep both copies and review before retrying.',auth:'Sign in again. Local changes are retained.',forbidden:'Staff access is unavailable. Local changes are retained.',network:'Cloud unavailable. Changes remain queued on this device.',storage:'Local sync storage is unreadable. Export raw recovery data before continuing.',busy:'Another tab changed this workspace. Reload before saving.',invalid:'Invalid sync data. Nothing was replaced.'}[code]||'Sync failed. Local changes are retained.');this.code=code}}
  function config(c){
    if(!c||c.mode!=='isolated-test'||!uuid.test(c.workspace)||typeof c.publicKey!=='string'||!c.publicKey)throw new SyncError('invalid');
    const u=new URL(c.url),local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
    if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||(!local&&(!/^https:\/\/[a-z0-9]+\.supabase\.co\/$/.test(u.href)||u.hostname.split('.')[0]!==c.testProjectRef)))throw new SyncError('invalid');
    if(local&&!['http:','https:'].includes(u.protocol))throw new SyncError('invalid');
    // Secret / service-role keys must never be used in a browser.
    if(c.publicKey.startsWith('sb_secret_')||(!c.publicKey.startsWith('sb_publishable_')&&c.publicKey.split('.').length!==3))throw new SyncError('invalid');
    if(c.publicKey.split('.').length===3){try{const claims=JSON.parse(atob(c.publicKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(claims.role!=='anon')throw Error()}catch{throw new SyncError('invalid')}}
    return Object.freeze({...c,url:u.origin});
  }
  function checkDoc(d){
    if(!d||!uuid.test(d.id)||!kinds.includes(d.kind)||!d.payload||typeof d.payload!=='object'||Array.isArray(d.payload)||JSON.stringify(d.payload).length>500000)throw new SyncError('invalid');
    if(d.kind==='property'){if(d.property_id!==null||d.payload.id!==d.id||typeof d.payload.name!=='string'||!d.payload.name.trim())throw new SyncError('invalid')}
    else if(!uuid.test(d.property_id)||d.payload.id!==d.id||d.payload.kind!==d.kind||d.payload.values?.property!==d.property_id||d.payload.values?.reviewed!=='yes'||!Number.isInteger(d.payload.revision)||d.payload.revision<1||!Array.isArray(d.payload.history))throw new SyncError('invalid');
  }
  function checkRow(d){checkDoc(d);if(!Number.isSafeInteger(d.version)||d.version<1)throw new SyncError('invalid')}
  class Transport{
    constructor(settings,fetcher=(...args)=>globalThis.fetch(...args)){this.settings=config(settings);this.fetcher=fetcher;this.session=null}
    async request(path,body,publicRequest=false){
      if(!publicRequest&&!this.session)throw new SyncError('auth');
      let response;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      try{response=await this.fetcher(this.settings.url+path,{method:'POST',cache:'no-store',credentials:'omit',signal:controller.signal,headers:{apikey:this.settings.publicKey,'Content-Type':'application/json',...(this.session?{Authorization:'Bearer '+this.session.access_token}:{})},body:JSON.stringify(body)})}catch{throw new SyncError('network')}finally{clearTimeout(timer)}
      if(!response.ok){if(response.status===401){this.session=null;throw new SyncError('auth')}if(response.status===403)throw new SyncError('forbidden');if(response.status===409)throw new SyncError('conflict');throw new SyncError('network')}
      try{return await response.json()}catch{throw new SyncError('invalid')}
    }
    async login(email,password){
      this.session=null;
      const session=await this.request('/auth/v1/token?grant_type=password',{email,password},true);
      if(!uuid.test(session.user?.id)||typeof session.access_token!=='string')throw new SyncError('auth');
      this.session=session;
      try{await this.list()}catch(e){this.session=null;throw e}
      return session.user.id;
    }
    logout(){this.session=null} // Tokens live only in memory; reload requires sign-in.
    list(){return this.request('/rest/v1/rpc/paramount_sync_list',{p_workspace:this.settings.workspace})}
    put(request){return this.request('/rest/v1/rpc/paramount_sync_write',{p_workspace:this.settings.workspace,...request})}
  }
  class Engine{
    constructor({storage,key,transport,randomUUID=()=>crypto.randomUUID()}){this.storage=storage;this.key=key;this.transport=transport;this.randomUUID=randomUUID;this.running=null;this.read()}
    read(){
      const raw=this.storage.getItem(this.key);if(raw===null)return {format:1,generation:0,docs:{},drafts:{}};
      try{const s=JSON.parse(raw);if(s.format!==1||!Number.isInteger(s.generation)||!s.docs||Array.isArray(s.docs)||!s.drafts)throw Error();for(const [id,e]of Object.entries(s.docs)){checkDoc(e.local);if(id!==e.local.id||!Number.isInteger(e.base)||e.base<0)throw Error();if(e.remote)checkRow(e.remote);if(e.pending&&(!uuid.test(e.pending.p_operation)||e.pending.p_id!==id))throw Error()}return s}catch{throw new SyncError('storage')}
    }
    transaction(fn){const before=this.storage.getItem(this.key),s=this.read();fn(s);s.generation++;if(this.storage.getItem(this.key)!==before)throw new SyncError('busy');this.storage.setItem(this.key,JSON.stringify(s));return s}
    stage(d){checkDoc(d);return this.transaction(s=>{const old=s.docs[d.id];if(old&&(old.local.kind!==d.kind||old.local.property_id!==d.property_id))throw new SyncError('invalid');if(old?.unavailable)throw new SyncError('forbidden');if(old?.remote)throw new SyncError('conflict');s.docs[d.id]={...old,base:old?.base||0,local:copy(d),dirty:true}})}
    // One atomic local write for the record change and its durable outbox.
    workspace(){const s=this.read();return {version:1,records:Object.values(s.docs).filter(e=>!e.unavailable&&e.local.kind!=='property').map(e=>copy(e.local.payload)),drafts:copy(s.drafts)}}
    writeWorkspace(data){return this.transaction(s=>{for(const r of data.records){const d={id:r.id,kind:r.kind,property_id:r.values.property,payload:r};checkDoc(d);const old=s.docs[r.id];if(old&&(old.local.kind!==d.kind||old.local.property_id!==d.property_id))throw new SyncError('invalid');if(old?.unavailable)throw new SyncError('forbidden');if(old&&!equal(old.local,d)&&old.remote)throw new SyncError('conflict');if(!old||!equal(old.local,d))s.docs[r.id]={...old,base:old?.base||0,local:copy(d),dirty:true}}s.drafts=copy(data.drafts)})}
    properties(){return Object.values(this.read().docs).filter(e=>!e.unavailable&&e.local.kind==='property').map(e=>copy(e.local.payload))}
    saveProperty(values,expected){const s=this.read(),old=expected?s.docs[expected.id]?.local.payload:null;if(expected&&!equal(old,expected))throw new SyncError('busy');const p={...old,...values,id:old?.id||this.randomUUID()};this.stage({id:p.id,kind:'property',property_id:null,payload:p});return p}
    resolve(id,choice){
      if(!['cloud','local'].includes(choice))throw new SyncError('invalid');
      return this.transaction(s=>{const e=s.docs[id];if(!e?.remote)throw new SyncError('invalid');const r=e.remote;if(choice==='cloud')e.local={id:r.id,kind:r.kind,property_id:r.property_id,payload:r.payload};else if(e.local.kind!=='property'){const v=r.payload,history=[...copy(v.history),{revision:v.revision,values:copy(v.values),updated:v.updated,...(v.siteSnapshot?{siteSnapshot:copy(v.siteSnapshot)}:{})}];for(const h of e.local.payload.history)if(!history.some(x=>equal(x.values,h.values)&&equal(x.siteSnapshot,h.siteSnapshot)))history.push({...copy(h),revision:history.length+1});e.local.payload.history=history;e.local.payload.revision=Math.max(v.revision,...history.map(h=>h.revision))+1;}e.base=r.version;e.dirty=choice==='local';delete e.remote;delete e.pending})
    }
    sync(){if(this.running)return this.running;this.running=this.run().finally(()=>{this.running=null});return this.running}
    async run(){
      // Caller holds a Web Lock for the entire operation in the browser.
      const rows=await this.transport.list();if(!Array.isArray(rows))throw new SyncError('invalid');
      const ids=new Set();for(const r of rows){checkRow(r);if(ids.has(r.id))throw new SyncError('invalid');ids.add(r.id)}
      this.transaction(s=>{for(const [id,e] of Object.entries(s.docs))if(e.base>0&&!ids.has(id))e.unavailable=true;for(const r of rows){const e=s.docs[r.id];if(e)delete e.unavailable;const d={id:r.id,kind:r.kind,property_id:r.property_id,payload:r.payload};
        if(!e)s.docs[r.id]={local:d,base:r.version,dirty:false};
        else if(r.version>e.base){if(e.dirty||e.pending)e.remote=copy(r);else s.docs[r.id]={local:d,base:r.version,dirty:false}}
      }});
      // Properties precede children; retain the exact operation after a lost response.
      const ordered=Object.keys(this.read().docs).sort((a,b)=>(this.read().docs[a].local.kind==='property'?0:1)-(this.read().docs[b].local.kind==='property'?0:1));
      for(const id of ordered){
        let e=this.read().docs[id];if(e.unavailable)continue;if(e.remote&&!e.pending)continue;if(!e.dirty&&!e.pending)continue;
        if(e.local.kind!=='property'){const parent=this.read().docs[e.local.property_id];if(!parent||parent.dirty||parent.remote||parent.pending)continue}
        if(!e.pending)this.transaction(s=>{const x=s.docs[id];x.pending={p_id:id,p_kind:x.local.kind,p_property:x.local.property_id,p_payload:copy(x.local.payload),p_expected:x.base,p_operation:this.randomUUID()}});
        e=this.read().docs[id];const pending=copy(e.pending);
        try{
          const r=await this.transport.put(pending);checkRow(r);
          if(r.id!==id||r.kind!==pending.p_kind||r.property_id!==pending.p_property||!equal(r.payload,pending.p_payload)||r.version!==pending.p_expected+1)throw new SyncError('invalid');
          this.transaction(s=>{const x=s.docs[id];if(!equal(x.pending,pending))throw new SyncError('busy');x.base=r.version;x.dirty=!equal(x.local.payload,pending.p_payload);delete x.pending;delete x.remote});
        }catch(error){if(error.code==='conflict')this.transaction(s=>{delete s.docs[id].pending});throw error}
      }
      return this.read();
    }
  }
  return {Engine,Transport,SyncError,config,checkDoc};
});
