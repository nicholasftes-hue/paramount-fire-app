/* Verified read-only offline snapshots. Publishing remains an online, server-authorised action. */
((root)=>{
 'use strict';
 const TTL=24*60*60*1000,MAX=29*1024*1024;
 const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
 const immutable=t=>Object.fromEntries(['id','family','version','name','company','property','kind','filename','format','hash','mappings'].map(k=>[k,t[k]]));
 function create({library,storage,scope,online,clock=Date.now}){
  let owner='',snapshot=null,generation=0;
  const key=s=>'paramount-shared-template-cache-v1:'+s;
  const guard=(s,g)=>{if(scope()!==s||generation!==g)throw Error('Template workspace changed. Retry.');};
  function reset(){owner=scope();snapshot=null;generation++;}
  function rows(){if(owner!==scope()){reset();return [];}if(!snapshot||snapshot.blocked||clock()<snapshot.checked||clock()-snapshot.checked>TTL)return [];return structuredClone(snapshot.templates);}
  async function checked(data,s){
   if(data?.version!==1||data.scope!==s||!Number.isFinite(data.checked)||data.checked>clock()||clock()-data.checked>TTL||data.blocked||!Array.isArray(data.templates)||data.templates.length>100)throw Error('Shared cache expired or invalid. Refresh online.');
   const seen=new Set(),templates=[];let total=0;
   for(const t of data.templates){if(seen.has(t.id))throw Error('Duplicate cached template.');seen.add(t.id);total+=t.content?.length||0;if(total>MAX)throw Error('Shared cache too large.');templates.push(await library.verify(t));}
   return {...data,templates};
  }
  async function load(){reset();const s=owner,g=generation,raw=storage.getItem(key(s));if(!raw)return [];if(raw.length>MAX)throw Error('Shared cache too large.');const data=await checked(JSON.parse(raw),s);guard(s,g);snapshot=data;return rows();}
  async function refresh(){
   if(!online())throw Error('Connect and sign in before refreshing shared templates.');
   if(owner!==scope())reset();const s=owner,g=++generation;
   // Persist denial before any network request. A failed/incomplete refresh cannot revive stale permissions on reload.
   snapshot=null;storage.setItem(key(s),JSON.stringify({version:1,scope:s,blocked:true}));
   const first=await library.list(),templates=[];const seen=new Set();let total=0;
   for(const meta of first){guard(s,g);if(seen.has(meta.id))throw Error('Duplicate shared template.');seen.add(meta.id);const t=await library.get(meta.id);if(stable(immutable(t))!==stable(immutable(meta))||t.active!==meta.active)throw Error('Shared library changed during refresh. Retry.');total+=t.content.length;if(total>MAX)throw Error('Shared cache too large.');templates.push(t);}
   const last=await library.list();guard(s,g);
   const signature=xs=>stable(xs.map(t=>({...immutable(t),active:t.active})).sort((a,b)=>a.id.localeCompare(b.id)));
   if(signature(first)!==signature(last))throw Error('Shared library changed during refresh. Retry.');
   const data=await checked({version:1,scope:s,checked:clock(),templates},s);guard(s,g);
   storage.setItem(key(s),JSON.stringify(data));snapshot=data;return rows();
  }
  async function get(id){
   if(owner!==scope())reset();const s=owner,g=generation;
   const cached=rows().find(t=>t.id===id);if(!cached)throw Error('Exact shared template unavailable. Refresh the authorised library.');
   if(!online())return library.verify(cached).then(t=>{guard(s,g);return t;});
   try{const live=await library.get(id);guard(s,g);if(stable(immutable(live))!==stable(immutable(cached)))throw Error('Shared version changed unexpectedly. Refresh.');return live;}
   catch(e){guard(s,g);snapshot=null;storage.setItem(key(s),JSON.stringify({version:1,scope:s,blocked:true}));throw e;}
  }
  return {load,refresh,rows,get,reset};
 }
 const api={create,TTL};if(typeof module!=='undefined')module.exports=api;else root.ParamountSharedTemplateCache=api;
})(typeof window==='undefined'?globalThis:window);
