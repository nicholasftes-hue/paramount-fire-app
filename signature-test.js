/* Loopback-only acceptance UI. No defaults, token persistence, analytics or service worker. */
(() => {
  'use strict';
  if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw Error('Signature acceptance test must run on loopback.');
  const byId=id=>document.getElementById(id);
  let transport=null,token='',record=null,busy=false;
  const status=text=>{byId('signature-status').textContent=text};
  // Fragments are not sent in HTTP requests. Remove the fragment immediately from the address bar.
  const fragment=new URLSearchParams(location.hash.slice(1));
  if(/^[0-9a-f]{64}$/.test(fragment.get('token')||''))byId('signature-token').value=fragment.get('token');
  history.replaceState(null,'',location.pathname);
  function clear(){transport?.logout();transport=null;token='';record=null;byId('signature-token').value='';byId('signature-document').replaceChildren();byId('signature-accept').reset();byId('signature-accept').hidden=true;byId('signature-receipt').hidden=true}
  async function show(data){
    if(!data||!data.values||typeof data.values!=='object'||!/^[0-9a-f]{64}$/.test(data.digest)||typeof data.consent!=='string')throw Error('Invalid response.');
    if(typeof data.canonical_document!=='string')throw Error('Missing frozen document.');
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.canonical_document));
    const digest=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
    if(digest!==data.digest)throw Error('Frozen document digest mismatch.');
    const frozen=JSON.parse(data.canonical_document);
    // Render precisely the hashed snapshot; display fields outside it cannot replace signed evidence.
    data={...data,values:frozen.payload.values,site:frozen.payload.siteSnapshot,scope:frozen.scope};
    const root=byId('signature-document');root.replaceChildren();
    for(const [key,value] of Object.entries({issue:data.issue,revision:data.sequence,approved:data.approved_at,scope:data.scope,digest:data.digest,...data.site,...data.values})){
      const p=document.createElement('p'),label=document.createElement('strong');label.textContent=key+': ';p.append(label,document.createTextNode(String(value??'')));root.append(p);
    }
    byId('signature-receipt').hidden=!data.signed_at;
    record=data;byId('signature-consent').textContent=data.consent;byId('signature-accept').hidden=!!data.signed_at;
    if(data.signed_at)status('Acknowledged by '+data.signer_name+' at '+data.signed_at+'. Record digest: '+data.digest);
    else status('Read every field, including scope and limitations. Link expires '+data.expires_at+'.');
  }
  byId('signature-open').addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;busy=true;
    try{
      const file=byId('signature-config').files[0],candidate=byId('signature-token').value;
      clear();if(!file||file.size>10000||!/^[0-9a-f]{64}$/.test(candidate))throw Error('Valid test configuration and invitation required.');
      const settings=ParamountSync.config(JSON.parse(await file.text()));
      if(settings.url==='https://ehlfgmfjzwfsudowaxku.supabase.co')throw Error('Original production endpoint is forbidden.');
      transport=new ParamountSync.Transport(settings);token=candidate;
      await show(await transport.request('/rest/v1/rpc/paramount_signature_read',{p_token:token},true));
    }catch{clear();status('Record unavailable. Check configuration, expiry or revocation with the issuing team.')}finally{busy=false}
  });
  byId('signature-accept').addEventListener('submit',async e=>{
    e.preventDefault();if(busy||!record||!e.target.elements.consent.checked)return;busy=true;
    try{
      const result=await transport.request('/rest/v1/rpc/paramount_signature_accept',{
        p_token:token,p_digest:record.digest,p_name:e.target.elements.signer.value,p_consent:record.consent
      },true);await show(result);e.target.reset();
    }catch{byId('signature-accept').hidden=true;status('Acknowledgement outcome uncertain. Read the record again to check its receipt before retrying. No offline acknowledgement is saved.')}finally{busy=false}
  });
  byId('signature-receipt').addEventListener('click',()=>{
    if(!record?.signed_at)return;
    const receipt={format:'paramount-acknowledgement-v1',...record,identity_assurance:'Possession of invitation link; name self-declared. Verify against the issuer audit.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='paramount-acknowledgement-'+record.issue+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  byId('signature-close').addEventListener('click',()=>{if(!busy){clear();status('Record and invitation cleared.')}});
})();
