/* Evidence PDF: exact frozen issue and verified acknowledgement; no private key or bearer token. */
(function(root,factory){if(typeof module==='object')module.exports=factory;else root.ParamountEvidencePdf=factory(root.ParamountPdfFont)})(globalThis,font=>{
 'use strict';
  function parseMoney(value) {
    if(!/^\d+(?:\.\d{1,2})?$/.test(String(value).trim()))throw Error('Use a non-negative price with at most two decimal places.');
    const [whole,fraction='']=String(value).trim().split('.');
    const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
    if(!Number.isSafeInteger(n)||n>100000000)throw Error('Price exceeds the supported £1,000,000 limit.');return n;
  }
  function totals(values) {
    const lines=String(values.lines||'').trim().split('\n').filter(x=>x.trim()).map(line=>{
      const parts=line.split('|').map(x=>x.trim());
      if(parts.length!==3||!parts[0]||!/^\d+$/.test(parts[1])||Number(parts[1])<1||Number(parts[1])>10000)throw Error('Each line needs description | whole quantity (1–10000) | price.');
      const unit=parseMoney(parts[2]),quantity=Number(parts[1]),amount=unit*quantity;
      if(!Number.isSafeInteger(amount))throw Error('Line total is too large.');return {description:parts[0],quantity,unit,amount};
    });
    if(!lines.length)throw Error('Enter at least one line item.');
    const vat=String(values.vat??'');if(!/^\d+(?:\.\d{1,2})?$/.test(vat)||Number(vat)>100)throw Error('Enter a VAT percentage from 0 to 100 with at most two decimals.');
    const subtotal=lines.reduce((n,l)=>n+l.amount,0);if(!Number.isSafeInteger(subtotal)||subtotal>10000000000)throw Error('Document total exceeds the supported limit.');
    const tax=Math.round(subtotal*Math.round(Number(vat)*100)/10000);return {lines,subtotal,tax,total:subtotal+tax};
  }
  const pounds = p => '£'+(p/100).toFixed(2);

 async function create(data){
  if(!data||typeof data.canonical_document!=='string'||!/^[0-9a-f]{64}$/.test(data.digest||''))throw Error('Frozen issue required');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.canonical_document));
  if(Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('')!==data.digest)throw Error('Issue digest mismatch');
  const f=JSON.parse(data.canonical_document);
  if(!['service','pat','lighting','quote'].includes(f.kind)||!f.payload?.values||data.issue==null)throw Error('Unsupported controlled issue');
  if(data.signed_at&&(!data.verified_at||!data.verified_email||!data.signer_name||!data.consent||!data.request))throw Error('Verified acknowledgement evidence required');
  const lines=[String(f.kind).toUpperCase()+' — CONTROLLED ISSUE', 'Issue: '+data.issue,'Issue sequence: '+data.sequence,'Document: '+f.document,'Workspace: '+f.workspace,'Source version: '+f.version,'Approved at: '+data.approved_at,'Approved scope: '+f.scope,'SHA-256 canonical document: '+data.digest,'', 'FROZEN SITE',...Object.entries(f.payload.siteSnapshot||{}).map(([k,v])=>k+': '+v),'','FROZEN RECORD',...Object.entries(f.payload.values).map(([k,v])=>k+': '+v),...(f.kind==='quote'?(()=>{const t=totals(f.payload.values);return ['','Subtotal: '+pounds(t.subtotal),'VAT: '+pounds(t.tax),'Total: '+pounds(t.total)]})():[]),'','ACKNOWLEDGEMENT EVIDENCE',...(data.signed_at?['Request: '+data.request,'Signed at (server): '+data.signed_at,'Signer name (self-declared): '+data.signer_name,'Verified mailbox: '+data.verified_email,'Mailbox verified at (server): '+data.verified_at,'Consent: '+data.consent,'Identity assurance: mailbox access via one-time email code; name and authority self-declared.']:['No customer acknowledgement recorded.']),'','This is evidence of the stated issue and acknowledgement. The document digest binds the frozen record; it is not a cryptographic PDF signature or statutory compliance certification. Verify the receipt against the issuer audit.'];
  return renderPdf([{kind:f.kind,revision:f.payload.revision,lines}]);
 }
  function renderPdf(records) {
    if(!records.length)throw Error('No saved records for this report.');
    if(!font)throw Error('PDF font unavailable. Reload the app and retry.');
    const normal=text=>Array.from(String(text).replace(/\r\n?/g,'\n')).map(c=>c==='\n'||font.cmap[c.codePointAt(0)]?c:'[U+'+c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')+']').join('');
    const wrap=line=>normal(line).split('\n').flatMap(part=>{let chars=Array.from(part),out=[];while(chars.length>86){let n=chars.slice(0,86).lastIndexOf(' ');if(n<1)n=86;out.push(chars.slice(0,n).join(''));chars=chars.slice(n);if(chars[0]===' ')chars.shift()}return [...out,chars.join('')]});
    const pages=[];
    for(const r of records){const lines=r.lines.flatMap(wrap);for(let i=0;i<lines.length;i+=43)pages.push({r,lines:lines.slice(i,i+43)})}
    const glyphs=new Map();
    const hex4=n=>n.toString(16).padStart(4,'0');
    const unicode=c=>Array.from(c).map(ch=>{const n=ch.codePointAt(0);return n<=65535?hex4(n):hex4(0xd800+((n-65536)>>10))+hex4(0xdc00+((n-65536)&1023))}).join('');
    const encode=text=>'<'+Array.from(normal(text)).map(c=>{if(!glyphs.has(c))glyphs.set(c,glyphs.size+1);return hex4(glyphs.get(c))}).join('')+'>';
    const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type0 /BaseFont /DejaVuSansMono /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 8 0 R >>','<< /Type /Font /Subtype /CIDFontType2 /BaseFont /DejaVuSansMono /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 5 0 R /DW 602 /CIDToGIDMap 7 0 R >>','<< /Type /FontDescriptor /FontName /DejaVuSansMono /Flags 33 /FontBBox [-559 -375 718 1028] /ItalicAngle 0 /Ascent 928 /Descent -236 /CapHeight 729 /StemV 80 /FontFile2 6 0 R >>','','',''];
    const stream=s=>'<< /Length '+s.length+' >>\nstream\n'+s+'\nendstream';
    const kids=[];
    pages.forEach(({r,lines},i)=>{
      const pageId=objects.length,streamId=pageId+1;kids.push(pageId+' 0 R');
      const text=(s,size,x,y)=>`BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm ${encode(s)} Tj ET\n`;
      let content='0.06 0.17 0.28 rg 0 752 595 90 re f\n0.07 0.59 0.82 rg 0 748 595 4 re f\n1 1 1 rg\n'+text('PARAMOUNT FIRE PROTECTION',17,36,805)+text('FIELD SERVICE  /  '+(r.kind==='service'?'FIRE ALARM':r.kind==='pat'?'PAT TESTING':r.kind==='lighting'?'EMERGENCY LIGHTING':String(r.kind).toUpperCase()),10,36,780)+'0.06 0.17 0.28 rg\n';
      lines.forEach((l,j)=>{content+=text(l,10,36,724-j*13)});
      content+='0.07 0.59 0.82 RG 36 100 m 559 100 l S\n0.55 0.1 0.12 rg\n'+text('CONTROLLED ISSUE / ELECTRONIC ACKNOWLEDGEMENT EVIDENCE',9,36,81)+text('Mailbox verified; name/authority self-declared. No statutory certification.',8,36,65)+'0.06 0.17 0.28 rg\n'+text('Page '+(i+1)+' of '+pages.length+' | Revision: '+r.revision,8,36,45);
      objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>',stream(content));
    });
    const fontStream=font.hex+'>';objects[6]='<< /Length '+fontStream.length+' /Length1 '+font.hex.length/2+' /Filter /ASCIIHexDecode >>\nstream\n'+fontStream+'\nendstream';
    const gid='0000'+Array.from(glyphs.keys()).map(c=>hex4(font.cmap[c.codePointAt(0)])).join('')+'>';
    objects[7]='<< /Length '+gid.length+' /Filter /ASCIIHexDecode >>\nstream\n'+gid+'\nendstream';
    const entries=Array.from(glyphs,([c,id])=>'<'+hex4(id)+'> <'+unicode(c)+'>');
    let cmap='/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /ParamountUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
    for(let i=0;i<entries.length;i+=100){const chunk=entries.slice(i,i+100);cmap+=chunk.length+' beginbfchar\n'+chunk.join('\n')+'\nendbfchar\n'}
    cmap+='endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';objects[8]=stream(cmap);
    objects[2]='<< /Type /Pages /Count '+pages.length+' /Kids ['+kids.join(' ')+'] >>';
    let pdf='%PDF-1.4\n',offsets=[0];
    for(let i=1;i<objects.length;i++){offsets.push(pdf.length);pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n'}
    const start=pdf.length;pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';return pdf;
  }
 return {create};
});
