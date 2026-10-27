/* Only loaded by team-sync-test.html on a separate local test origin. */
(() => {
  'use strict';
  if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw Error('Isolated sync UI must be served on loopback.');
  const {Engine,Transport,SyncError,config}=window.ParamountSync;
  let settings=null,transport=null,engine=null,user=null,release=null,exclusive=false,timer=null,working=false,authBusy=false;
  // No path from this test entry point to the original Supabase configuration.
  cloudSession=null;cloudRequest=async()=>{throw Error('Original cloud access is disabled in isolated testing.')};
  cloudAuthorizedRequest=cloudRequest;save=()=>{throw Error('Legacy writes are disabled in isolated testing.')};
  db={properties:[],services:[],inventory:[],pat:[],quotes:[],lighting:[],jobs:[],settings:{}};
  const allowed=['Properties','Service Records','PAT Testing','Emergency Lighting','Property History'];
  sections.splice(0,sections.length,...allowed);tab='Properties';
  const panel=document.createElement('section');panel.className='panel';panel.id='team-sync';document.querySelector('main').prepend(panel);
  const css=document.createElement('style');css.textContent='#academy,.introbar,.main-app details.panel{display:none}#team-sync input{max-width:100%;box-sizing:border-box}#team-status{white-space:pre-wrap}';document.head.append(css);
  const must=()=>{if(!engine||!exclusive)throw new SyncError('busy');return engine};
  const key=()=>`paramount-isolated-sync-v1:${settings.url}:${settings.workspace}:${user}`;
  const redraw=()=>{window.ParamountMainApp?.reload();show()};
  function status(text){const el=document.getElementById('team-status');if(el)el.textContent=text}
  function show(){
    const docs=engine?Object.values(engine.read().docs):[],conflicts=docs.filter(e=>e.remote),pending=docs.filter(e=>e.dirty||e.pending).length;
    panel.innerHTML=`<h2>Isolated staff synchronisation test</h2><p>Fictional test records only. Configuration and sign-in are separate from the original app. Offline copies remain on this device after sign-out.</p>
      <label>Load isolated configuration JSON<input id="team-config" type="file" accept="application/json"></label>
      <p>${esc(settings?'Test endpoint configured':'No test endpoint configured')}${user?' · Staff '+esc(user):''}</p>
      <form id="team-login"><label>Test staff email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button>Sign in</button></form>
      <p><button id="team-offline">Open last cached staff workspace offline</button> <button id="team-logout">Close workspace / sign out</button> <button id="team-now">Sync now</button> <button id="team-export">Export recovery JSON</button></p>
      <p>${pending} queued · ${conflicts.length} conflicts. Changes save locally first. Sync runs every 15 seconds while signed in. Review conflicts before choosing a version.</p>
      ${conflicts.map(e=>`<details><summary>Conflict: ${esc(e.local.kind)} ${esc(e.local.id)}</summary><h3>Local copy</h3><pre>${esc(JSON.stringify(e.local.payload,null,2))}</pre><h3>Cloud copy</h3><pre>${esc(JSON.stringify(e.remote.payload,null,2))}</pre><button data-team-resolve="${esc(e.local.id)}" data-choice="cloud">Use cloud copy</button> <button data-team-resolve="${esc(e.local.id)}" data-choice="local">Keep local and retry against reviewed cloud version</button></details>`).join('')}
      <p id="team-status" role="status"></p>`;
    document.getElementById('view').hidden=!engine;document.getElementById('tabs').hidden=!engine;
    if(engine&&!exclusive)status('This workspace is open in another tab. Close it there, then reopen here.');
  }
  function close(){clearInterval(timer);timer=null;transport?.logout();release?.();release=null;exclusive=false;engine=null;user=null}
  async function open(id){
    release?.();release=null;exclusive=false;
    user=id;engine=new Engine({storage:localStorage,key:key(),transport});
    if(!navigator.locks){engine=null;throw Error('Web Locks support is required for isolated sync editing.');}
    await new Promise((resolve,reject)=>{
      navigator.locks.request(key(),{ifAvailable:true},async lock=>{
        if(!lock){resolve();return}exclusive=true;resolve();await new Promise(r=>release=r);
      }).catch(reject);
    });
    localStorage.setItem('paramount-isolated-last:'+settings.url+':'+settings.workspace,id);
    redraw();
  }
  async function sync(){
    if(authBusy||working||!transport?.session||!engine||!exclusive)return;
    working=true;status('Syncing…');const target=engine;
    try{
      // Don't re-render an open editing form while a background response arrives.
      await target.sync();if(engine===target){window.ParamountMainApp?.refresh();show();status('Sync complete. Reopen the selected tab to view incoming changes. Queued/conflict counts are shown above.');}
    }catch(error){if(engine===target){show();status(error.message)}}finally{working=false}
  }
  window.ParamountTeamSync={
    scope:()=>engine?'team-test:'+settings.url+':'+settings.workspace+':'+user:'team-test:locked',
    properties:()=>engine?engine.properties():[],read:()=>engine?engine.workspace():{version:1,records:[],drafts:{}},
    write:data=>must().writeWorkspace(data),saveProperty:(values,expected)=>must().saveProperty(values,expected),raw:()=>engine?localStorage.getItem(key()):'',
    banner:()=>'<div class="main-banner"><strong>Isolated team test workspace</strong><p>Properties, fire alarm services, PAT and emergency lighting save locally with a durable sync queue. Use the panel above for status and conflicts. Draft documents require competent review.</p><p id="main-status" role="status"></p></div>'
  };
  document.addEventListener('click',e=>{
    const go=e.target.closest('[data-tab],[data-go]');if(go&&!allowed.includes(go.dataset.tab||go.dataset.go)){e.preventDefault();e.stopImmediatePropagation()}
  },true);
  document.addEventListener('change',async e=>{
    if(e.target.id!=='team-config'||!e.target.files?.[0])return;
    try{if(working||authBusy)throw Error('Wait for the current sync to finish.');if(e.target.files[0].size>10000)throw new SyncError('invalid');const c=config(JSON.parse(await e.target.files[0].text()));if(c.url===new URL(CLOUD_URL).origin)throw Error('Original Supabase endpoint is forbidden.');close();settings=c;transport=new Transport(c);redraw();status('Test configuration loaded. Sign in with an owner-provisioned test staff account.')}catch(error){status(error.message)}
  });
  document.addEventListener('submit',async e=>{
    if(e.target.id!=='team-login')return;e.preventDefault();const form=e.target;
    try{if(!transport)throw Error('Load isolated test configuration first.');if(working||authBusy)throw Error('Wait for sync to finish.');authBusy=true;close();const id=await transport.login(form.elements.email.value.trim(),form.elements.password.value);form.elements.password.value='';await open(id);authBusy=false;timer=setInterval(sync,15000);await sync()}catch(error){form.elements.password.value='';status(error.message)}finally{authBusy=false}
  });
  document.addEventListener('click',async e=>{
    try{
      if(e.target.id==='team-offline'){if(!settings)throw Error('Load test configuration first.');if(working||authBusy)throw Error('Wait for sync to finish.');const id=localStorage.getItem('paramount-isolated-last:'+settings.url+':'+settings.workspace);if(!id)throw Error('No cached staff workspace. Sign in online first.');close();await open(id);if(exclusive)status('Offline mode. Reauthenticate to sync; local access is not proof of current staff authorisation.');}
      if(e.target.id==='team-logout'){if(working||authBusy)throw Error('Wait for sync to finish.');close();redraw()}
      if(e.target.id==='team-now')await sync();
      if(e.target.id==='team-export'){const raw=settings&&user?localStorage.getItem(key()):null;if(!raw)throw Error('No open workspace to export.');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=url;a.download='paramount-isolated-sync-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
      if(e.target.dataset.teamResolve){if(working||authBusy)throw Error('Wait for sync to finish.');if(!confirm('Have you compared both copies? Export recovery JSON before discarding local work.'))return;must().resolve(e.target.dataset.teamResolve,e.target.dataset.choice);redraw();}
    }catch(error){status(error.message)}
  });
  addEventListener('online',sync);show();
})();
