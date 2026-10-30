/* Bounded classic-PDF importer. Unsupported structures fail closed; no rendering,
   scripts, network, repair heuristics, compressed object streams or XFA. */
(() => {
  'use strict';
  const fail=()=>{throw Error('Unsafe, malformed or unsupported PDF. Use an authorised blank classic PDF without actions, encryption, signatures or object streams.');};
  const name=value=>({name:value}),str=value=>({str:value});
  const isDict=v=>v&&typeof v==='object'&&!Array.isArray(v)&&!('name'in v)&&!('str'in v)&&!('ref'in v);
  const forbidden=new Set('A AA OpenAction JS JavaScript Launch EmbeddedFile EmbeddedFiles Filespec EF AF RichMedia XFA Encrypt ObjStm XRef Prev XRefStm URI GoToR GoToE SubmitForm ImportData Rendition Movie Sound 3D Collection Perms DocMDP Sig ByteRange Reference FilterExternal FFilter FDecodeParms PS PostScript'.split(' '));
  function parse(buffer) {
    const bytes=new Uint8Array(buffer);if(!bytes.length||bytes.length>2097152)fail();
    // One character per byte is essential for byte offsets (TextDecoder latin1 maps CP1252).
    let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
    if(!/^%PDF-1\.[0-7][\r\n]/.test(raw))fail();
    let p=0,tokens=0;
    const ws=()=>{while(p<raw.length){if(/[\0\t\n\f\r ]/.test(raw[p]))p++;else if(raw[p]==='%'){while(p<raw.length&&!/[\r\n]/.test(raw[p]))p++;}else break;}};
    const word=()=>{ws();const m=/^[^\0\t\n\f\r ()<>\[\]{}/%]+/.exec(raw.slice(p));if(!m)fail();p+=m[0].length;return m[0];};
    const value=(depth=0)=>{
      if(depth>32||++tokens>100000)fail();ws();const c=raw[p];
      if(raw.slice(p,p+2)==='<<'){
        p+=2;const d=Object.create(null);while(true){ws();if(raw.slice(p,p+2)==='>>'){p+=2;return d;}const k=value(depth+1);if(!k?.name||Object.hasOwn(d,k.name)||forbidden.has(k.name))fail();d[k.name]=value(depth+1);}
      }
      if(c==='['){p++;const a=[];while(true){ws();if(raw[p]===']'){p++;return a;}a.push(value(depth+1));if(a.length>5000)fail();}}
      if(c==='/'){p++;const m=/^[^\0\t\n\f\r ()<>\[\]{}/%]*/.exec(raw.slice(p))[0];p+=m.length;if(/#(?![a-fA-F0-9]{2})/.test(m))fail();const n=m.replace(/#([a-fA-F0-9]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));if(forbidden.has(n))fail();return name(n);}
      if(c==='('){p++;let s='',nest=1;while(p<raw.length){let ch=raw[p++];if(ch==='\\'){ch=raw[p++];if(ch==='\r'){if(raw[p]==='\n')p++;continue;}if(ch==='\n')continue;const oct=/^[0-7]{1,3}/.exec(ch+raw.slice(p,p+2));if(oct){s+=String.fromCharCode(parseInt(oct[0],8));p+=oct[0].length-1;}else s+=({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'}[ch]??ch);}else if(ch==='('){if(++nest>32)fail();s+=ch;}else if(ch===')'){if(--nest===0)return str(s);s+=ch;}else s+=ch;if(s.length>65536)fail();}fail();}
      if(c==='<'){p++;const end=raw.indexOf('>',p);if(end<0)fail();let h=raw.slice(p,end).replace(/[\0\t\n\f\r ]/g,'');if(!/^[\da-fA-F]*$/.test(h))fail();if(h.length%2)h+='0';p=end+1;return str(h.replace(/../g,x=>String.fromCharCode(parseInt(x,16))));}
      const w=word();if(w==='true')return true;if(w==='false')return false;if(w==='null')return null;
      if(!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(w))fail();const n=Number(w);if(!Number.isFinite(n)||Math.abs(n)>1e10)fail();
      const saved=p;ws();const ref=/^(\d+)\s+R\b/.exec(raw.slice(p));if(Number.isInteger(n)&&n>=0&&ref){p+=ref[0].length;return {ref:n,gen:Number(ref[1])};}p=saved;return n;
    };
    const objects=new Map(),offsets=new Map();ws();
    while(raw.slice(p,p+4)!=='xref'){
      const start=p,id=Number(word()),gen=Number(word());if(!Number.isInteger(id)||id<1||id>10000||gen!==0||word()!=='obj'||objects.has(id)||objects.size>=5000)fail();
      const v=value();ws();let stream=null;
      if(raw.slice(p,p+6)==='stream'){
        if(!isDict(v)||Object.hasOwn(v,'F')||!Number.isInteger(v.Length)||v.Length<0||v.Length>2097152)fail();p+=6;if(raw.slice(p,p+2)==='\r\n')p+=2;else if(raw[p]==='\n'||raw[p]==='\r')p++;else fail();
        stream=raw.slice(p,p+v.Length);if(stream.length!==v.Length)fail();p+=v.Length;if(raw.slice(p,p+2)==='\r\n')p+=2;else if(/[\r\n]/.test(raw[p]))p++;if(raw.slice(p,p+9)!=='endstream')fail();p+=9;
      }
      if(word()!=='endobj')fail();objects.set(id,{v,stream});offsets.set(id,start);ws();
    }
    const xref=p;p+=4;const indexed=new Set();
    while(true){ws();if(raw.slice(p,p+7)==='trailer'){p+=7;break;}const first=Number(word()),count=Number(word());if(!Number.isInteger(first)||first<0||!Number.isInteger(count)||count<1||first+count>10001)fail();for(let i=0;i<count;i++){const at=Number(word()),gen=Number(word()),state=word(),id=first+i;if(indexed.has(id))fail();indexed.add(id);if(id===0){if(state!=='f'||at!==0||gen!==65535)fail();}else if(state!=='n'||gen!==0||offsets.get(id)!==at)fail();}}
    const trailer=value();if(!isDict(trailer)||!trailer.Root?.ref||!Number.isInteger(trailer.Size)||trailer.Size!==Math.max(...objects.keys())+1||indexed.size!==objects.size+1)fail();
    if(word()!=='startxref'||Number(word())!==xref)fail();ws(); // ws consumes %%EOF, so validate suffix independently.
    if(p!==raw.length||!/^\s*%%EOF[\0\t\n\f\r ]*$/.test(raw.slice(raw.lastIndexOf('%%EOF'))))fail();
    // All references, including unreachable objects, must resolve. Names were decoded before policy checks.
    const check=(v,d=0)=>{if(d>32)fail();if(v?.ref!==undefined){if(v.gen!==0||!objects.has(v.ref))fail();}else if(Array.isArray(v))v.forEach(x=>check(x,d+1));else if(isDict(v))Object.values(v).forEach(x=>check(x,d+1));};
    for(const o of objects.values())check(o.v);check(trailer);
    const resolve=v=>v?.ref!==undefined?objects.get(v.ref)?.v:v;
    const root=resolve(trailer.Root);if(root?.Type?.name!=='Catalog')fail();
    const pages=[],seenPages=new Set();function walkPages(ref,depth=0){if(!ref?.ref||seenPages.has(ref.ref)||depth>20)fail();seenPages.add(ref.ref);const d=resolve(ref);if(d?.Type?.name==='Page'){pages.push({id:ref.ref,d});if(pages.length>100)fail();}else if(d?.Type?.name==='Pages'&&Array.isArray(d.Kids)){d.Kids.forEach(r=>walkPages(r,depth+1));}else fail();}walkPages(root.Pages);if(!pages.length)fail();
    const fields=[],seenFields=new Set(),names=new Set();const form=resolve(root.AcroForm);
    function text(s){if(typeof s!=='string')fail();if(s.charCodeAt(0)===254&&s.charCodeAt(1)===255){if(s.length%2)fail();let out='';for(let i=2;i<s.length;i+=2)out+=String.fromCharCode(s.charCodeAt(i)*256+s.charCodeAt(i+1));return out;}if(/[^\x20-\x7e]/.test(s))fail();return s;}
    function field(ref,prefix='',inherited={},depth=0){if(!ref?.ref||seenFields.has(ref.ref)||depth>16)fail();seenFields.add(ref.ref);const d=resolve(ref);if(!isDict(d))fail();const title=d.T?text(d.T.str):'',full=prefix&&title?prefix+'.'+title:title||prefix,ft=d.FT||inherited.FT,flags=d.Ff??inherited.Ff??0;
      if(d.Kids){if(!Array.isArray(d.Kids))fail();if(d.Kids.some(r=>resolve(r)?.T)){d.Kids.forEach(r=>field(r,full,{FT:ft,Ff:flags},depth+1));return;}}
      if(!full||full.length>200||names.has(full)||!Number.isInteger(flags)||fields.length>=200)fail();names.add(full);
      const widgets=d.Kids||[ref];const supported=!/signature|declaration|signed|approval/i.test(full)&&ft?.name==='Tx'&&!(flags&(1|8192|1048576|16777216|33554432))&&widgets.length>0&&widgets.every(r=>{const w=resolve(r);return w?.Subtype?.name==='Widget'&&Array.isArray(w.Rect)&&w.Rect.length===4&&w.Rect.every(Number.isFinite);});
      fields.push({name:full,type:ft?.name||'unknown',supported,id:ref.ref,widgets:widgets.map(r=>r.ref),maxLength:d.MaxLen??null,flags});
    }
    if(form){if(!isDict(form)||!Array.isArray(form.Fields))fail();form.Fields.forEach(r=>field(r));}
    return {objects,trailer,root,pages,fields,resolve};
  }
  const serial=v=>{if(v===null)return 'null';if(v===true||v===false||typeof v==='number')return String(v);if(Array.isArray(v))return '['+v.map(serial).join(' ')+']';if(v?.ref!==undefined)return v.ref+' 0 R';if(v?.name!==undefined)return '/'+[...v.name].map(c=>/[A-Za-z0-9_.+-]/.test(c)?c:'#'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('');if(v?.str!==undefined)return '<'+[...v.str].map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('')+'>';if(isDict(v))return '<< '+Object.entries(v).map(([k,x])=>serial(name(k))+' '+serial(x)).join(' ')+' >>';fail();};
  function inspect(buffer){const pdf=parse(buffer);return {format:'pdf',fields:pdf.fields.filter(f=>f.supported).map(f=>f.name),pdfFields:pdf.fields.map(({name,type,supported,maxLength})=>({name,type,supported,maxLength})),preview:pdf.fields.length?'PDF inspected without rendering. Map supported text fields to certificate values. Signatures, choices and unsupported fields require manual completion.':'PDF inspected without rendering. No fillable fields; download unchanged original for manual completion.'};}
  function populate(buffer,mapping,values,provenance){
    const pdf=parse(buffer),mapped=Object.entries(mapping);if(!mapped.length)throw Error('Save a PDF field mapping first.');
    const add=(v,stream=null)=>{const id=Math.max(...pdf.objects.keys())+1;pdf.objects.set(id,{v,stream});return {ref:id,gen:0};};
    const font=add({Type:name('Font'),Subtype:name('Type1'),BaseFont:name('Helvetica')});
    const literal=s=>'('+s.replace(/[\\()]/g,'\\$&')+')';
    function appearance(text,w,h){if(!Number.isFinite(w)||!Number.isFinite(h)||w<10||h<10||w>2000||h>2000)throw Error('Unsupported PDF field dimensions.');const size=Math.min(11,h-4,(w-4)/Math.max(1,text.length*0.65));if(size<6)throw Error('Mapped text does not fit the PDF field. Shorten it or complete the original manually.');const stream='q 0 0 '+w+' '+h+' re W n BT /F1 '+size.toFixed(3)+' Tf 0 g 2 '+Math.max(2,(h-size)/2).toFixed(3)+' Td '+literal(text)+' Tj ET Q';return add({Type:name('XObject'),Subtype:name('Form'),BBox:[0,0,w,h],Resources:{Font:{F1:font}},Length:stream.length},stream);}
    for(const [target,source] of mapped){const f=pdf.fields.find(f=>f.name===target);if(!f?.supported||!Object.hasOwn(values,source))throw Error('Invalid PDF field mapping: '+target);const val=String(values[source]??'');if(/[^\x20-\x7e]/.test(val)||val.length>2000||(f.maxLength!==null&&val.length>f.maxLength))throw Error('PDF text must fit the field and use printable ASCII; complete other text in the original.');const d=pdf.objects.get(f.id).v;d.V=str(val);delete d.DV;for(const id of f.widgets){const widget=pdf.objects.get(id)?.v;if(!widget)fail();const [x,y,x2,y2]=widget.Rect;widget.AP={N:appearance(val,x2-x,y2-y)};}}
    // Persistent visible draft stamp on each page; attribution is also accessible as annotation text.
    const lines=['DRAFT - NOT ISSUED',...provenance.split(' | ').filter(s=>/^(Branding:|Contractor and draft issuer:|Reference:)/.test(s))];const stampText='q BT /F1 8 Tf 0 g 2 46 Td '+lines.map((line,i)=>(i?'0 -11 Td ':'')+literal(line)+' Tj').join(' ')+' ET Q';const stamp=add({Type:name('XObject'),Subtype:name('Form'),BBox:[0,0,550,58],Resources:{Font:{F1:font}},Length:stampText.length},stampText);
    for(const {d} of pdf.pages){const annots=pdf.resolve(d.Annots)||[];if(!Array.isArray(annots))fail();d.Annots=[...annots,add({Type:name('Annot'),Subtype:name('Stamp'),Rect:[12,4,562,62],F:4,Contents:str(provenance),AP:{N:stamp}})];}
    const form=pdf.resolve(pdf.root.AcroForm);if(form)form.NeedAppearances=false;
    let out='%PDF-1.7\n',offsets=[0];for(const [id,{v,stream}] of [...pdf.objects].sort((a,b)=>a[0]-b[0])){offsets[id]=out.length;out+=id+' 0 obj\n'+serial(v)+(stream===null?'':'\nstream\n'+stream+'\nendstream')+'\nendobj\n';}
    const start=out.length,size=Math.max(...pdf.objects.keys())+1;out+='xref\n0 '+size+'\n0000000000 65535 f \n';for(let i=1;i<size;i++){if(!offsets[i])fail();out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';}out+='trailer\n'+serial({Size:size,Root:pdf.trailer.Root})+'\nstartxref\n'+start+'\n%%EOF\n';
    const result=Uint8Array.from(out,c=>c.charCodeAt(0));parse(result.buffer);return new Blob([result],{type:'application/pdf'});
  }
  const api={inspect,populate};if(typeof module!=='undefined')module.exports=api;else window.ParamountImportedPDF=api;
})();
