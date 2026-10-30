/* Device-local, account-scoped blank-template library. No network or automatic issue. */
(() => {
  'use strict';
  const LIMIT=2*1024*1024, EXPANDED=12*1024*1024;
  const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const key=scope=>'paramount-templates-v1:'+scope;
  const library=scope=>{const data=JSON.parse(localStorage.getItem(key(scope))||'[]');if(Array.isArray(data))return {version:2,templates:data,mappings:[]};if(data?.version!==2||!Array.isArray(data.templates)||!Array.isArray(data.mappings))throw Error('Template library unreadable; recover its backup before continuing.');return data;};
  const read=scope=>library(scope).templates;
  const write=(scope,rows)=>{const data=library(scope);data.templates=rows;localStorage.setItem(key(scope),JSON.stringify(data));};
  const sources='reference revision branding contractor issuer status visitId date engineer site address customer customerName system standard panelSerial zones location asset appliance model capacity manufactured next tests defects actions scope measurements battery batteryAh equipmentClass instrument calibration ratedDuration duration number title'.split(' ');
  const getMapping=(id,scope)=>library(scope).mappings.find(m=>m.id===id);
  const pdfAPI=()=>{if(!window.ParamountImportedPDF)throw Error('PDF inspector unavailable. Reload the app shell.');return window.ParamountImportedPDF;};
  function validateMapping(t,fields){if(!fields||typeof fields!=='object'||Array.isArray(fields)||!Object.keys(fields).length||Object.keys(fields).length>200)throw Error('Choose at least one PDF text field.');for(const [target,source] of Object.entries(fields))if(!t.fields.includes(target)||!sources.includes(source))throw Error('Unsupported PDF field or certificate value.');}
  async function saveMapping(templateId,label,fields,scope){editable();const t=get(templateId,scope);if(!t||!t.active||t.format!=='pdf')throw Error('Select an active PDF template.');if(!label?.trim()||label.length>120)throw Error('Name the mapping (1–120 characters).');if(await digest(bytes(t.content))!==t.hash)throw Error('Template hash mismatch.');const info=await inspect(t.filename,bytes(t.content).buffer);validateMapping(info,fields);assertScope(scope);const data=library(scope);if(!data.templates.find(x=>x.id===t.id)?.active)throw Error('Template changed. Retry.');const m={id:crypto.randomUUID(),templateId:t.id,templateHash:t.hash,name:label.trim(),fields:{...fields},created:new Date().toISOString()};data.mappings.push(m);localStorage.setItem(key(scope),JSON.stringify(data));return m;}
  async function populatePDF(t,m,values){if(await digest(bytes(t.content))!==t.hash)throw Error('Template hash mismatch.');if(!m||m.templateId!==t.id||m.templateHash!==t.hash)throw Error('PDF mapping does not match this exact template version.');validateMapping(await inspect(t.filename,bytes(t.content).buffer),m.fields);const provenance=['DRAFT - NOT ISSUED', 'Reference: '+values.reference+' / revision '+values.revision,'Branding: '+values.branding,'Contractor and draft issuer: '+values.contractor,'Template SHA-256: '+t.hash,'Mapping: '+m.id].join(' | ');if(/[^\x20-\x7e]/.test(provenance))throw Error('PDF attribution requires printable ASCII.');return pdfAPI().populate(bytes(t.content).buffer,m.fields,values,provenance);}
  function mappingOptions(t,scope,selected=''){return '<option value="">Original only / manual completion</option>'+library(scope).mappings.filter(m=>m.templateId===t?.id&&m.templateHash===t?.hash).map(m=>'<option value="'+escape(m.id)+'"'+(m.id===selected?' selected':'')+'>'+escape(m.name)+'</option>').join('');}

  const get=(id,scope)=>read(scope).find(t=>t.id===id);
  const b64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)};
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const crc=b=>{let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0};
  // ZIP central directory is authoritative; reject ambiguous paths, encryption and bombs.
  async function unzip(buffer) {
    const b=new Uint8Array(buffer),v=new DataView(b.buffer,b.byteOffset,b.byteLength),files=Object.create(null);
    let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===b.length){end=i;break}
    if(end<0||v.getUint16(end+4,true)||v.getUint16(end+6,true)||v.getUint16(end+8,true)!==v.getUint16(end+10,true))throw Error('Unsupported Word ZIP archive.');
    const count=v.getUint16(end+10,true),start=v.getUint32(end+16,true),size=v.getUint32(end+12,true);
    if(count>300||start+size!==end)throw Error('Invalid or oversized Word archive.');
    let pos=start,total=0;
    for(let i=0;i<count;i++){
      if(pos+46>end||v.getUint32(pos,true)!==0x02014b50)throw Error('Invalid Word directory.');
      const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),sum=v.getUint32(pos+16,true),compressed=v.getUint32(pos+20,true),length=v.getUint32(pos+24,true),n=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),offset=v.getUint32(pos+42,true);
      const name=dec.decode(b.slice(pos+46,pos+46+n));pos+=46+n+extra+comment;total+=length;
      if(pos>end||flags&1||![0,8].includes(method)||total>EXPANDED||length>EXPANDED||length>Math.max(compressed*150,100000)||!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>p==='..'||p==='.')||Object.hasOwn(files,name))throw Error('Unsafe or unsupported Word archive entry.');
      if(offset+30>start||v.getUint32(offset,true)!==0x04034b50||v.getUint16(offset+8,true)!==method||v.getUint16(offset+6,true)!==flags)throw Error('Invalid Word entry.');
      const localN=v.getUint16(offset+26,true),localExtra=v.getUint16(offset+28,true),begin=offset+30+localN+localExtra;
      if(dec.decode(b.slice(offset+30,offset+30+localN))!==name||begin+compressed>start)throw Error('Inconsistent Word entry.');
      let data=b.slice(begin,begin+compressed);
      if(method===8){
        const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();const chunks=[];let actual=0;
        while(true){const {value,done}=await reader.read();if(done)break;actual+=value.length;if(actual>length){await reader.cancel();throw Error('Word entry expansion exceeds declared length.');}chunks.push(value)}
        data=new Uint8Array(actual);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length}
      }
      if(data.length!==length||crc(data)!==sum)throw Error('Corrupt Word template.');
      files[name]=data;
    }
    if(pos!==end)throw Error('Invalid Word directory size.');
    if(!files['word/document.xml']||!files['[Content_Types].xml']||!files['_rels/.rels']||!dec.decode(files['[Content_Types].xml']).includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'))throw Error('Select an actual .docx Word document.');
    for(const [name,data] of Object.entries(files)){
      if(/vba|activex|embeddings|customui/i.test(name))throw Error('Macros, embedded objects and active content are not supported.');
      if(/\.(xml|rels)$/i.test(name)&&/<!DOCTYPE|<!ENTITY|TargetMode\s*=|altChunk|oleObject|INCLUDETEXT|DDEAUTO|macroEnabled|vbaProject/i.test(dec.decode(data)))throw Error('External references or active Word content are not supported.');
    }
    return files;
  }
  function zip(files){
    const chunks=[],central=[];let offset=0;
    const h=n=>new Uint8Array(n),view=b=>new DataView(b.buffer);
    for(const [name,data] of Object.entries(files)){
      const n=enc.encode(name),sum=crc(data),local=h(30),v=view(local);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);
      chunks.push(local,n,data);const c=h(46),cv=view(c);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,sum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);central.push(c,n);offset+=30+n.length+data.length;
    }
    const size=central.reduce((n,c)=>n+c.length,0),end=h(22),v=view(end);v.setUint32(0,0x06054b50,true);v.setUint16(8,Object.keys(files).length,true);v.setUint16(10,Object.keys(files).length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
    return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
  async function inspect(name,buffer){
    const b=new Uint8Array(buffer);if(!b.length||b.length>LIMIT)throw Error('Use a non-empty file up to 2 MB.');
    if(/\.docx$/i.test(name)){const files=await unzip(buffer);return {format:'docx',fields:[...new Set(Object.entries(files).filter(([n])=>/^word\/.*\.xml$/.test(n)).flatMap(([,b])=>[...dec.decode(b).matchAll(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g)].map(m=>m[1])))],preview:dec.decode(files['word/document.xml']).replace(/<[^>]*>/g,' ').slice(0,3000)}}
    if(/\.pdf$/i.test(name))return pdfAPI().inspect(buffer);
    throw Error('Select a valid .docx or PDF file; other formats are not supported.');
  }
  function assertScope(scope){const current=window.ParamountTeamSync?.scope()||(typeof cloudSession!=='undefined'?cloudSession?.user?.id:null)||'device-guest';if(scope!==current)throw Error('Account changed. Reload before saving templates.');}
  function editable(){if(window.ParamountTeamSync)throw Error('Shared team template administration requires server-enforced roles and is not enabled. Use a personal isolated workspace for this local library.');}
  async function upload(file,meta,scope){
    editable();if(file.size>LIMIT)throw Error('Use a file up to 2 MB.');const original=await file.arrayBuffer(),info=await inspect(file.name,original);
    if(!meta.name?.trim()||meta.name.length>120)throw Error('Name the template (1–120 characters).');
    const hash=await digest(original);const rows=read(scope),previous=meta.replace?rows.find(t=>t.id===meta.replace):null;
    if(meta.replace&&!previous)throw Error('Template to replace is missing.');
    const t={id:crypto.randomUUID(),family:previous?.family||crypto.randomUUID(),version:previous?Math.max(...rows.filter(t=>t.family===previous.family).map(t=>t.version))+1:1,name:meta.name.trim(),company:meta.company||'',property:meta.property||'',kind:meta.kind||'',filename:file.name.replace(/[^\w. -]/g,'_'),created:new Date().toISOString(),active:true,hash,content:b64(new Uint8Array(original)),...info};
    // Never replace bytes or metadata of an old version. Only availability can change.
    if(previous)for(const row of rows)if(row.family===previous.family){row.active=false;row.deactivated=new Date().toISOString();}
    assertScope(scope);rows.push(t);write(scope,rows);return t;
  }
  function deactivate(id,scope){editable();const rows=read(scope),t=rows.find(t=>t.id===id);if(!t)throw Error('Template not found.');t.active=false;t.deactivated=new Date().toISOString();assertScope(scope);write(scope,rows);}
  function save(name,data,type){const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
  async function populate(t,values){
    const original=bytes(t.content);if(await digest(original)!==t.hash)throw Error('Template hash mismatch. Recover the original version.');
    const files=await unzip(original.buffer);let replacements=0;
    for(const [name,data] of Object.entries(files))if(/^word\/.*\.xml$/.test(name)){
      const xml=dec.decode(data).replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g,(_,field)=>{if(!Object.hasOwn(values,field))throw Error('No mapped value for '+field+'. Download the original and complete it in Word.');replacements++;return escape(values[field])});files[name]=enc.encode(xml);
    }
    if(!replacements)throw Error('No supported placeholders found. Use contiguous {{fieldName}} placeholders in Word or download the original for manual completion.');
    return zip(files);
  }
  async function downloadFor(r,scope){
    const t=get(r.values.templateRef,scope);if(!t)throw Error('Template version unavailable in this account/device. Restore its library backup.');
    const provider='Paramount Fire Protection';
    if(t.format==='pdf'&&r.values.templateMappingRef){const values={...r.values,reference:r.id,revision:String(r.revision),branding:window.ParamountMainApp.brandName(r.values),contractor:provider,issuer:provider,status:'DRAFT - NOT ISSUED'};const data=await populatePDF(t,getMapping(r.values.templateMappingRef,scope),values);assertScope(scope);save('DRAFT-'+r.id+'-r'+r.revision+'.pdf',data);status('Mapped PDF draft downloaded. Review every field, branding and issuer before use.');
    }else if(t.format==='docx'&&t.fields.length){
      const reserved=['engineerSignature','customerSignature','engineerSigned','customerSigned','declaration'];
      if(t.fields.some(f=>reserved.includes(f)))throw Error('Signatures and declarations require manual review in the original template.');
      const data=await populate(t,{...r.values,reference:r.id,revision:String(r.revision),branding:window.ParamountMainApp.brandName(r.values),contractor:provider,issuer:provider,status:'DRAFT — NOT ISSUED'});
      const files=await unzip(await data.arrayBuffer());const xml=dec.decode(files['word/document.xml']);const provenance=['DRAFT — NOT ISSUED — pending competent review','Reference: '+r.id+' / revision '+r.revision,'Visit: '+(r.values.visitId||'Legacy — unassigned'),'Branding / issued for: '+window.ParamountMainApp.brandName(r.values),'Contractor and draft issuer: '+provider,'Engineer: '+(r.values.engineer||'Not recorded')].map(text=>'<w:p><w:r><w:t>'+escape(text)+'</w:t></w:r></w:p>').join('');files['word/document.xml']=enc.encode(xml.replace(/<w:sectPr\b/,provenance+'<w:sectPr').replace(!/<w:sectPr\b/.test(xml)?'</w:body>':'__NO_MATCH__',provenance+'</w:body>'));
      assertScope(scope);save('DRAFT-'+r.id+'-r'+r.revision+'.docx',zip(files));status('Mapped Word draft downloaded. Review all unfilled fields, contractor, issuer, scope and results in Microsoft Word before use.');
    }else {if(await digest(bytes(t.content))!==t.hash)throw Error('Template hash mismatch.');save('ORIGINAL-'+t.filename,bytes(t.content),t.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document');status('Unchanged original downloaded for manual completion. This is not a populated or issued certificate.');}
  }
  function options(kind,scope,property='',company='',selected=''){
    return '<option value="">Built-in branded draft</option>'+read(scope).filter(t=>(t.active&&(!t.kind||t.kind===kind)&&(!t.property||t.property===property)&&(!t.company||t.company===company))||t.id===selected).map(t=>'<option value="'+escape(t.id)+'">'+escape(t.name)+' · v'+t.version+(t.active?'':' (historical / inactive)')+'</option>').join('');
  }
  function controls(kind,scope){return '<label>Use Existing Certificate / Template<select name="templateRef">'+options(kind,scope)+'</select></label><input type="hidden" name="templateName"><label>Saved PDF field mapping<select name="templateMappingRef"><option value="">Original only / manual completion</option></select></label><button type="button" data-template-library>Manage / preview saved templates</button><div data-template-library-panel hidden></div><p>Built-in exports remain draft reports. Selected original templates are downloaded separately; automatic population supports Word {{fieldName}} placeholders and inspected PDF text fields with a saved mapping. Templates stay on this account/device; back up separately.</p>';}
  function restore(form,scope){const select=form.elements.templateRef;if(!select)return;const selected=form.dataset.savedTemplate||select.value||'';delete form.dataset.savedTemplate;select.innerHTML=options(form.dataset.mainForm,scope,form.elements.property?.value,form.elements.branding?.value,selected);select.value=selected;const mapping=form.elements.templateMappingRef;if(mapping){const pinned=form.dataset.savedTemplateMapping??mapping.value;delete form.dataset.savedTemplateMapping;mapping.innerHTML=mappingOptions(get(selected,scope),scope,pinned);mapping.value=pinned;}}
  function status(text){const el=document.getElementById('main-status');if(el)el.textContent=text;}
  function currentScope(form){if(form.dataset.mainScope!== (window.ParamountTeamSync?.scope()|| (typeof cloudSession!=='undefined'?cloudSession?.user?.id:null)||'device-guest'))throw Error('Account changed. Reload before using templates.');return form.dataset.mainScope;}
  function mappingEditor(t){return t.format==='pdf'&&t.fields.length?'<fieldset><legend>Reusable PDF text field mapping</legend><label>Mapping name<input data-pdf-map-name maxlength="120"></label>'+t.fields.map(f=>'<label>'+escape(f)+'<select data-pdf-map-field="'+escape(f)+'"><option value="">Leave for manual completion</option>'+sources.map(source=>'<option value="'+source+'">'+source+'</option>').join('')+'</select></label>').join('')+'<button type="button" data-pdf-map-save="'+escape(t.id)+'">Save new mapping</button></fieldset>':'';}
  function panel(form,scope){const target=form.querySelector('[data-template-library-panel]');target.hidden=false;target.innerHTML='<h3>Device template library</h3><p>Import authorised blank templates only. This library is local to your account/device and is not included in workspace backups. Download its separate backup below. Review downloaded files using your organisation’s file scanning process.</p><label>Template name<input data-template-name maxlength="120"></label><label>Assign to company<select data-template-company><option value="">All companies</option><option value="paramount">Paramount</option><option value="absolute">Absolute</option></select></label><label><input type="checkbox" data-template-property>Assign to selected property</label><label>Replace with new version<select data-template-replace><option value="">Create new template</option>'+read(scope).filter(t=>t.active).map(t=>'<option value="'+escape(t.id)+'">'+escape(t.name)+'</option>').join('')+'</select></label><label>Upload .docx or PDF<input type="file" data-template-upload accept=".docx,.pdf"></label><button type="button" data-template-backup>Download template library backup</button><label>Restore template library backup<input type="file" data-template-restore accept=".json"></label>'+read(scope).map(t=>'<article><b>'+escape(t.name)+' · v'+t.version+'</b> · '+(t.active?'Active':'Inactive')+'<p>'+escape(t.kind||'All documents')+' · '+escape(t.company||'All companies')+' · '+escape(t.property||'All properties')+'</p><details><summary>Text / capability preview</summary><p>'+escape(t.preview)+'</p><p>Supported placeholders: '+escape(t.fields.join(', ')||'None — manual completion')+'</p><p>SHA-256: '+escape(t.hash)+'</p></details><button type="button" data-template-original="'+escape(t.id)+'">Download unchanged original</button>'+(t.active?mappingEditor(t):'')+(t.active?'<button type="button" data-template-deactivate="'+escape(t.id)+'">Deactivate</button>':'')+'</article>').join('');}
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-template-library],[data-template-original],[data-template-deactivate],[data-template-backup],[data-pdf-map-save]');if(!b)return;
    try{const form=b.closest('form[data-main-form]');if(!form)return;const scope=currentScope(form);
      if(b.dataset.pdfMapSave){const article=b.closest('article'),fields=Object.fromEntries([...article.querySelectorAll('[data-pdf-map-field]')].filter(el=>el.value).map(el=>[el.dataset.pdfMapField,el.value]));const m=await saveMapping(b.dataset.pdfMapSave,article.querySelector('[data-pdf-map-name]').value,fields,scope);panel(form,scope);restore(form,scope);status('Mapping saved. Select it on the certificate form to pin this version.');}
      else if(b.hasAttribute('data-template-library'))panel(form,scope);
      else if(b.dataset.templateOriginal){const t=get(b.dataset.templateOriginal,scope);if(await digest(bytes(t.content))!==t.hash)throw Error('Template integrity check failed.');save('ORIGINAL-'+t.filename,bytes(t.content));}
      else if(b.dataset.templateDeactivate){deactivate(b.dataset.templateDeactivate,scope);panel(form,scope);restore(form,scope);}
      else save('paramount-template-library.json',JSON.stringify({scope,templates:read(scope),mappings:library(scope).mappings},null,2),'application/json');
    }catch(error){status(error.message)}
  });
  document.addEventListener('change',async e=>{
    const form=e.target.closest('form[data-main-form]');if(!form)return;
    try{const scope=currentScope(form);
      if(['property','branding','templateRef'].includes(e.target.name))form.elements.templateMappingRef.value='';
      if(e.target.name==='templateRef')restore(form,scope);
      if(['property','branding'].includes(e.target.name)) {const s=form.elements.templateRef,previous=s.value;s.value='';restore(form,scope);if(previous)status('Company/property changed: select a suitable template again.');}
      if(e.target.hasAttribute('data-template-upload')&&e.target.files[0]){
        const panel=form.querySelector('[data-template-library-panel]'),file=e.target.files[0],meta={name:panel.querySelector('[data-template-name]').value,company:panel.querySelector('[data-template-company]').value,kind:form.dataset.mainForm,property:panel.querySelector('[data-template-property]').checked?form.elements.property.value:'',replace:panel.querySelector('[data-template-replace]').value};
        if(panel.querySelector('[data-template-property]').checked&&!meta.property)throw Error('Select the property before assigning a template.');
        if(!confirm('Confirm this is an authorised blank template. Existing certificates and personal data must not be uploaded as reusable templates.'))return;
        await upload(file,meta,scope);currentScope(form);panelUpdate();status('Template saved as a new immutable version on this device.');
      }
      if(e.target.hasAttribute('data-template-restore')&&e.target.files[0]){
        editable();const f=e.target.files[0];if(f.size>15*1024*1024)throw Error('Library backup exceeds 15 MB.');const data=JSON.parse(await f.text());if(data.scope!==scope||!Array.isArray(data.templates)||data.templates.length>100)throw Error('Backup must belong to this account/device workspace.');
        const before=localStorage.getItem(key(scope)),rows=read(scope);for(const t of data.templates){if(!t||!/^[-a-zA-Z0-9]{1,100}$/.test(t.id)||typeof t.content!=='string'||typeof t.name!=='string'||t.name.length>120||!Number.isInteger(t.version)||t.version<1)throw Error('Invalid template metadata.');const raw=bytes(t.content);if(await digest(raw)!==t.hash)throw Error('Template hash mismatch.');const info=await inspect(t.filename,raw.buffer);const old=rows.find(r=>r.id===t.id);if(old){if(JSON.stringify(old)!==JSON.stringify(t))throw Error('Conflicting template version; existing library retained.');}else rows.push({...t,...info});}
        const mappings=library(scope).mappings;for(const m of data.mappings||[]){const t=rows.find(t=>t.id===m.templateId);if(!t||typeof m.id!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(m.id)||typeof m.name!=='string'||m.name.length>120||m.templateHash!==t.hash)throw Error('Invalid PDF mapping backup.');validateMapping(t,m.fields);const old=mappings.find(x=>x.id===m.id);if(old&&JSON.stringify(old)!==JSON.stringify(m))throw Error('Conflicting PDF mapping.');if(!old)mappings.push(m);}currentScope(form);if(localStorage.getItem(key(scope))!==before)throw Error('Library changed during restore; retry using the latest version.');localStorage.setItem(key(scope),JSON.stringify({version:2,templates:rows,mappings}));panelUpdate();status('Library restored without replacing existing versions.');
      }
      function panelUpdate(){panel(form,scope);restore(form,scope)}
      if(['property','branding','templateRef','templateMappingRef'].includes(e.target.name)){form.elements.reviewed.checked=false;e.target.dispatchEvent(new Event('input',{bubbles:true}));}
    }catch(error){status('Template action rejected: '+error.message)}
  });
  window.ParamountTemplates={get,getMapping,saveMapping,populatePDF,controls,restore,inspect,upload,deactivate,populate,downloadFor,unzip,zip};
})();
