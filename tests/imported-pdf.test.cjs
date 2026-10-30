const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const api=require('../imported-pdf.js');
const buffer=b=>Uint8Array.from(b).buffer;
function pdf(extra='',field='<< /FT /Tx /Type /Annot /Subtype /Widget /T (Engineer) /Rect [20 100 250 125] /P 3 0 R >>',stream=''){
 const objects=['<< /Type /Catalog /Pages 2 0 R /AcroForm 4 0 R '+extra+' >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Annots [5 0 R] >>','<< /Fields [5 0 R] >>',field];if(stream)objects.push(stream);
 let text='%PDF-1.7\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(text.length);text+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});const start=text.length;text+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';return buffer(Buffer.from(text,'latin1'));
}
function library(){const storage=new Map(),context={TextEncoder,TextDecoder,Uint8Array,DataView,Blob,DecompressionStream,crypto:webcrypto,btoa,atob,URL,console,setTimeout,cloudSession:null,window:{},document:{addEventListener(){},querySelector(){return null}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};vm.createContext(context);for(const f of ['imported-pdf.js','document-templates.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context);return {api:context.window.ParamountTemplates,context,storage};}
const values={engineer:'Fictional Engineer',reference:'TEST-1',revision:'1',branding:'Absolute Property Surveys',contractor:'Paramount Fire Protection'};
test('structured PDF import maps real bundled forms; independent-reader artifacts keep originals intact',async()=>{
 fs.mkdirSync('test-results',{recursive:true});
 for(const kind of ['Invoice','Quotation']){const original=fs.readFileSync('templates/Paramount_'+kind+'_Fillable.pdf'),before=Buffer.from(original),info=api.inspect(buffer(original));assert(info.fields.includes('prepared_by'));assert(info.fields.includes('document_number'));
 for(const branding of ['Paramount Fire Protection','Absolute Property Surveys']){const provenance='DRAFT - NOT ISSUED | Branding: '+branding+' | Contractor and draft issuer: Paramount Fire Protection | Reference: TEST-1 / revision 1';const output=await api.populate(buffer(original),{prepared_by:'engineer',document_number:'reference'},values,provenance).arrayBuffer();assert(api.inspect(output).fields.includes('prepared_by'));fs.writeFileSync('test-results/imported-'+kind+'-'+(branding.startsWith('Absolute')?'absolute':'paramount')+'.pdf',Buffer.from(output));}assert.deepEqual(original,before);}
 fs.writeFileSync('test-results/imported-blank.pdf',Buffer.from(pdf()));
});
test('rejects encoded actions, unreachable active content, encryption, signatures, XFA and object streams',()=>{
 for(const extra of ['/OpenAction << /S /JavaScript /JS (evil) >>','/Open#41ction << /S /Java#53cript /JS (evil) >>','/AA << /K << /S /Launch >> >>','/Names << /EmbeddedFiles [] >>','/XFA (xml)','/Encrypt 5 0 R','/URI (https://example.invalid)','/Perms << >>'])assert.throws(()=>api.inspect(pdf(extra)),/Unsafe/,extra);
 for(const o of ['<< /Type /ObjStm /N 1 /First 0 /Length 0 >>\nstream\n\nendstream','<< /S /Java#53cript >>','<< /Type /Filespec /F (external) >>'])assert.throws(()=>api.inspect(pdf('',undefined,o)),/Unsafe/);
 assert.throws(()=>api.inspect(pdf('','<< /FT /Sig /T (Signature) >>')),/Unsafe/);
});
test('rejects ambiguous, truncated, duplicate, trailing and damaged structures; bounds recursion and input',()=>{
 const good=Buffer.from(pdf()).toString('latin1');for(const bad of [good.replace('/Fields [','/Fields [] /Fields ['),good.replace('/Root 1 0 R','/Root 9 0 R'),good.replace('0000000009','0000000008'),good.replace('startxref','oops'),good.slice(0,-8),good+'garbage',good.replace('/AcroForm 4 0 R','/AcroForm '+ '['.repeat(40)+'0'+']'.repeat(40))])assert.throws(()=>api.inspect(buffer(Buffer.from(bad,'latin1'))),/Unsafe/);
 assert.throws(()=>api.inspect(new ArrayBuffer(2097153)),/Unsafe/);
});
test('unsupported/read-only/signature-looking fields stay manual; text overflow and Unicode reject without output',()=>{
 for(const f of ['<< /FT /Btn /T (Check) >>','<< /FT /Tx /T (Signature) /Subtype /Widget /Rect [0 0 80 20] >>','<< /FT /Tx /Ff 1 /T (Locked) /Subtype /Widget /Rect [0 0 80 20] >>'])assert.equal(api.inspect(pdf('',f)).fields.length,0);
 assert.throws(()=>api.populate(pdf(),{Engineer:'engineer'},{engineer:'é'},'DRAFT'),/ASCII/);
 assert.throws(()=>api.populate(pdf(),{Engineer:'engineer'},{engineer:'x'.repeat(1000)},'DRAFT'),/fit/);
 assert.throws(()=>api.populate(pdf(),{Missing:'engineer'},values,'DRAFT'),/Invalid/);
});
test('mapping revisions are immutable, hash/version-bound, scoped and preserve original bytes',async()=>{
 const {api,storage}=library(),original=pdf(),f={name:'blank.pdf',arrayBuffer:async()=>original};
 const t=await api.upload(f,{name:'Authorised fictional blank',company:'absolute',kind:'service'},'device-guest'),snapshot=JSON.stringify(t);
 const m=await api.saveMapping(t.id,'Engineer mapping',{Engineer:'engineer'},'device-guest');const m2=await api.saveMapping(t.id,'Reference mapping',{Engineer:'reference'},'device-guest');assert.notEqual(m.id,m2.id);assert.equal(api.getMapping(m.id,'other'),undefined);assert.equal(JSON.stringify(api.get(t.id,'device-guest')),snapshot);
 const out=await api.populatePDF(t,m,values);assert.equal(out.type,'application/pdf');assert.equal(api.get(t.id,'device-guest').content,t.content);
 await assert.rejects(()=>api.populatePDF({...t,hash:'bad'},m,values),/hash/);await assert.rejects(()=>api.populatePDF(t,{...m,templateHash:'bad'},values),/exact template/);
 await assert.rejects(()=>api.saveMapping(t.id,'Unsafe',{Engineer:'engineerSignature'},'device-guest'),/Unsupported/);
 const next=await api.upload(f,{name:'New version',replace:t.id,company:'absolute'},'device-guest');await assert.rejects(()=>api.populatePDF(next,m,values),/exact template/);assert.equal(api.getMapping(m.id,'device-guest').fields.Engineer,'engineer');
 assert(Array.isArray(JSON.parse(storage.get('paramount-templates-v1:device-guest')).mappings));
});
test('mapping writes reject account changes and storage failure without partial mutation',async()=>{
 const {api,context,storage}=library(),t=await api.upload({name:'x.pdf',arrayBuffer:async()=>pdf()},{name:'Blank'},'device-guest'),before=storage.get('paramount-templates-v1:device-guest');context.cloudSession={user:{id:'other'}};await assert.rejects(()=>api.saveMapping(t.id,'Mapping',{Engineer:'engineer'},'device-guest'),/Account changed/);assert.equal(storage.get('paramount-templates-v1:device-guest'),before);
 context.cloudSession=null;context.localStorage.setItem=()=>{throw Error('Quota exceeded')};await assert.rejects(()=>api.saveMapping(t.id,'Mapping',{Engineer:'engineer'},'device-guest'),/Quota/);assert.equal(storage.get('paramount-templates-v1:device-guest'),before);
});
