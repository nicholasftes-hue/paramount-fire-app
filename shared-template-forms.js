/* Loaded only by the explicit localhost isolated workspace. No production configuration. */
(()=>{
 'use strict';
 const team=window.ParamountTeamSync,personal=window.ParamountTemplates;
 const library=window.ParamountSharedTemplates.create({rpc:team.templateRpc,inspect:personal.inspect,mappingSources:personal.mappingSources,scope:team.scope});
 const cache=window.ParamountSharedTemplateCache.create({library,storage:localStorage,scope:team.scope,online:team.templateOnline});
 const mappings=t=>(t?.mappings||[]).map((m,i)=>({...m,id:t.id+':'+i,templateId:t.id,templateHash:t.hash}));
 const status=text=>{const el=document.getElementById('main-status');if(el)el.textContent=text;};
 function repaint(){for(const form of document.querySelectorAll('form[data-main-form]'))personal.restore(form,team.scope());}
 let current=team.scope();
 window.ParamountTeamTemplates={
  rows:cache.rows,get:id=>cache.rows().find(t=>t.id===id),
  getMapping:id=>cache.rows().flatMap(mappings).find(m=>m.id===id),
  mappings,
  async resolve(id){return cache.get(id);},
  async refresh(){current=team.scope();await cache.refresh();repaint();status('Shared templates verified and cached for up to 24 hours. Offline drafts require online access checks before issue.');},
  async load(){current=team.scope();await cache.load();repaint();},
 };
 setInterval(()=>{if(current!==team.scope()){current=team.scope();cache.reset();repaint();window.ParamountTeamTemplates.load().catch(e=>status(e.message));}},250);
 window.ParamountTeamTemplates.load().catch(e=>status(e.message));
 document.addEventListener('click',async e=>{if(!e.target.closest('[data-template-shared-refresh]'))return;try{await window.ParamountTeamTemplates.refresh();}catch(error){repaint();status('Shared library unavailable: '+error.message);}});
})();
