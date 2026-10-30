const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {webcrypto}=require('node:crypto');
function library(){const storage=new Map(),context={TextEncoder,TextDecoder,Uint8Array,DataView,Blob,DecompressionStream,crypto:webcrypto,btoa,atob,URL,console,setTimeout,cloudSession:null,window:{},document:{addEventListener(){},querySelector(){return null}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};vm.createContext(context);vm.runInContext(fs.readFileSync('imported-pdf.js','utf8'),context);vm.runInContext(fs.readFileSync('document-templates.js','utf8'),context);return {api:context.window.ParamountTemplates,context,storage}}
function word(api,body='{{engineer}} &amp; {{reference}}',extra={}){return api.zip({'[Content_Types].xml':new TextEncoder().encode('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'_rels/.rels':new TextEncoder().encode('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),'word/document.xml':new TextEncoder().encode('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+body+'</w:t></w:r></w:p></w:body></w:document>'),...extra})}
const file=async(blob,name='Blank.docx')=>({name,arrayBuffer:()=>blob.arrayBuffer()});
test('Word import validates bytes; mapping escapes XML and never changes original',async()=>{
 const {api}=library(),blob=word(api),original=await blob.arrayBuffer();const info=await api.inspect('blank.docx',original);assert.deepEqual(Array.from(info.fields),['engineer','reference']);
 const t=await api.upload(await file(blob),{name:'PAT blank',kind:'pat'},'device-guest');
 const output=await api.populate(t,{engineer:'A & <B>',reference:'new reference'}),parsed=await api.unzip(await output.arrayBuffer());
 assert.match(new TextDecoder().decode(parsed['word/document.xml']),/A &amp; &lt;B&gt;/);assert.equal(t.content,btoa(String.fromCharCode(...new Uint8Array(original))));
 await assert.rejects(()=>api.populate(t,{engineer:'A'}),/No mapped value/);
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/mapped-existing-template.docx',Buffer.from(await output.arrayBuffer()));
});
test('replacement preserves original versions, assignments and hashes; deactivation retains bytes',async()=>{
 const {api}=library(),f=await file(word(api));const first=await api.upload(f,{name:'Office template',company:'absolute',property:'P1',kind:'invoice'},'device-guest');
 const copy=JSON.stringify(first);const second=await api.upload(f,{name:'Revised office template',replace:first.id,company:'absolute',property:'P1',kind:'invoice'},'device-guest');
 assert.notEqual(first.id,second.id);assert.equal(second.family,first.family);assert.equal(second.version,2);assert.equal(JSON.stringify(first),copy);
 assert.equal(api.get(first.id,'device-guest').active,false);api.deactivate(second.id,'device-guest');assert.equal(api.get(second.id,'device-guest').content,second.content);assert.equal(api.get(first.id,'other-account'),undefined);
});
test('file handling rejects malformed, disguised, encrypted, corrupt and active documents',async()=>{
 const {api}=library();for(const [name,b]of [['x.docx',new TextEncoder().encode('not zip')],['x.exe',new TextEncoder().encode('%PDF-1.7\n%%EOF')],['x.pdf',new TextEncoder().encode('%PDF-1.7 /JavaScript /JS\n%%EOF')],['x.pdf',new Uint8Array(2097153)]])await assert.rejects(()=>api.inspect(name,b.buffer));
 for(const extra of [{'word/vbaProject.bin':new Uint8Array([1])},{'word/_rels/document.xml.rels':new TextEncoder().encode('<Relationship TargetMode="External" Target="https://example.invalid"/>')},{'../escape.xml':new TextEncoder().encode('x')}]){const buffer=await word(api,'blank',extra).arrayBuffer();await assert.rejects(()=>api.inspect('x.docx',buffer));}
 const active=await word(api,'<!DOCTYPE x>').arrayBuffer();await assert.rejects(()=>api.inspect('x.docx',active));
 const corrupt=new Uint8Array(await word(api).arrayBuffer());corrupt[40]^=1;await assert.rejects(()=>api.inspect('x.docx',corrupt.buffer));
 await assert.rejects(()=>api.inspect('x.pdf',new TextEncoder().encode('%PDF-1.7\n%%EOF').buffer),/Unsafe/);
});
test('account changes and team context cannot mutate the personal template library',async()=>{
 const {api,context,storage}=library(),f=await file(word(api));context.cloudSession={user:{id:'someone-else'}};
 await assert.rejects(()=>api.upload(f,{name:'No'},'device-guest'),/Account changed/);assert.equal(storage.size,0);
 context.window.ParamountTeamSync={};await assert.rejects(()=>api.upload(f,{name:'No'},'device-guest'),/server-enforced roles/);
});
test('actual compressed Microsoft Word compatible blanks import and preserve their content',async()=>{
 const {api}=library();for(const kind of ['Quotation','Invoice']){const data=fs.readFileSync('templates/Paramount_'+kind+'_Editable.docx');const info=await api.inspect('blank.docx',data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));assert.equal(info.format,'docx');assert.match(info.preview,/Paramount/i);}
});
