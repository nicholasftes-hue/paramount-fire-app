/* Explicit isolated-workspace RPC adapter. No endpoint, credentials or defaults. */
((root)=>{
 'use strict';
 const allowed=['paramount_template_scan_request','paramount_template_list','paramount_template_get','paramount_template_publish','paramount_template_active','paramount_template_backup'];
 const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
 const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(n=>n.toString(16).padStart(2,'0')).join('');
 function create({rpc,inspect,mappingSources,scope=()=>''}){
  if(typeof rpc!=='function'||typeof inspect!=='function'||!Array.isArray(mappingSources))throw Error('Explicit isolated template services required.');
  const guard=before=>{if(scope()!==before)throw Error('Account changed during template action.');};
  const call=async(name,args={})=>{if(!allowed.includes(name))throw Error('Unsupported template operation.');return rpc(name,args);};
  function mappings(info,rows){if(!Array.isArray(rows)||rows.length>100)throw Error('Invalid template mappings.');for(const m of rows){if(info.format!=='pdf'||!m||typeof m.name!=='string'||!m.name.trim()||m.name.length>120||!m.fields||Array.isArray(m.fields)||typeof m.fields!=='object'||!Object.keys(m.fields).length)throw Error('Invalid template mapping.');for(const [target,source] of Object.entries(m.fields))if(!info.fields.includes(target)||!mappingSources.includes(source))throw Error('Unsupported PDF mapping.');}}
  async function verify(t){if(!t||!uuid(t.id)||!uuid(t.family)||!Number.isInteger(t.version)||t.version<1||typeof t.active!=='boolean'||typeof t.name!=='string'||!t.name.trim()||t.name.length>120||typeof t.kind!=='string'||t.kind.length>40||(t.property!==''&&!uuid(t.property))||!['','paramount','absolute'].includes(t.company)||typeof t.content!=='string'||t.content.length>2796204||typeof t.filename!=='string'||t.filename.length>240||!['pdf','docx'].includes(t.format))throw Error('Invalid shared template.');const b=Uint8Array.from(atob(t.content),c=>c.charCodeAt(0));if(await digest(b)!==t.hash)throw Error('Shared template hash mismatch.');const info=await inspect(t.filename,b.buffer);if(info.format!==t.format)throw Error('Shared template format mismatch.');mappings(info,t.mappings);return {...t,...info};}
  return {
   verify,
   async list(){const before=scope();const rows=await call('paramount_template_list');guard(before);if(!Array.isArray(rows)||rows.length>100)throw Error('Invalid shared template list.');return rows;},
   async get(id){const before=scope();if(!uuid(id))throw Error('Invalid template ID.');const t=await verify(await call('paramount_template_get',{p_id:id}));guard(before);if(t.id!==id)throw Error('Wrong shared template version.');return t;},
   async publish(file,meta){const before=scope();if(file.size>2097152)throw Error('Use a file up to 2 MB.');if(!uuid(meta.id)||!uuid(meta.family)||!Number.isInteger(meta.expected)||meta.expected<0||typeof meta.name!=='string'||!meta.name.trim()||meta.name.length>120||!['','paramount','absolute'].includes(meta.company)||meta.property&&!uuid(meta.property))throw Error('Invalid shared template metadata.');const original=await file.arrayBuffer(),info=await inspect(file.name,original);mappings(info,meta.mappings||[]);const hash=await digest(original);let content='';for(const b of new Uint8Array(original))content+=String.fromCharCode(b);
    const payload={name:meta.name.trim(),filename:file.name.replace(/[^\w. -]/g,'_'),kind:meta.kind||'',format:info.format,fields:info.fields,mappings:meta.mappings||[]};
    guard(before);const scan=await call('paramount_template_scan_request',{p_content:btoa(content),p_hash:hash,p_format:info.format});guard(before);if(scan?.state!=='clean'||scan.hash!==hash)throw Error(scan?.state==='blocked'?'Upload rejected by server security scanning. Contact the administrator.':'Upload quarantined for server security scanning. Retry after the scan completes.');const result=await verify(await call('paramount_template_publish',{p_id:meta.id,p_family:meta.family,p_expected:meta.expected,p_property:meta.property||null,p_company:meta.company,p_payload:payload,p_content:btoa(content),p_hash:hash}));
    guard(before);if(result.id!==meta.id||result.family!==meta.family||result.version!==meta.expected+1||result.hash!==hash||result.company!==meta.company||result.name!==payload.name||result.kind!==payload.kind||result.property!==(meta.property||'')||stable(result.mappings)!==stable(payload.mappings))throw Error('Unexpected shared template acknowledgement. Retain the upload and retry using the same ID.');return result;
   },
   async active(id,active){if(!uuid(id)||typeof active!=='boolean')throw Error('Invalid template action.');return call('paramount_template_active',{p_id:id,p_active:active});},
   async backup(){const before=scope();const b=await call('paramount_template_backup');if(b?.version!==1||!uuid(b.workspace)||!Array.isArray(b.templates)||b.templates.length>100||!Array.isArray(b.audit))throw Error('Invalid shared template backup.');for(const t of b.templates)await verify(t);guard(before);return b;}
  };
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.ParamountSharedTemplates=api;
})(typeof window==='undefined'?globalThis:window);
